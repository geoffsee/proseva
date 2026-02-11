import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  Database,
  clearDbEncryptionPassphrase,
  resetDb,
  setDbEncryptionPassphrase,
} from "./db";
import { InMemoryAdapter } from "./persistence";
import { api, setupTestServer } from "./test-helpers";

const ctx = setupTestServer();

describe("security API", () => {
  beforeEach(() => {
    clearDbEncryptionPassphrase();
  });

  afterEach(() => {
    clearDbEncryptionPassphrase();
  });

  it("returns unlocked status for plaintext databases", async () => {
    const res = await api.get("/api/security/status", ctx.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.locked).toBe(false);
    expect(body.encryptedAtRest).toBe(false);
    expect(body.keyLoaded).toBe(false);
  });

  it("applies a recovery key and marks key as loaded", async () => {
    const res = await api.post(
      "/api/security/recovery-key",
      { recoveryKey: "MY-RECOVERY-KEY-123" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.status.keyLoaded).toBe(true);
  });

  it("blocks non-security routes when db is locked and unlocks with valid recovery key", async () => {
    const adapter = new InMemoryAdapter();

    setDbEncryptionPassphrase("LOCKED-DB-KEY");
    const seededDb = new Database(adapter);
    seededDb.cases.set("case-1", {
      id: "case-1",
      name: "Locked Case",
      caseNumber: "",
      court: "",
      caseType: "",
      status: "active",
      parties: [],
      filings: [],
      notes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    seededDb.flush();

    clearDbEncryptionPassphrase();
    resetDb(adapter);

    const lockedCases = await api.get("/api/cases", ctx.baseUrl);
    expect(lockedCases.status).toBe(423);
    const lockedBody = await lockedCases.json();
    expect(lockedBody.code).toBe("DB_LOCKED");

    const wrongUnlock = await api.post(
      "/api/security/recovery-key",
      { recoveryKey: "WRONG-KEY" },
      ctx.baseUrl,
    );
    expect(wrongUnlock.status).toBe(401);

    const unlock = await api.post(
      "/api/security/recovery-key",
      { recoveryKey: "LOCKED-DB-KEY" },
      ctx.baseUrl,
    );
    expect(unlock.status).toBe(200);
    const unlockBody = await unlock.json();
    expect(unlockBody.success).toBe(true);
    expect(unlockBody.status.locked).toBe(false);

    const casesAfterUnlock = await api.get("/api/cases", ctx.baseUrl);
    expect(casesAfterUnlock.status).toBe(200);
    const casesBody = await casesAfterUnlock.json();
    expect(Array.isArray(casesBody)).toBe(true);
    expect(casesBody).toHaveLength(1);
    expect(casesBody[0].id).toBe("case-1");
  });
});
