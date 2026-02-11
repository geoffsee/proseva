import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  Database,
  clearDbEncryptionPassphrase,
  hasDbEncryptionPassphrase,
  setDbEncryptionPassphrase,
} from "./db";
import { InMemoryAdapter } from "./persistence";

describe("Database", () => {
  let adapter: InMemoryAdapter;
  let database: Database;
  const originalEncryptionKey = process.env.PROSEVA_DB_ENCRYPTION_KEY;

  beforeEach(() => {
    if (originalEncryptionKey) {
      setDbEncryptionPassphrase(originalEncryptionKey);
    } else {
      clearDbEncryptionPassphrase();
    }
    delete process.env.PROSEVA_DB_ENCRYPTION_KEY;
    adapter = new InMemoryAdapter();
    database = new Database(adapter);
  });

  afterEach(() => {
    if (originalEncryptionKey) {
      setDbEncryptionPassphrase(originalEncryptionKey);
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

  it("loads existing data from adapter", () => {
    adapter.save({
      cases: { "1": { id: "1", name: "Test" } },
      contacts: {},
      deadlines: {},
      finances: {},
      evidences: {},
      filings: {},
    });
    const db2 = new Database(adapter);
    expect(db2.cases.size).toBe(1);
    expect(db2.cases.get("1")).toEqual({ id: "1", name: "Test" });
  });

  describe("persist", () => {
    it("debounces saves to the adapter", async () => {
      const saveSpy = vi.spyOn(adapter, "save");
      database.cases.set("1", { id: "1", name: "A" } as any);
      database.persist();
      database.persist();
      database.persist();

      // Not saved yet (debounced)
      expect(saveSpy).not.toHaveBeenCalled();

      // Wait for debounce
      await new Promise((r) => setTimeout(r, 150));
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("flush", () => {
    it("saves immediately and clears pending timeout", () => {
      const saveSpy = vi.spyOn(adapter, "save");
      database.cases.set("1", { id: "1", name: "A" } as any);
      database.persist(); // schedule debounced save
      database.flush(); // force immediate save

      expect(saveSpy).toHaveBeenCalledTimes(1);
      const saved = saveSpy.mock.calls[0][0];
      expect(saved.cases).toHaveProperty("1");
    });

    it("saves even without a pending persist", () => {
      const saveSpy = vi.spyOn(adapter, "save");
      database.flush();
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("encryption", () => {
    it("encrypts persisted payloads when key is configured", () => {
      setDbEncryptionPassphrase("test-encryption-key");
      database.cases.set("1", { id: "1", name: "Encrypted" } as any);
      database.flush();

      const raw = adapter.load();
      expect(raw).toHaveProperty("__proseva_encrypted");
      expect(raw.cases).toBeUndefined();
    });

    it("decrypts previously encrypted payloads with the same key", () => {
      setDbEncryptionPassphrase("test-encryption-key");
      database.cases.set("1", { id: "1", name: "Encrypted" } as any);
      database.flush();

      const db2 = new Database(adapter);
      expect(db2.cases.get("1")).toEqual({ id: "1", name: "Encrypted" });
    });

    it("enters locked mode when reading encrypted data without a key", () => {
      setDbEncryptionPassphrase("test-encryption-key");
      database.cases.set("1", { id: "1", name: "Encrypted" } as any);
      database.flush();

      clearDbEncryptionPassphrase();
      const lockedDb = new Database(adapter);
      expect(lockedDb.isLocked()).toBe(true);
      expect(lockedDb.securityStatus().lockReason).toBe("missing_key");
    });

    it("enters locked mode when decryption key does not match", () => {
      setDbEncryptionPassphrase("test-encryption-key");
      database.cases.set("1", { id: "1", name: "Encrypted" } as any);
      database.flush();

      setDbEncryptionPassphrase("wrong-key");
      const lockedDb = new Database(adapter);
      expect(lockedDb.isLocked()).toBe(true);
      expect(lockedDb.securityStatus().lockReason).toBe("invalid_key");
    });

    it("unlocks with recovery key after starting in locked mode", () => {
      setDbEncryptionPassphrase("test-encryption-key");
      database.cases.set("1", { id: "1", name: "Encrypted" } as any);
      database.flush();

      clearDbEncryptionPassphrase();
      const lockedDb = new Database(adapter);
      expect(lockedDb.isLocked()).toBe(true);

      lockedDb.applyRecoveryKey("test-encryption-key");
      expect(lockedDb.isLocked()).toBe(false);
      expect(lockedDb.cases.get("1")).toEqual({ id: "1", name: "Encrypted" });
      expect(hasDbEncryptionPassphrase()).toBe(true);
    });

    it("rejects invalid recovery key when locked", () => {
      setDbEncryptionPassphrase("test-encryption-key");
      database.cases.set("1", { id: "1", name: "Encrypted" } as any);
      database.flush();

      clearDbEncryptionPassphrase();
      const lockedDb = new Database(adapter);
      expect(() => lockedDb.applyRecoveryKey("wrong-key")).toThrow(
        "Invalid recovery key.",
      );
    });
  });
});

describe("InMemoryAdapter", () => {
  it("round-trips data", () => {
    const adapter = new InMemoryAdapter();
    const data = { cases: { "1": { id: "1" } } };
    adapter.save(data as any);
    const loaded = adapter.load();
    expect(loaded).toEqual(data);
  });

  it("returns cloned data (no shared references)", () => {
    const adapter = new InMemoryAdapter();
    const data = { cases: { "1": { id: "1" } } };
    adapter.save(data as any);
    const a = adapter.load();
    const b = adapter.load();
    expect(a).not.toBe(b);
  });
});
