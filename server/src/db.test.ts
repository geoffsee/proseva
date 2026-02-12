import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  Database,
  clearDbEncryptionPassphrase,
  hasDbEncryptionPassphrase,
  setDbEncryptionPassphrase,
  type Case,
} from "./db";
import type { DatabaseSnapshot } from "./encryption";
import { InMemoryAdapter } from "./persistence";

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
    adapter.save({
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

  describe("persist", () => {
    it("debounces saves to the adapter", async () => {
      const saveSpy = vi.spyOn(adapter, "save");
      database.cases.set("1", { id: "1", name: "A" } as Case);
      database.persist();
      database.persist();
      database.persist();

      // Not saved yet (debounced)
      expect(saveSpy).not.toHaveBeenCalled();

      // Wait for debounce + async encrypt
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
      const saved = saveSpy.mock.calls[0][0];
      expect(saved.cases).toHaveProperty("1");
    });

    it("saves even without a pending persist", async () => {
      const saveSpy = vi.spyOn(adapter, "save");
      await database.flush();
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("encryption", () => {
    it("encrypts persisted payloads when key is configured", async () => {
      await setDbEncryptionPassphrase("test-encryption-key");
      database.cases.set("1", { id: "1", name: "Encrypted" } as Case);
      await database.flush();

      const raw = adapter.load();
      expect(raw).toHaveProperty("__proseva_encrypted_v2");
      expect(raw.cases).toBeUndefined();
    });

    it("decrypts previously encrypted payloads with the same key", async () => {
      await setDbEncryptionPassphrase("test-encryption-key");
      database.cases.set("1", { id: "1", name: "Encrypted" } as Case);
      await database.flush();

      const db2 = await Database.create(adapter);
      expect(db2.cases.get("1")).toEqual({ id: "1", name: "Encrypted" });
    });

    it("enters locked mode when reading encrypted data without a key", async () => {
      await setDbEncryptionPassphrase("test-encryption-key");
      database.cases.set("1", { id: "1", name: "Encrypted" } as Case);
      await database.flush();

      clearDbEncryptionPassphrase();
      const lockedDb = await Database.create(adapter);
      expect(lockedDb.isLocked()).toBe(true);
      expect(lockedDb.securityStatus().lockReason).toBe("missing_key");
    });

    it("enters locked mode when decryption key does not match", async () => {
      await setDbEncryptionPassphrase("test-encryption-key");
      database.cases.set("1", { id: "1", name: "Encrypted" } as Case);
      await database.flush();

      await setDbEncryptionPassphrase("wrong-key");
      const lockedDb = await Database.create(adapter);
      expect(lockedDb.isLocked()).toBe(true);
      expect(lockedDb.securityStatus().lockReason).toBe("invalid_key");
    });

    it("unlocks with recovery key after starting in locked mode", async () => {
      await setDbEncryptionPassphrase("test-encryption-key");
      database.cases.set("1", { id: "1", name: "Encrypted" } as Case);
      await database.flush();

      clearDbEncryptionPassphrase();
      const lockedDb = await Database.create(adapter);
      expect(lockedDb.isLocked()).toBe(true);

      await lockedDb.applyRecoveryKey("test-encryption-key");
      expect(lockedDb.isLocked()).toBe(false);
      expect(lockedDb.cases.get("1")).toEqual({ id: "1", name: "Encrypted" });
      expect(hasDbEncryptionPassphrase()).toBe(true);
    });

    it("rejects invalid recovery key when locked", async () => {
      await setDbEncryptionPassphrase("test-encryption-key");
      database.cases.set("1", { id: "1", name: "Encrypted" } as Case);
      await database.flush();

      clearDbEncryptionPassphrase();
      const lockedDb = await Database.create(adapter);
      await expect(lockedDb.applyRecoveryKey("wrong-key")).rejects.toThrow(
        "Invalid recovery key.",
      );
    });

    describe("ML-KEM-1024", () => {
      const originalMlKemSetting = process.env.PROSEVA_USE_ML_KEM;

      beforeEach(() => {
        process.env.PROSEVA_USE_ML_KEM = "true";
      });

      afterEach(() => {
        if (originalMlKemSetting === undefined) {
          delete process.env.PROSEVA_USE_ML_KEM;
        } else {
          process.env.PROSEVA_USE_ML_KEM = originalMlKemSetting;
        }
      });

      it("encrypts data using ML-KEM-1024 when enabled", async () => {
        database.cases.set("1", { id: "1", name: "ML-KEM Encrypted" } as Case);
        await database.flush();

        const raw = adapter.load();
        expect(raw).toHaveProperty("__proseva_encrypted_v3");
        expect(raw.__proseva_encrypted_v3).toHaveProperty("kemCiphertext");
        expect(raw.__proseva_encrypted_v3).toHaveProperty("algorithm", "ml-kem-1024-aes-256-gcm");
        expect(raw.cases).toBeUndefined();
      });

      it("decrypts ML-KEM-1024 encrypted data", async () => {
        database.cases.set("1", { id: "1", name: "ML-KEM Test" } as Case);
        await database.flush();

        const db2 = await Database.create(adapter);
        expect(db2.cases.get("1")).toEqual({ id: "1", name: "ML-KEM Test" });
      });

      it("round-trips data with ML-KEM-1024 encryption", async () => {
        const testData = {
          id: "test-123",
          name: "Complex Test Case",
          caseNumber: "2024-CV-001",
          court: "Circuit Court",
          caseType: "civil",
          status: "active" as const,
          parties: [
            { id: "p1", name: "John Doe", role: "Plaintiff", contact: "john@example.com" }
          ],
          filings: [],
          notes: "Test notes with special characters: éñ™£",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        database.cases.set(testData.id, testData as Case);
        await database.flush();

        const db2 = await Database.create(adapter);
        expect(db2.cases.get(testData.id)).toEqual(testData);
      });
    });
  });
});

describe("InMemoryAdapter", () => {
  it("round-trips data", () => {
    const adapter = new InMemoryAdapter();
    const data = { cases: { "1": { id: "1" } } } as DatabaseSnapshot;
    adapter.save(data);
    const loaded = adapter.load();
    expect(loaded).toEqual(data);
  });

  it("returns cloned data (no shared references)", () => {
    const adapter = new InMemoryAdapter();
    const data = { cases: { "1": { id: "1" } } } as DatabaseSnapshot;
    adapter.save(data);
    const a = adapter.load();
    const b = adapter.load();
    expect(a).not.toBe(b);
  });
});
