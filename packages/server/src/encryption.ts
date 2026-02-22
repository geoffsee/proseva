/**
 * Database encryption module with ML-KEM-1024 post-quantum encryption.
 *
 * Uses ML-KEM-1024 key encapsulation + AES-256-GCM for all database encryption.
 */
import {
  PassphraseEncryptionProvider,
  createKV,
  kvGetJson,
  type KVNamespace,
} from "idb-repo";
import { createDecipheriv, createCipheriv, randomBytes } from "node:crypto";
import { getDatabaseEncryptionKeyProvider } from "./db-key-provider";
import {
  initSync,
  ml_kem_1024_generate_keypair,
  ml_kem_1024_encapsulate,
  ml_kem_1024_decapsulate,
} from "wasm-pqc-subtle";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const __dir =
  import.meta.dir ??
  import.meta.dirname ??
  new URL(".", import.meta.url).pathname;

const DB_ENCRYPTION_V3_PAYLOAD_KEY = "__proseva_encrypted_v3";
const DEFAULT_KEYPAIR_STORE_DIR = process.env.PROSEVA_DATA_DIR
  ? join(process.env.PROSEVA_DATA_DIR, "ml-kem-keys")
  : join(process.cwd(), ".proseva-data", "ml-kem-keys");

// Initialize ML-KEM WASM module
let wasmInitialized = false;
function ensureWasmInit(): void {
  if (wasmInitialized) return;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { dirname } = require("node:path") as typeof import("node:path");
  const candidates: string[] = [
    // 1. Next to compiled binary (production)
    join(dirname(process.execPath), "wasm_pqc_subtle_bg.wasm"),
  ];

  // 2. require.resolve from node_modules (development)
  try {
    candidates.push(
      require.resolve("wasm-pqc-subtle/wasm_pqc_subtle_bg.wasm"),
    );
  } catch {
    // not available
  }

  // 3. Relative to source (development fallback)
  candidates.push(
    join(__dir, "../../node_modules/wasm-pqc-subtle/wasm_pqc_subtle_bg.wasm"),
  );

  for (const wasmPath of candidates) {
    try {
      const wasmBuffer = readFileSync(wasmPath);
      initSync({ module: wasmBuffer });
      wasmInitialized = true;
      return;
    } catch {
      // try next candidate
    }
  }

  const err = new Error(
    "Failed to initialize ML-KEM WASM module: WASM file not found in any candidate path",
  );
  console.error(err.message);
  throw err;
}

export type DatabaseSnapshot = Record<string, Record<string, unknown>>;
export type EncryptionFailureReason = "missing_key" | "invalid_key";

export class DatabaseEncryptionError extends Error {
  reason: EncryptionFailureReason;

  constructor(reason: EncryptionFailureReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

// --- ML-KEM envelope ---

type MlKemEncryptedEnvelope = {
  version: 3;
  algorithm: "ml-kem-1024-aes-256-gcm";
  kemCiphertext: string; // ML-KEM-1024 ciphertext (base64)
  iv: string; // AES IV (base64)
  authTag: string; // AES auth tag (base64)
  ciphertext: string; // AES encrypted data (base64)
};

// --- ML-KEM keypair state ---

type MlKemKeyPair = {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
};

let serverKeyPair: MlKemKeyPair | null = null;
let keypairStore: KVNamespace | null = null;
let _keypairForceMemory = false;
let keypairStorePassphrase: string | undefined;

/**
 * Enable in-memory storage for keypair during tests.
 * Must be called before the keypair store is initialized.
 */
export function setKeypairForceMemory(force: boolean): void {
  _keypairForceMemory = force;
  keypairStore = null;
  keypairStorePassphrase = undefined;
}

async function getKeypairStore(): Promise<KVNamespace> {
  const runtimePassphrase =
    getDatabaseEncryptionKeyProvider().getEncryptionKey();
  if (keypairStore && keypairStorePassphrase === runtimePassphrase) {
    return keypairStore;
  }
  keypairStore = null;
  keypairStorePassphrase = undefined;

  // If a passphrase is available, encrypt the keypair store
  let encryptionProvider: PassphraseEncryptionProvider | undefined;
  if (runtimePassphrase) {
    encryptionProvider =
      await PassphraseEncryptionProvider.create(runtimePassphrase);
  }

  keypairStore = createKV({
    dbName: DEFAULT_KEYPAIR_STORE_DIR,
    forceMemory: _keypairForceMemory,
    encryptionProvider,
  });
  keypairStorePassphrase = runtimePassphrase;

  return keypairStore;
}

/**
 * Load or generate ML-KEM-1024 keypair.
 *
 * On first call, attempts to load the keypair from an idb-repo KV store
 * persisted in .proseva-data/ml-kem-keys/. If none exists, generates a new
 * keypair and saves it to the store automatically.
 */
async function getOrGenerateKeyPair(): Promise<MlKemKeyPair> {
  if (serverKeyPair) return serverKeyPair;

  ensureWasmInit();

  const store = await getKeypairStore();

  // Check if keypair store has existing data
  const allKeys = await store.list();
  const hasExistingData = allKeys.keys.length > 0;

  // Try to load existing keypair from KV store
  const pubArr = await kvGetJson<number[]>(store, "publicKey");
  const secArr = await kvGetJson<number[]>(store, "secretKey");

  if (pubArr && secArr) {
    serverKeyPair = {
      publicKey: new Uint8Array(pubArr),
      secretKey: new Uint8Array(secArr),
    };
    console.log("Loaded ML-KEM keypair from store");
    return serverKeyPair;
  }

  // If store has data but we couldn't decrypt it, abort
  if (hasExistingData) {
    throw new DatabaseEncryptionError(
      "invalid_key",
      "ML-KEM keypair store exists but cannot be decrypted. " +
        "This likely means the passphrase has changed. " +
        "Refusing to overwrite existing keypair to prevent data loss. " +
        "If you need to reset encryption, manually delete .proseva-data/ml-kem-keys/",
    );
  }

  // Generate new keypair (only if no existing data)
  const keypair = ml_kem_1024_generate_keypair();
  serverKeyPair = {
    publicKey: keypair.public_key,
    secretKey: keypair.secret_key,
  };

  // Persist to KV store
  try {
    await store.put("publicKey", Array.from(serverKeyPair.publicKey));
    await store.put("secretKey", Array.from(serverKeyPair.secretKey));
    console.log("Generated and saved new ML-KEM keypair to store");
  } catch {
    console.error("Failed to save ML-KEM keypair");
  }

  return serverKeyPair;
}

// --- Detection helpers ---

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDatabaseSnapshot(value: unknown): value is DatabaseSnapshot {
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) => isRecord(entry));
}

function isMlKemEnvelope(value: unknown): value is MlKemEncryptedEnvelope {
  if (!isRecord(value)) return false;
  return (
    value.version === 3 &&
    value.algorithm === "ml-kem-1024-aes-256-gcm" &&
    typeof value.kemCiphertext === "string" &&
    typeof value.iv === "string" &&
    typeof value.authTag === "string" &&
    typeof value.ciphertext === "string"
  );
}

function isV3Snapshot(input: DatabaseSnapshot): boolean {
  return isMlKemEnvelope(input[DB_ENCRYPTION_V3_PAYLOAD_KEY]);
}

export function isEncryptedSnapshot(input: DatabaseSnapshot): boolean {
  return isV3Snapshot(input);
}

// --- ML-KEM-1024 encryption/decryption ---

async function encryptV3Snapshot(
  input: DatabaseSnapshot,
): Promise<DatabaseSnapshot> {
  ensureWasmInit();

  const keypair = await getOrGenerateKeyPair();

  // Encapsulate to get a shared secret
  const encapResult = ml_kem_1024_encapsulate(keypair.publicKey);
  const sharedSecret = encapResult.shared_secret; // 32 bytes for AES-256

  // Encrypt the data with AES-256-GCM using the shared secret
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sharedSecret, iv);

  const plaintext = JSON.stringify(input);
  const ciphertextBuffer = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const envelope: MlKemEncryptedEnvelope = {
    version: 3,
    algorithm: "ml-kem-1024-aes-256-gcm",
    kemCiphertext: Buffer.from(encapResult.ciphertext).toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertextBuffer.toString("base64"),
  };

  return {
    [DB_ENCRYPTION_V3_PAYLOAD_KEY]: envelope,
  };
}

async function decryptV3Snapshot(
  input: DatabaseSnapshot,
): Promise<DatabaseSnapshot> {
  ensureWasmInit();

  const envelope = input[
    DB_ENCRYPTION_V3_PAYLOAD_KEY
  ] as MlKemEncryptedEnvelope;
  const keypair = await getOrGenerateKeyPair();

  // Decapsulate to recover the shared secret
  const kemCiphertext = Uint8Array.from(
    Buffer.from(envelope.kemCiphertext, "base64"),
  );
  let sharedSecret: Uint8Array;

  try {
    sharedSecret = ml_kem_1024_decapsulate(keypair.secretKey, kemCiphertext);
  } catch {
    throw new DatabaseEncryptionError(
      "invalid_key",
      `Failed to decrypt database with ML-KEM-1024.`,
    );
  }

  // Decrypt the data with AES-256-GCM
  const iv = Buffer.from(envelope.iv, "base64");
  const authTag = Buffer.from(envelope.authTag, "base64");
  const ciphertext = Buffer.from(envelope.ciphertext, "base64");

  let parsed: unknown;
  try {
    const decipher = createDecipheriv("aes-256-gcm", sharedSecret, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    parsed = JSON.parse(plaintext.toString("utf8"));
  } catch {
    throw new DatabaseEncryptionError(
      "invalid_key",
      `Failed to decrypt database. AES decryption failed.`,
    );
  }

  if (!isDatabaseSnapshot(parsed)) {
    throw new Error("Decrypted database payload is invalid.");
  }

  return parsed;
}

// --- Public API ---

/**
 * Decrypt a database snapshot. Only supports ML-KEM-1024 format.
 * Returns unencrypted snapshots as-is.
 */
export async function decryptSnapshot(
  input: DatabaseSnapshot,
): Promise<DatabaseSnapshot> {
  if (isV3Snapshot(input)) {
    return await decryptV3Snapshot(input);
  }

  // Unencrypted
  return input;
}

/**
 * Encrypt a database snapshot using ML-KEM-1024 + AES-256-GCM.
 */
export async function encryptSnapshot(
  input: DatabaseSnapshot,
): Promise<DatabaseSnapshot> {
  return await encryptV3Snapshot(input);
}
