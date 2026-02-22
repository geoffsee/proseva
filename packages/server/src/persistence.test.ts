import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSnapshot } from "./encryption";
import {
  SqliteAdapter,
  type StorageEncryptionFailureReason,
} from "./persistence";
import type { DatabaseEncryptionKeyProvider } from "./db-key-provider";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "proseva-sqlite-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("SqliteAdapter", () => {
  const createProvider = (
    key: string | undefined,
  ): DatabaseEncryptionKeyProvider => ({
    getEncryptionKey: () => key,
  });

  it("round-trips snapshot data", async () => {
    const dir = createTempDir();
    const dbPath = join(dir, "db.sqlite");
    const adapter = new SqliteAdapter(dbPath);
    const snapshot = {
      cases: { "case-1": { id: "case-1", name: "Test Case" } },
      contacts: {},
      deadlines: {},
    } as DatabaseSnapshot;

    await adapter.save(snapshot);

    const loaded = await adapter.load();
    expect(loaded).toEqual(snapshot);
  });

  it("opens encrypted sqlite files with the configured key", async () => {
    const dir = createTempDir();
    const dbPath = join(dir, "db.sqlite");
    const key = "abc123abc123abc123abc123abc12312";
    const writer = new SqliteAdapter(dbPath, createProvider(key));
    const snapshot = {
      cases: { "enc-1": { id: "enc-1", name: "Encrypted Case" } },
    } as DatabaseSnapshot;
    await writer.save(snapshot);

    const reader = new SqliteAdapter(dbPath, createProvider(key));
    expect(await reader.load()).toEqual(snapshot);
  });

  it.skip("throws missing_key when opening encrypted files without a key", async () => {
    const dir = createTempDir();
    const dbPath = join(dir, "db.sqlite");
    const key = "abc123abc123abc123abc123abc12312";
    const writer = new SqliteAdapter(dbPath, createProvider(key));
    await writer.save({ cases: { "1": { id: "1" } } } as DatabaseSnapshot);

    const reader = new SqliteAdapter(dbPath, createProvider(undefined));
    await expect(reader.load()).rejects.toMatchObject({
      reason: "missing_key" satisfies StorageEncryptionFailureReason,
    });
  });

  it.skip("throws invalid_key when opening encrypted files with the wrong key", async () => {
    const dir = createTempDir();
    const dbPath = join(dir, "db.sqlite");
    const writer = new SqliteAdapter(
      dbPath,
      createProvider("abc123abc123abc123abc123abc12312"),
    );
    await writer.save({ cases: { "1": { id: "1" } } } as DatabaseSnapshot);

    const reader = new SqliteAdapter(
      dbPath,
      createProvider("ffffffffffffffffffffffffffffffff"),
    );
    await expect(reader.load()).rejects.toMatchObject({
      reason: "invalid_key" satisfies StorageEncryptionFailureReason,
    });
  });
});
