/**
 * Database encryption module using idb-repo's PassphraseEncryptionProvider.
 *
 * Uses PBKDF2 + AES-256-GCM via idb-repo. Each encrypted value embeds its own
 * salt (44 bytes overhead), so any provider created with the same passphrase
 * can decrypt data regardless of which instance encrypted it.
 *
 * Maintains backward compatibility with the legacy v1 envelope format
 * (hand-rolled AES-256-GCM) for reading existing encrypted databases.
 */
import { PassphraseEncryptionProvider } from "idb-repo";
import { createDecipheriv, pbkdf2Sync } from "node:crypto";

const DB_ENCRYPTION_KEY_ENV_VAR = "PROSEVA_DB_ENCRYPTION_KEY";
const DB_ENCRYPTION_PAYLOAD_KEY = "__proseva_encrypted";
const DB_ENCRYPTION_V2_PAYLOAD_KEY = "__proseva_encrypted_v2";

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

function isV2Snapshot(input: DatabaseSnapshot): boolean {
  return (
    typeof input[DB_ENCRYPTION_V2_PAYLOAD_KEY] === "object" &&
    typeof (input[DB_ENCRYPTION_V2_PAYLOAD_KEY] as Record<string, unknown>)
      ?.ciphertext === "string"
  );
}

function isLegacySnapshot(input: DatabaseSnapshot): boolean {
  return isLegacyEnvelope(input[DB_ENCRYPTION_PAYLOAD_KEY]);
}

export function isEncryptedSnapshot(input: DatabaseSnapshot): boolean {
  return isV2Snapshot(input) || isLegacySnapshot(input);
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

// --- Public API ---

/**
 * Decrypt a database snapshot. Supports both v2 (idb-repo) and legacy v1 format.
 * Returns unencrypted snapshots as-is.
 */
export async function decryptSnapshot(
  input: DatabaseSnapshot,
  passphraseOverride?: string,
): Promise<DatabaseSnapshot> {
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
 * Encrypt a database snapshot using idb-repo's PassphraseEncryptionProvider.
 * Returns unencrypted if no passphrase is set.
 */
export async function encryptSnapshot(
  input: DatabaseSnapshot,
): Promise<DatabaseSnapshot> {
  const p = await getProvider();
  if (!p) return input;

  const plaintext = new TextEncoder().encode(JSON.stringify(input));
  const encrypted = await p.encrypt(plaintext);
  const ciphertext = Buffer.from(encrypted).toString("base64");

  return {
    [DB_ENCRYPTION_V2_PAYLOAD_KEY]: { ciphertext },
  };
}

export { DB_ENCRYPTION_KEY_ENV_VAR };
