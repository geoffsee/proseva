import {
  createKV,
  PassphraseEncryptionProvider,
  WasmMlKemProvider,
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

let _keysStore: KVNamespace | null = null;
let _dataStore: KVNamespace | null = null;
let _forceMemory = false;

/**
 * Initialize the keys KV store encrypted with user's passphrase (PBKDF2 + AES-256-GCM).
 * This store holds the ML-KEM keypair.
 */
export async function initKeysStore(
  passphrase: string,
): Promise<KVNamespace> {
  const provider = await PassphraseEncryptionProvider.create(passphrase);
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
  const provider = await WasmMlKemProvider.fromKeys(publicKey, secretKey);
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
  if (!_dataStore) throw new Error("Data store not initialized. Call initDataStore() first.");
  return _dataStore;
}

/**
 * Get the initialized keys store. Throws if not yet initialized.
 */
export function getKeysStore(): KVNamespace {
  if (!_keysStore) throw new Error("Keys store not initialized. Call initKeysStore() first.");
  return _keysStore;
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
  const mlkemProvider = await WasmMlKemProvider.create();
  const { publicKey, secretKey } = mlkemProvider.exportKeys();

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
}
