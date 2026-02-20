import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BlobStore } from "./blob-store";
import type { DatabaseEncryptionKeyProvider } from "./db-key-provider";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "proseva-blobstore-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const createProvider = (
  key: string | undefined,
): DatabaseEncryptionKeyProvider => ({
  getEncryptionKey: () => key,
});

describe("BlobStore", () => {
  it("stores and retrieves binary data", async () => {
    const dir = createTempDir();
    const store = new BlobStore(join(dir, "files.duckdb"));
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    await store.store("blob-1", data);
    const retrieved = await store.retrieve("blob-1");
    expect(retrieved).toEqual(data);
  });

  it("returns null for missing blobs", async () => {
    const dir = createTempDir();
    const store = new BlobStore(join(dir, "files.duckdb"));
    expect(await store.retrieve("nonexistent")).toBeNull();
  });

  it("deletes blobs", async () => {
    const dir = createTempDir();
    const store = new BlobStore(join(dir, "files.duckdb"));
    await store.store("blob-1", new Uint8Array([1]));
    expect(await store.delete("blob-1")).toBe(true);
    expect(await store.retrieve("blob-1")).toBeNull();
  });

  it("delete returns false for missing blobs", async () => {
    const dir = createTempDir();
    const store = new BlobStore(join(dir, "files.duckdb"));
    expect(await store.delete("nonexistent")).toBe(false);
  });

  it("has() checks existence", async () => {
    const dir = createTempDir();
    const store = new BlobStore(join(dir, "files.duckdb"));
    expect(await store.has("blob-1")).toBe(false);
    await store.store("blob-1", new Uint8Array([1]));
    expect(await store.has("blob-1")).toBe(true);
  });

  it("handles large blobs (1MB)", async () => {
    const dir = createTempDir();
    const store = new BlobStore(join(dir, "files.duckdb"));
    const large = new Uint8Array(1024 * 1024);
    for (let i = 0; i < large.length; i++) large[i] = i % 256;
    await store.store("large", large);
    const retrieved = await store.retrieve("large");
    expect(retrieved).toEqual(large);
  });

  it("overwrites existing blobs", async () => {
    const dir = createTempDir();
    const store = new BlobStore(join(dir, "files.duckdb"));
    await store.store("blob-1", new Uint8Array([1, 2, 3]));
    await store.store("blob-1", new Uint8Array([4, 5, 6]));
    const retrieved = await store.retrieve("blob-1");
    expect(retrieved).toEqual(new Uint8Array([4, 5, 6]));
  });

  it("works with encryption", async () => {
    const dir = createTempDir();
    const key = "abc123abc123abc123abc123abc12312";
    const store = new BlobStore(
      join(dir, "files.duckdb"),
      createProvider(key),
    );
    await store.store("enc-1", new Uint8Array([10, 20, 30]));

    const store2 = new BlobStore(
      join(dir, "files.duckdb"),
      createProvider(key),
    );
    expect(await store2.retrieve("enc-1")).toEqual(
      new Uint8Array([10, 20, 30]),
    );
  });

  it("computeHash returns consistent SHA-256 hex", () => {
    const data = new Uint8Array([1, 2, 3]);
    const hash1 = BlobStore.computeHash(data);
    const hash2 = BlobStore.computeHash(data);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });
});
