import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearDbEncryptionPassphrase } from "./db";
import { api, setupTestServer } from "./test-helpers";

const ctx = setupTestServer();

describe("auth API", () => {
  beforeEach(() => {
    clearDbEncryptionPassphrase();
  });

  afterEach(() => {
    clearDbEncryptionPassphrase();
  });

  it("returns error when no passphrase is configured", async () => {
    const res = await api.post(
      "/api/auth/login",
      { passphrase: "test-pass" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("No passphrase configured");
  });

  it("returns token on successful login", async () => {
    // First, set up a passphrase
    await api.post(
      "/api/security/setup-passphrase",
      { passphrase: "test-passphrase-123" },
      ctx.baseUrl,
    );

    // Now try to login
    const res = await api.post(
      "/api/auth/login",
      { passphrase: "test-passphrase-123" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe("string");
    expect(body.expiresAt).toBeDefined();
  });

  it("returns error on incorrect passphrase", async () => {
    // Set up a passphrase
    await api.post(
      "/api/security/setup-passphrase",
      { passphrase: "correct-pass" },
      ctx.baseUrl,
    );

    // Try to login with wrong passphrase
    const res = await api.post(
      "/api/auth/login",
      { passphrase: "wrong-pass" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("Invalid passphrase");
  });

  it("verifies valid token", async () => {
    // Set up passphrase and login
    await api.post(
      "/api/security/setup-passphrase",
      { passphrase: "test-pass" },
      ctx.baseUrl,
    );
    const loginRes = await api.post(
      "/api/auth/login",
      { passphrase: "test-pass" },
      ctx.baseUrl,
    );
    const loginBody = await loginRes.json();
    const token = loginBody.token;

    // Verify token
    const verifyRes = await fetch(`${ctx.baseUrl}/api/auth/verify`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(verifyRes.status).toBe(200);
    const verifyBody = await verifyRes.json();
    expect(verifyBody.valid).toBe(true);
  });

  it("rejects invalid token", async () => {
    const verifyRes = await fetch(`${ctx.baseUrl}/api/auth/verify`, {
      method: "GET",
      headers: {
        Authorization: "Bearer invalid-token-12345",
      },
    });
    expect(verifyRes.status).toBe(401);
    const verifyBody = await verifyRes.json();
    expect(verifyBody.valid).toBe(false);
  });

  it("rejects missing token", async () => {
    const verifyRes = await fetch(`${ctx.baseUrl}/api/auth/verify`, {
      method: "GET",
    });
    expect(verifyRes.status).toBe(401);
    const verifyBody = await verifyRes.json();
    expect(verifyBody.valid).toBe(false);
  });

  it("allows logout with valid token", async () => {
    // Set up passphrase and login
    await api.post(
      "/api/security/setup-passphrase",
      { passphrase: "test-pass" },
      ctx.baseUrl,
    );
    const loginRes = await api.post(
      "/api/auth/login",
      { passphrase: "test-pass" },
      ctx.baseUrl,
    );
    const loginBody = await loginRes.json();
    const token = loginBody.token;

    // Logout
    const logoutRes = await fetch(`${ctx.baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(logoutRes.status).toBe(200);
    const logoutBody = await logoutRes.json();
    expect(logoutBody.success).toBe(true);

    // Verify token is no longer valid
    const verifyRes = await fetch(`${ctx.baseUrl}/api/auth/verify`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(verifyRes.status).toBe(401);
  });

  it("blocks non-auth routes without token", async () => {
    // Set up passphrase
    await api.post(
      "/api/security/setup-passphrase",
      { passphrase: "test-pass" },
      ctx.baseUrl,
    );

    // Try to access cases without token
    const res = await api.get("/api/cases", ctx.baseUrl);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("allows access to non-auth routes with valid token", async () => {
    // Set up passphrase and login
    await api.post(
      "/api/security/setup-passphrase",
      { passphrase: "test-pass" },
      ctx.baseUrl,
    );
    const loginRes = await api.post(
      "/api/auth/login",
      { passphrase: "test-pass" },
      ctx.baseUrl,
    );
    const loginBody = await loginRes.json();
    const token = loginBody.token;

    // Access cases with token
    const res = await fetch(`${ctx.baseUrl}/api/cases`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(res.status).toBe(200);
  });
});
