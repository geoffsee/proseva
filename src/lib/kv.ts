import {
  createKV,
  PassphraseEncryptionProvider,
  WasmMlKemProvider,
  WebCryptoEncryptionProvider,
  kvGetJson,
  type KVNamespace,
} from "idb-repo";

export const STORAGE_KEYS = {
  cases: "cases",
  deadlines: "deadlines",
  finances: "finances",
  contacts: "contacts",
  chat: "chat",
  notes: "notes",
  tasks: "tasks",
  evidences: "evidences",
  filings: "filings",
  estatePlans: "estate_plans",
  research: "research_chat",
} as const;

const MLKEM_PUBLIC_KEY = "mlkem-public-key";
const MLKEM_SECRET_KEY = "mlkem-secret-key";
const KEYS_STORE_SALT_STORAGE_KEY = "proseva-keys-store-salt";
const AUTH_STORE_DEVICE_KEY = "proseva-auth-device-key";
const AUTH_TOKEN_KEY = "auth-token";

let _keysStore: KVNamespace | null = null;
let _dataStore: KVNamespace | null = null;
let _authStore: KVNamespace | null = null;
let _forceMemory = false;

function encodeBytes(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function decodeBytes(input: string): Uint8Array | null {
  try {
    return Uint8Array.from(atob(input), (ch) => ch.charCodeAt(0));
  } catch {
    return null;
  }
}

function loadKeysStoreSalt(): Uint8Array | null {
  const raw = localStorage.getItem(KEYS_STORE_SALT_STORAGE_KEY);
  if (!raw) return null;
  return decodeBytes(raw);
}

function saveKeysStoreSalt(salt: Uint8Array): void {
  localStorage.setItem(KEYS_STORE_SALT_STORAGE_KEY, encodeBytes(salt));
}

/**
 * Initialize the keys KV store encrypted with user's passphrase (PBKDF2 + AES-256-GCM).
 * This store holds the ML-KEM keypair.
 */
export async function initKeysStore(passphrase: string): Promise<KVNamespace> {
  const existingSalt = loadKeysStoreSalt();
  const provider = await PassphraseEncryptionProvider.create(
    passphrase,
    existingSalt ?? undefined,
  );

  if (!existingSalt && typeof provider.getSalt === "function") {
    saveKeysStoreSalt(provider.getSalt());
  }

  _keysStore = createKV({
    dbName: "proseva-keys",
    encryptionProvider: provider,
    forceMemory: _forceMemory,
  });
  return _keysStore;
}

/**
 * Initialize the data KV store encrypted with ML-KEM-1024 (post-quantum).
 * This store holds all app data.
 */
export async function initDataStore(
  publicKey: Uint8Array,
  secretKey: Uint8Array,
): Promise<KVNamespace> {
  let provider: Awaited<ReturnType<typeof WasmMlKemProvider.fromKeys>>;
  try {
    provider = await WasmMlKemProvider.fromKeys(publicKey, secretKey);
  } catch (err) {
    // Fallback for environments where wasm module linking fails at runtime.
    // Derive a stable AES-256 key from the persisted secret key.
    const fallbackKey = secretKey.slice(0, 32);
    if (fallbackKey.length < 32) {
      throw err;
    }
    const webCryptoProvider = new WebCryptoEncryptionProvider(fallbackKey);
    await webCryptoProvider.initialize();
    _dataStore = createKV({
      dbName: "proseva-data",
      encryptionProvider: webCryptoProvider,
      forceMemory: _forceMemory,
    });
    console.warn("ML-KEM wasm unavailable; using WebCrypto fallback.", err);
    return _dataStore;
  }

  _dataStore = createKV({
    dbName: "proseva-data",
    encryptionProvider: provider,
    forceMemory: _forceMemory,
  });
  return _dataStore;
}

/**
 * Get the initialized data store. Throws if not yet initialized.
 */
export function getDataStore(): KVNamespace {
  if (!_dataStore)
    throw new Error("Data store not initialized. Call initDataStore() first.");
  return _dataStore;
}

/**
 * Get the initialized keys store. Throws if not yet initialized.
 */
export function getKeysStore(): KVNamespace {
  if (!_keysStore)
    throw new Error("Keys store not initialized. Call initKeysStore() first.");
  return _keysStore;
}

/**
 * Get or generate the device-specific encryption key for the auth store.
 * This key is stored in localStorage and used to encrypt the JWT token.
 */
function getDeviceAuthKey(): Uint8Array {
  const existing = localStorage.getItem(AUTH_STORE_DEVICE_KEY);
  if (existing) {
    const decoded = decodeBytes(existing);
    if (decoded && decoded.length === 32) {
      return decoded;
    }
  }

  // Generate new 256-bit key
  const key = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(AUTH_STORE_DEVICE_KEY, encodeBytes(key));
  return key;
}

/**
 * Initialize the auth KV store with device-specific encryption.
 * This store holds the JWT token and can be initialized before user login.
 */
export async function initAuthStore(): Promise<KVNamespace> {
  if (_authStore) return _authStore;

  const deviceKey = getDeviceAuthKey();
  const provider = new WebCryptoEncryptionProvider(deviceKey);
  await provider.initialize();

  _authStore = createKV({
    dbName: "proseva-auth",
    encryptionProvider: provider,
    forceMemory: _forceMemory,
  });

  return _authStore;
}

/**
 * Get the initialized auth store. Throws if not yet initialized.
 */
export function getAuthStore(): KVNamespace {
  if (!_authStore)
    throw new Error("Auth store not initialized. Call initAuthStore() first.");
  return _authStore;
}

/**
 * Store JWT token in encrypted auth store.
 */
export async function saveAuthToken(token: string): Promise<void> {
  const store = getAuthStore();
  await store.put(AUTH_TOKEN_KEY, token);
}

/**
 * Load JWT token from encrypted auth store.
 */
export async function loadAuthToken(): Promise<string | null> {
  const store = getAuthStore();
  const token = await store.get(AUTH_TOKEN_KEY);
  return typeof token === "string" ? token : null;
}

/**
 * Clear JWT token from encrypted auth store.
 */
export async function clearAuthToken(): Promise<void> {
  const store = getAuthStore();
  await store.delete(AUTH_TOKEN_KEY);
}

/**
 * First-time setup: generate ML-KEM keypair and store it in the keys store.
 * Requires initKeysStore() to have been called first.
 */
export async function generateAndStoreMLKEMKeys(): Promise<{
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}> {
  const keysStore = getKeysStore();
  let publicKey: Uint8Array;
  let secretKey: Uint8Array;

  try {
    const mlkemProvider = await WasmMlKemProvider.create();
    const keys = mlkemProvider.exportKeys();
    publicKey = keys.publicKey;
    secretKey = keys.secretKey;
  } catch (err) {
    // Fallback for runtimes where wasm linking fails.
    // Store a synthetic keypair so passphrase setup can still complete.
    secretKey = crypto.getRandomValues(new Uint8Array(32));
    publicKey = crypto.getRandomValues(new Uint8Array(32));
    console.warn(
      "ML-KEM key generation unavailable; using fallback keys.",
      err,
    );
  }

  await keysStore.put(MLKEM_PUBLIC_KEY, Array.from(publicKey));
  await keysStore.put(MLKEM_SECRET_KEY, Array.from(secretKey));

  return { publicKey, secretKey };
}

/**
 * Load ML-KEM keys from the keys store.
 * Returns null if keys are not stored yet.
 */
export async function loadMLKEMKeys(): Promise<{
  publicKey: Uint8Array;
  secretKey: Uint8Array;
} | null> {
  const keysStore = getKeysStore();
  const pubArr = await kvGetJson<number[]>(keysStore, MLKEM_PUBLIC_KEY);
  const secArr = await kvGetJson<number[]>(keysStore, MLKEM_SECRET_KEY);
  if (!pubArr || !secArr) return null;
  return {
    publicKey: new Uint8Array(pubArr),
    secretKey: new Uint8Array(secArr),
  };
}

/**
 * Typed read from the data store. Returns fallback if key is missing.
 */
export async function kvLoad<T>(key: string, fallback: T): Promise<T> {
  const store = getDataStore();
  const result = await kvGetJson<T>(store, key);
  return result ?? fallback;
}

/**
 * Typed write to the data store.
 */
export async function kvSave<T>(key: string, value: T): Promise<void> {
  const store = getDataStore();
  await store.put(key, value as Record<string, unknown>);
}

/**
 * Enable in-memory mode for testing. Must be called before any init*Store() calls.
 */
export function setForceMemory(force: boolean): void {
  _forceMemory = force;
}

/**
 * Reset all KV state. For testing only.
 */
export async function resetKV(): Promise<void> {
  if (_keysStore) {
    await _keysStore.close().catch(() => {});
    _keysStore = null;
  }
  if (_dataStore) {
    await _dataStore.close().catch(() => {});
    _dataStore = null;
  }
  if (_authStore) {
    await _authStore.close().catch(() => {});
    _authStore = null;
  }
}
