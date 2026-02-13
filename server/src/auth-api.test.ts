import { describe, it, expect, beforeEach } from "vitest";
import { db, initDb } from "./db";
import { authRouter } from "./auth-api";
import { hashPassphrase } from "./crypto-utils";

describe("Auth API", () => {
  beforeEach(async () => {
    await initDb(new (await import("./persistence")).InMemoryAdapter());

    // Set up passphrase hash (same as "testpass123")
    const hash = await hashPassphrase("testpass123");
    db.serverConfig.set("passphrase_hash", { hash } as any);
  });

  describe("POST /api/auth/login", () => {
    it("should return token on valid passphrase", async () => {
      const request = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: "testpass123" }),
      });

      const response = await authRouter.fetch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.token).toBeDefined();
      expect(typeof data.token).toBe("string");
      expect(data.expiresIn).toBeDefined();
      expect(data.expiresIn).toBeGreaterThan(0);
    });

    it("should return 401 on invalid passphrase", async () => {
      const request = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: "wrongpassword" }),
      });

      const response = await authRouter.fetch(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid passphrase");
    });

    it("should return 400 when passphrase is missing", async () => {
      const request = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const response = await authRouter.fetch(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("passphrase is required");
    });

    it("should return 404 when no passphrase is configured", async () => {
      // Remove passphrase hash
      db.serverConfig.delete("passphrase_hash");

      const request = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: "testpass123" }),
      });

      const response = await authRouter.fetch(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain("No passphrase configured");
    });

    it("should accept custom TTL parameter", async () => {
      const request = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: "testpass123", ttl: "1h" }),
      });

      const response = await authRouter.fetch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.expiresIn).toBe(3600); // 1 hour in seconds
    });

    it("should reject invalid TTL format", async () => {
      const request = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: "testpass123", ttl: "invalid" }),
      });

      const response = await authRouter.fetch(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid TTL format");
    });
  });
});
