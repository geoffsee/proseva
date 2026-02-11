import { Router } from "itty-router";
import { db } from "./db";

const router = Router({ base: "/api/security" });

router.get("/status", () => {
  return Response.json(db.securityStatus());
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

    db.applyRecoveryKey(recoveryKey);
    db.flush();

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
