import { AutoRouter } from "itty-router";
import { db, setDbEncryptionPassphrase } from "./db";
import { hashPassphrase, verifyPassphrase } from "./crypto-utils";
import { asIttyRoute, json, openapiFormat } from "./openapi";

const PASSPHRASE_HASH_KEY = "passphrase_hash";

const router = AutoRouter({ base: "/api", format: openapiFormat });

router.get(
  "/security/status",
  asIttyRoute("get", "/security/status", () => {
    const base = db.securityStatus();
    const hasPassphrase = db.serverConfig.has(PASSPHRASE_HASH_KEY);
    return { ...base, passphraseConfigured: hasPassphrase };
  }),
);

router.post(
  "/security/setup-passphrase",
  asIttyRoute("post", "/security/setup-passphrase", async (req) => {
    try {
      const body = await req.json();
      const passphrase =
        typeof body?.passphrase === "string" ? body.passphrase.trim() : "";

      if (!passphrase) {
        return json(400, { success: false, error: "passphrase is required" });
      }

      if (passphrase.length < 8) {
        return json(400, {
          success: false,
          error: "Passphrase must be at least 8 characters.",
        });
      }

      const hash = await hashPassphrase(passphrase);
      // @ts-expect-error - storing internal server state in serverConfig map
      db.serverConfig.set(PASSPHRASE_HASH_KEY, { hash });
      db.persist();

      // Use this passphrase for encrypting the database and keypair store
      await setDbEncryptionPassphrase(passphrase);

      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to set passphrase.";
      return json(500, { success: false, error: message });
    }
  }),
);

router.post(
  "/security/verify-passphrase",
  asIttyRoute("post", "/security/verify-passphrase", async (req) => {
    try {
      const body = await req.json();
      const passphrase =
        typeof body?.passphrase === "string" ? body.passphrase.trim() : "";

      if (!passphrase) {
        return json(400, { valid: false, error: "passphrase is required" });
      }

      const entry = db.serverConfig.get(PASSPHRASE_HASH_KEY) as
        | { hash: string }
        | undefined;
      if (!entry?.hash) {
        return json(404, { valid: false, error: "No passphrase configured." });
      }

      const valid = await verifyPassphrase(passphrase, entry.hash);
      if (!valid) {
        return json(401, { valid: false, error: "Invalid passphrase." });
      }

      // Apply this passphrase for encrypting the database and keypair store
      await setDbEncryptionPassphrase(passphrase);

      return { valid: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to verify passphrase.";
      return json(500, { valid: false, error: message });
    }
  }),
);

router.post(
  "/security/recovery-key",
  asIttyRoute("post", "/security/recovery-key", async (req) => {
    try {
      const body = await req.json();
      const recoveryKey =
        typeof body?.recoveryKey === "string" ? body.recoveryKey : "";

      if (!recoveryKey.trim()) {
        return json(400, { success: false, error: "recoveryKey is required" });
      }

      await db.applyRecoveryKey(recoveryKey);
      await db.flush();

      const hasPassphrase = db.serverConfig.has(PASSPHRASE_HASH_KEY);
      return {
        success: true,
        status: { ...db.securityStatus(), passphraseConfigured: hasPassphrase },
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to apply recovery key.";
      const status = message === "Invalid recovery key." ? 401 : 400;
      return json(status, { success: false, error: message });
    }
  }),
);

export { router as securityRouter };
