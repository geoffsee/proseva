import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  Database,
  clearDbEncryptionPassphrase,
  setDbEncryptionPassphrase,
  type PersistenceAdapter,
  type Case,
} from "./db";
import { encryptSnapshot, type DatabaseSnapshot } from "./encryption";
import { InMemoryAdapter, StorageEncryptionError } from "./persistence";

describe("Database", () => {
  let adapter: InMemoryAdapter;
  let database: Database;
  const originalEncryptionKey = process.env.PROSEVA_DB_ENCRYPTION_KEY;

  beforeEach(async () => {
    if (originalEncryptionKey) {
      await setDbEncryptionPassphrase(originalEncryptionKey);
    } else {
      clearDbEncryptionPassphrase();
    }
    delete process.env.PROSEVA_DB_ENCRYPTION_KEY;
    adapter = new InMemoryAdapter();
    database = await Database.create(adapter);
  });

  afterEach(async () => {
    if (originalEncryptionKey) {
      await setDbEncryptionPassphrase(originalEncryptionKey);
    } else {
      clearDbEncryptionPassphrase();
    }
    if (originalEncryptionKey === undefined) {
      delete process.env.PROSEVA_DB_ENCRYPTION_KEY;
    } else {
      process.env.PROSEVA_DB_ENCRYPTION_KEY = originalEncryptionKey;
    }
  });

  it("initializes with empty collections", () => {
    expect(database.cases.size).toBe(0);
    expect(database.contacts.size).toBe(0);
    expect(database.deadlines.size).toBe(0);
    expect(database.finances.size).toBe(0);
    expect(database.evidences.size).toBe(0);
    expect(database.filings.size).toBe(0);
  });

  it("loads existing data from adapter", async () => {
    await adapter.save({
      cases: { "1": { id: "1", name: "Test" } },
      contacts: {},
      deadlines: {},
      finances: {},
      evidences: {},
      filings: {},
    });
    const db2 = await Database.create(adapter);
    expect(db2.cases.size).toBe(1);
    expect(db2.cases.get("1")).toEqual({ id: "1", name: "Test" });
  });

  it("starts in locked mode when storage encryption key is missing", async () => {
    const lockedAdapter: PersistenceAdapter = {
      async load() {
        throw new StorageEncryptionError(
          "missing_key",
          "Database is encrypted but no encryption key is configured.",
        );
      },
      async save() {},
    };

    const lockedDb = await Database.create(lockedAdapter);
    expect(lockedDb.isLocked()).toBe(true);
    expect(lockedDb.securityStatus().lockReason).toBe("missing_key");
  });

  describe("persist", () => {
    it("debounces saves to the adapter", async () => {
      const saveSpy = vi.spyOn(adapter, "save");
      database.cases.set("1", { id: "1", name: "A" } as Case);
      database.persist();
      database.persist();
      database.persist();

      // Not saved yet (debounced)
      expect(saveSpy).not.toHaveBeenCalled();

      // Wait for debounce timer
      await new Promise((r) => setTimeout(r, 250));
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("flush", () => {
    it("saves immediately and clears pending timeout", async () => {
      const saveSpy = vi.spyOn(adapter, "save");
      database.cases.set("1", { id: "1", name: "A" } as Case);
      database.persist(); // schedule debounced save
      await database.flush(); // force immediate save

      expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it("saves even without a pending persist", async () => {
      const saveSpy = vi.spyOn(adapter, "save");
      await database.flush();
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("native DuckDB migration behavior", () => {
    it("persists plain snapshot payloads (no app-layer envelope)", async () => {
      database.cases.set("1", { id: "1", name: "Plain" } as Case);
      await database.flush();

      const raw = await adapter.load();
      expect(raw).toHaveProperty("cases");
      expect(raw.cases).toHaveProperty("1");
      expect(raw).not.toHaveProperty("__proseva_encrypted_v3");
    });

    it("loads and migrates legacy ML-KEM envelope snapshots", async () => {
      const legacySnapshot = await encryptSnapshot({
        cases: { "1": { id: "1", name: "Legacy" } },
      } as DatabaseSnapshot);
      await adapter.save(legacySnapshot);

      const db2 = await Database.create(adapter);
      expect(db2.cases.get("1")).toEqual({ id: "1", name: "Legacy" });

      const migrated = await adapter.load();
      expect(migrated).not.toHaveProperty("__proseva_encrypted_v3");
      expect(migrated.cases).toHaveProperty("1");
    });

    it("reports keyLoaded when an encryption key is configured", async () => {
      await setDbEncryptionPassphrase("test-passphrase");
      expect(database.securityStatus().keyLoaded).toBe(true);
    });
  });
});

describe("InMemoryAdapter", () => {
  it("round-trips data", async () => {
    const adapter = new InMemoryAdapter();
    const data = { cases: { "1": { id: "1" } } } as DatabaseSnapshot;
    await adapter.save(data);
    expect(await adapter.load()).toEqual(data);
  });

  it("returns cloned data (no shared references)", async () => {
    const adapter = new InMemoryAdapter();
    const data = {
      cases: { "1": { id: "1", nested: { value: "x" } } },
    } as DatabaseSnapshot;
    await adapter.save(data);

    const loaded = await adapter.load();
    expect(loaded).toEqual(data);
    expect(loaded).not.toBe(data);

    // Mutate the loaded data
    (loaded.cases["1"] as { nested: { value: string } }).nested.value =
      "changed";

    // Original should be unchanged
    expect(
      (data.cases["1"] as { nested: { value: string } }).nested.value,
    ).toBe("x");
  });
});
