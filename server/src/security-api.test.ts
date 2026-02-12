import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearDbEncryptionPassphrase,
} from "./db";
import { api, setupTestServer } from "./test-helpers";

const ctx = setupTestServer();

describe("security API", () => {
  beforeEach(() => {
    clearDbEncryptionPassphrase();
  });

  afterEach(() => {
    clearDbEncryptionPassphrase();
  });

  it("returns unlocked status for ML-KEM encrypted databases", async () => {
    const res = await api.get("/api/security/status", ctx.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    // ML-KEM databases are never "locked" - they're always accessible via the keypair
    expect(body.locked).toBe(false);
    // encryptedAtRest is false until data is actually saved
    // ML-KEM always encrypts, so this will be true after first save
  });

  it("applies a passphrase to encrypt the keypair store", async () => {
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
});
