import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSnapshot } from "./encryption";
import { DuckDbAdapter } from "./persistence";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "proseva-duckdb-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("DuckDbAdapter", () => {
  it("round-trips snapshot data", async () => {
    const dir = createTempDir();
    const dbPath = join(dir, "db.duckdb");
    const adapter = new DuckDbAdapter(dbPath);
    const snapshot = {
      cases: { "case-1": { id: "case-1", name: "Test Case" } },
      contacts: {},
      deadlines: {},
    } as DatabaseSnapshot;

    await adapter.save(snapshot);

    const loaded = await adapter.load();
    expect(loaded).toEqual(snapshot);
  });

  it("migrates from legacy db.json when duckdb is empty", async () => {
    const dir = createTempDir();
    const dbPath = join(dir, "db.duckdb");
    const legacySnapshot = {
      __proseva_encrypted_v3: {
        version: 3,
        algorithm: "ml-kem-1024-aes-256-gcm",
        kemCiphertext: "ciphertext",
        iv: "iv",
        authTag: "tag",
        ciphertext: "payload",
      },
    } as DatabaseSnapshot;
    writeFileSync(join(dir, "db.json"), JSON.stringify(legacySnapshot, null, 2));

    const adapter = new DuckDbAdapter(dbPath);
    const loaded = await adapter.load();
    expect(loaded).toEqual(legacySnapshot);

    rmSync(join(dir, "db.json"));
    expect(await adapter.load()).toEqual(legacySnapshot);
  });
});
