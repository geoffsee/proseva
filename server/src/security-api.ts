import { Router } from "itty-router";
import { db } from "./db";

const PASSPHRASE_HASH_KEY = "passphrase_hash";

async function hashPassphrase(passphrase: string): Promise<string> {
  return Bun.password.hash(passphrase, { algorithm: "bcrypt", cost: 12 });
}

async function verifyPassphrase(
  passphrase: string,
  hash: string,
): Promise<boolean> {
  return Bun.password.verify(passphrase, hash);
}

const router = Router({ base: "/api/security" });

router.get("/status", () => {
  const base = db.securityStatus();
  const hasPassphrase = db.serverConfig.has(PASSPHRASE_HASH_KEY);
  return Response.json({ ...base, passphraseConfigured: hasPassphrase });
});

router.post("/setup-passphrase", async (req) => {
  try {
    const body = await req.json();
    const passphrase =
      typeof body?.passphrase === "string" ? body.passphrase.trim() : "";

    if (!passphrase) {
      return Response.json(
        { success: false, error: "passphrase is required" },
        { status: 400 },
      );
    }

    if (passphrase.length < 8) {
      return Response.json(
        { success: false, error: "Passphrase must be at least 8 characters." },
        { status: 400 },
      );
    }

    const hash = await hashPassphrase(passphrase);
    db.serverConfig.set(PASSPHRASE_HASH_KEY, { hash } as any);
    db.persist();

    return Response.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to set passphrase.";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
});

router.post("/verify-passphrase", async (req) => {
  try {
    const body = await req.json();
    const passphrase =
      typeof body?.passphrase === "string" ? body.passphrase.trim() : "";

    if (!passphrase) {
      return Response.json(
        { valid: false, error: "passphrase is required" },
        { status: 400 },
      );
    }

    const entry = db.serverConfig.get(PASSPHRASE_HASH_KEY) as
      | { hash: string }
      | undefined;
    if (!entry?.hash) {
      return Response.json(
        { valid: false, error: "No passphrase configured." },
        { status: 404 },
      );
    }

    const valid = await verifyPassphrase(passphrase, entry.hash);
    if (!valid) {
      return Response.json(
        { valid: false, error: "Invalid passphrase." },
        { status: 401 },
      );
    }

    return Response.json({ valid: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify passphrase.";
    return Response.json({ valid: false, error: message }, { status: 500 });
  }
});

router.post("/recovery-key", async (req) => {
  try {
    const body = await req.json();
    const recoveryKey =
      typeof body?.recoveryKey === "string" ? body.recoveryKey : "";

    if (!recoveryKey.trim()) {
      return Response.json(
        { success: false, error: "recoveryKey is required" },
        { status: 400 },
      );
    }

    await db.applyRecoveryKey(recoveryKey);
    await db.flush();

    return Response.json({
      success: true,
      status: db.securityStatus(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to apply recovery key.";
    const status = message === "Invalid recovery key." ? 401 : 400;
    return Response.json(
      { success: false, error: message },
      { status },
    );
  }
});

export { router as securityRouter };
