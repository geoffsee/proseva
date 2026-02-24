const DB_ENCRYPTION_KEY_ENV_VAR = "PROSEVA_DB_ENCRYPTION_KEY";

export interface DatabaseEncryptionKeyProvider {
  getEncryptionKey(): string | undefined;
}

export function normalizeEncryptionKey(
  raw: string | undefined,
): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (
    trimmed.length === 0 ||
    trimmed.toLowerCase() === "undefined" ||
    trimmed.toLowerCase() === "null"
  ) {
    return undefined;
  }
  return trimmed;
}

let runtimeEncryptionKey = normalizeEncryptionKey(
  process.env[DB_ENCRYPTION_KEY_ENV_VAR],
);

class RuntimeDatabaseEncryptionKeyProvider implements DatabaseEncryptionKeyProvider {
  getEncryptionKey(): string | undefined {
    return runtimeEncryptionKey;
  }
}

const runtimeKeyProvider = new RuntimeDatabaseEncryptionKeyProvider();

export function getDatabaseEncryptionKeyProvider(): DatabaseEncryptionKeyProvider {
  return runtimeKeyProvider;
}

export async function setEncryptionKey(passphrase: string): Promise<void> {
  runtimeEncryptionKey = normalizeEncryptionKey(passphrase);
}

export function clearEncryptionKey(): void {
  runtimeEncryptionKey = undefined;
}

export function hasEncryptionKey(): boolean {
  return runtimeEncryptionKey !== undefined;
}

export { DB_ENCRYPTION_KEY_ENV_VAR };
