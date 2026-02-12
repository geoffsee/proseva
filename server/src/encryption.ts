/**
 * Database encryption module with ML-KEM-1024 post-quantum encryption.
 *
 * V3 (current): ML-KEM-1024 key encapsulation + AES-256-GCM
 * V2: PBKDF2 + AES-256-GCM via idb-repo
 * V1 (legacy): Hand-rolled AES-256-GCM
 *
 * Maintains backward compatibility with v1 and v2 formats for reading.
 */
import { PassphraseEncryptionProvider } from "idb-repo";
import { createDecipheriv, pbkdf2Sync, createCipheriv, randomBytes } from "node:crypto";
import { initSync, ml_kem_1024_generate_keypair, ml_kem_1024_encapsulate, ml_kem_1024_decapsulate } from "wasm-pqc-subtle";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const __dir =
  import.meta.dir ??
  import.meta.dirname ??
  new URL(".", import.meta.url).pathname;

const DB_ENCRYPTION_KEY_ENV_VAR = "PROSEVA_DB_ENCRYPTION_KEY";
const DB_ENCRYPTION_PAYLOAD_KEY = "__proseva_encrypted";
const DB_ENCRYPTION_V2_PAYLOAD_KEY = "__proseva_encrypted_v2";
const DB_ENCRYPTION_V3_PAYLOAD_KEY = "__proseva_encrypted_v3";
const USE_ML_KEM_ENV_VAR = "PROSEVA_USE_ML_KEM";
const ML_KEM_KEYPAIR_FILE_ENV_VAR = "PROSEVA_ML_KEM_KEYPAIR_FILE";
const KEYPAIR_FILE_PERMISSIONS = 0o600;

// Initialize ML-KEM WASM module
let wasmInitialized = false;
function ensureWasmInit(): void {
  if (wasmInitialized) return;
  try {
    // Try multiple path resolution strategies for robustness
    let wasmPath: string;
    try {
      // First, try to resolve from node_modules
      const resolvedPath = require.resolve("wasm-pqc-subtle/wasm_pqc_subtle_bg.wasm");
      wasmPath = resolvedPath;
    } catch {
      // Fallback to relative path
      wasmPath = join(__dir, "../../node_modules/wasm-pqc-subtle/wasm_pqc_subtle_bg.wasm");
    }
    
    const wasmBuffer = readFileSync(wasmPath);
    initSync({ module: wasmBuffer });
    wasmInitialized = true;
  } catch (err) {
    console.error("Failed to initialize ML-KEM WASM module:", err);
    throw err;
  }
}

function shouldUseMlKem(): boolean {
  return process.env[USE_ML_KEM_ENV_VAR] === "true";
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

// --- Legacy v1 envelope types (for backward compat) ---

type LegacyEncryptedEnvelope = {
  version: 1;
  algorithm: "aes-256-gcm";
  kdf: "pbkdf2-sha256";
  iterations: number;
  salt: string;
  iv: string;
  authTag: string;
  ciphertext: string;
};

// --- V3 envelope (ML-KEM-1024 + AES-256-GCM) ---

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

type SerializedKeyPair = {
  publicKey: string;
  secretKey: string;
};

let serverKeyPair: MlKemKeyPair | null = null;

/**
 * Load or generate ML-KEM-1024 keypair.
 * 
 * If PROSEVA_ML_KEM_KEYPAIR_FILE is set, attempts to load the keypair from that file.
 * If the file doesn't exist or the variable is not set, generates a new keypair.
 * 
 * WARNING: In production, the keypair must be persisted to decrypt previously encrypted data.
 * Without persistence, data encrypted with one keypair cannot be decrypted after server restart.
 */
function getOrGenerateKeyPair(): MlKemKeyPair {
  if (serverKeyPair) return serverKeyPair;
  
  ensureWasmInit();
  
  const keypairFile = process.env[ML_KEM_KEYPAIR_FILE_ENV_VAR];
  
  // Try to load existing keypair from file
  if (keypairFile) {
    try {
      const keypairData = readFileSync(keypairFile, "utf8");
      const serialized: SerializedKeyPair = JSON.parse(keypairData);
      serverKeyPair = {
        publicKey: Uint8Array.from(Buffer.from(serialized.publicKey, "base64")),
        secretKey: Uint8Array.from(Buffer.from(serialized.secretKey, "base64")),
      };
      console.log("Loaded ML-KEM keypair from:", keypairFile);
      return serverKeyPair;
    } catch (err) {
      console.warn("Failed to load ML-KEM keypair from file, generating new one:", err);
    }
  }
  
  // Generate new keypair
  const keypair = ml_kem_1024_generate_keypair();
  serverKeyPair = {
    publicKey: keypair.public_key,
    secretKey: keypair.secret_key,
  };
  
  // Save keypair if file path is specified
  if (keypairFile) {
    try {
      const serialized: SerializedKeyPair = {
        publicKey: Buffer.from(serverKeyPair.publicKey).toString("base64"),
        secretKey: Buffer.from(serverKeyPair.secretKey).toString("base64"),
      };
      writeFileSync(keypairFile, JSON.stringify(serialized, null, 2), { mode: KEYPAIR_FILE_PERMISSIONS });
      console.log("Saved ML-KEM keypair to:", keypairFile);
    } catch (err) {
      console.error("Failed to save ML-KEM keypair:", err);
    }
  } else {
    console.warn(
      "ML-KEM keypair generated but not persisted. " +
      `Set ${ML_KEM_KEYPAIR_FILE_ENV_VAR} to persist the keypair for production use.`
    );
  }
  
  return serverKeyPair;
}

// --- Passphrase state ---

export function normalizePassphrase(
  raw: string | undefined,
): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (
    trimmed.toLowerCase() === "undefined" ||
    trimmed.toLowerCase() === "null"
  ) {
    return undefined;
  }
  return trimmed.length > 0 ? trimmed : undefined;
}

let runtimePassphrase = normalizePassphrase(
  process.env[DB_ENCRYPTION_KEY_ENV_VAR],
);

let provider: PassphraseEncryptionProvider | null = null;

export function getPassphrase(): string | undefined {
  return runtimePassphrase;
}

export async function setPassphrase(passphrase: string): Promise<void> {
  runtimePassphrase = normalizePassphrase(passphrase);
  if (runtimePassphrase) {
    provider = await PassphraseEncryptionProvider.create(runtimePassphrase);
  } else {
    provider = null;
  }
}

export function clearPassphrase(): void {
  runtimePassphrase = undefined;
  provider = null;
}

export function hasPassphrase(): boolean {
  return runtimePassphrase !== undefined;
}

async function getProvider(): Promise<PassphraseEncryptionProvider | null> {
  if (provider) return provider;
  if (!runtimePassphrase) return null;
  provider = await PassphraseEncryptionProvider.create(runtimePassphrase);
  return provider;
}

// --- Detection helpers ---

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDatabaseSnapshot(value: unknown): value is DatabaseSnapshot {
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) => isRecord(entry));
}

function isLegacyEnvelope(value: unknown): value is LegacyEncryptedEnvelope {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    value.algorithm === "aes-256-gcm" &&
    value.kdf === "pbkdf2-sha256" &&
    typeof value.iterations === "number" &&
    typeof value.salt === "string" &&
    typeof value.iv === "string" &&
    typeof value.authTag === "string" &&
    typeof value.ciphertext === "string"
  );
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

function isV2Snapshot(input: DatabaseSnapshot): boolean {
  return (
    typeof input[DB_ENCRYPTION_V2_PAYLOAD_KEY] === "object" &&
    typeof (input[DB_ENCRYPTION_V2_PAYLOAD_KEY] as Record<string, unknown>)
      ?.ciphertext === "string"
  );
}

function isV3Snapshot(input: DatabaseSnapshot): boolean {
  return isMlKemEnvelope(input[DB_ENCRYPTION_V3_PAYLOAD_KEY]);
}

function isLegacySnapshot(input: DatabaseSnapshot): boolean {
  return isLegacyEnvelope(input[DB_ENCRYPTION_PAYLOAD_KEY]);
}

export function isEncryptedSnapshot(input: DatabaseSnapshot): boolean {
  return isV3Snapshot(input) || isV2Snapshot(input) || isLegacySnapshot(input);
}

// --- Legacy v1 decryption (backward compat, read-only) ---

function decryptLegacySnapshot(
  input: DatabaseSnapshot,
  passphrase: string,
): DatabaseSnapshot {
  const envelope = input[DB_ENCRYPTION_PAYLOAD_KEY] as LegacyEncryptedEnvelope;

  const salt = Buffer.from(envelope.salt, "base64");
  const iv = Buffer.from(envelope.iv, "base64");
  const authTag = Buffer.from(envelope.authTag, "base64");
  const ciphertext = Buffer.from(envelope.ciphertext, "base64");

  const key = pbkdf2Sync(passphrase, salt, envelope.iterations, 32, "sha256");

  let parsed: unknown;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    parsed = JSON.parse(plaintext.toString("utf8"));
  } catch {
    throw new DatabaseEncryptionError(
      "invalid_key",
      `Failed to decrypt database. Check ${DB_ENCRYPTION_KEY_ENV_VAR}.`,
    );
  }

  if (!isDatabaseSnapshot(parsed)) {
    throw new Error("Decrypted database payload is invalid.");
  }

  return parsed;
}

// --- V2 decryption (idb-repo PassphraseEncryptionProvider) ---

async function decryptV2Snapshot(
  input: DatabaseSnapshot,
  passphraseOverride?: string,
): Promise<DatabaseSnapshot> {
  const passphrase =
    normalizePassphrase(passphraseOverride) ?? runtimePassphrase;
  if (!passphrase) {
    throw new DatabaseEncryptionError(
      "missing_key",
      `Database is encrypted. Set ${DB_ENCRYPTION_KEY_ENV_VAR} to decrypt it.`,
    );
  }

  const envelope = input[DB_ENCRYPTION_V2_PAYLOAD_KEY] as {
    ciphertext: string;
  };
  const encrypted = Uint8Array.from(Buffer.from(envelope.ciphertext, "base64"));

  let parsed: unknown;
  try {
    // Extract the embedded salt (first 16 bytes) so the provider derives the
    // correct key — PassphraseEncryptionProvider.decrypt() uses the provider's
    // own salt, not the one embedded in the ciphertext.
    const embeddedSalt = encrypted.slice(0, 16);
    const p = await PassphraseEncryptionProvider.create(
      passphrase,
      embeddedSalt,
    );
    const plaintext = await p.decrypt(encrypted);
    parsed = JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new DatabaseEncryptionError(
      "invalid_key",
      `Failed to decrypt database. Check ${DB_ENCRYPTION_KEY_ENV_VAR}.`,
    );
  }

  if (!isDatabaseSnapshot(parsed)) {
    throw new Error("Decrypted database payload is invalid.");
  }

  return parsed;
}

// --- V3 ML-KEM-1024 encryption/decryption ---

function encryptV3Snapshot(input: DatabaseSnapshot): DatabaseSnapshot {
  ensureWasmInit();
  
  const keypair = getOrGenerateKeyPair();
  
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

function decryptV3Snapshot(input: DatabaseSnapshot): DatabaseSnapshot {
  ensureWasmInit();
  
  const envelope = input[DB_ENCRYPTION_V3_PAYLOAD_KEY] as MlKemEncryptedEnvelope;
  const keypair = getOrGenerateKeyPair();
  
  // Decapsulate to recover the shared secret
  const kemCiphertext = Uint8Array.from(Buffer.from(envelope.kemCiphertext, "base64"));
  let sharedSecret: Uint8Array;
  
  try {
    sharedSecret = ml_kem_1024_decapsulate(keypair.secretKey, kemCiphertext);
  } catch (err) {
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
  } catch (err) {
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
 * Decrypt a database snapshot. Supports v3 (ML-KEM-1024), v2 (idb-repo), and v1 (legacy).
 * Returns unencrypted snapshots as-is.
 */
export async function decryptSnapshot(
  input: DatabaseSnapshot,
  passphraseOverride?: string,
): Promise<DatabaseSnapshot> {
  // V3 format (ML-KEM-1024 + AES-256-GCM)
  if (isV3Snapshot(input)) {
    return decryptV3Snapshot(input);
  }

  // V2 format (idb-repo PassphraseEncryptionProvider)
  if (isV2Snapshot(input)) {
    return decryptV2Snapshot(input, passphraseOverride);
  }

  // Legacy v1 format (hand-rolled AES-256-GCM)
  if (isLegacySnapshot(input)) {
    const passphrase =
      normalizePassphrase(passphraseOverride) ?? runtimePassphrase;
    if (!passphrase) {
      throw new DatabaseEncryptionError(
        "missing_key",
        `Database is encrypted. Set ${DB_ENCRYPTION_KEY_ENV_VAR} to decrypt it.`,
      );
    }
    return decryptLegacySnapshot(input, passphrase);
  }

  // Unencrypted
  return input;
}

/**
 * Encrypt a database snapshot.
 * 
 * Uses ML-KEM-1024 + AES-256-GCM (V3) when PROSEVA_USE_ML_KEM=true.
 * Otherwise uses PBKDF2 + AES-256-GCM (V2) when a passphrase is configured.
 * Returns unencrypted if no passphrase is set and ML-KEM is not enabled.
 */
export async function encryptSnapshot(
  input: DatabaseSnapshot,
): Promise<DatabaseSnapshot> {
  // Use ML-KEM-1024 if enabled
  if (shouldUseMlKem()) {
    return encryptV3Snapshot(input);
  }

  // Fallback to passphrase-based encryption if configured
  const p = await getProvider();
  if (!p) return input;

  const plaintext = new TextEncoder().encode(JSON.stringify(input));
  const encrypted = await p.encrypt(plaintext);
  const ciphertext = Buffer.from(encrypted).toString("base64");

  return {
    [DB_ENCRYPTION_V2_PAYLOAD_KEY]: { ciphertext },
  };
}

export { DB_ENCRYPTION_KEY_ENV_VAR, USE_ML_KEM_ENV_VAR, ML_KEM_KEYPAIR_FILE_ENV_VAR };
