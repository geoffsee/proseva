import { Router } from "itty-router";
import { db } from "./db";
import { randomBytes } from "crypto";

const PASSPHRASE_HASH_KEY = "passphrase_hash";
const AUTH_TOKENS_KEY = "auth_tokens";
const DEFAULT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type AuthToken = {
  token: string;
  hash: string;
  expiresAt: string;
  createdAt: string;
};

type StoredTokens = {
  tokens: AuthToken[];
};

async function hashPassphrase(passphrase: string): Promise<string> {
  return Bun.password.hash(passphrase, { algorithm: "bcrypt", cost: 12 });
}

async function verifyPassphrase(
  passphrase: string,
  hash: string,
): Promise<boolean> {
  return Bun.password.verify(passphrase, hash);
}

function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

async function hashToken(token: string): Promise<string> {
  return Bun.password.hash(token, { algorithm: "bcrypt", cost: 10 });
}

async function verifyToken(token: string, hash: string): Promise<boolean> {
  return Bun.password.verify(token, hash);
}

function getStoredTokens(): AuthToken[] {
  const entry = db.serverConfig.get(AUTH_TOKENS_KEY) as
    | StoredTokens
    | undefined;
  return entry?.tokens ?? [];
}

function saveTokens(tokens: AuthToken[]): void {
  db.serverConfig.set(AUTH_TOKENS_KEY, { tokens } as any);
  db.persist();
}

function cleanExpiredTokens(tokens: AuthToken[]): AuthToken[] {
  const now = Date.now();
  return tokens.filter((t) => new Date(t.expiresAt).getTime() > now);
}

export async function verifyBearerToken(token: string): Promise<boolean> {
  if (!token) return false;

  const allTokens = getStoredTokens();
  const validTokens = cleanExpiredTokens(allTokens);

  // Save cleaned tokens if any were expired
  if (validTokens.length !== allTokens.length) {
    saveTokens(validTokens);
  }

  for (const storedToken of validTokens) {
    if (await verifyToken(token, storedToken.hash)) {
      return true;
    }
  }

  return false;
}

const router = Router({ base: "/api/auth" });

router.post("/login", async (req) => {
  try {
    const body = await req.json();
    const passphrase =
      typeof body?.passphrase === "string" ? body.passphrase.trim() : "";
    const ttl = typeof body?.ttl === "number" ? body.ttl : DEFAULT_TOKEN_TTL_MS;

    if (!passphrase) {
      return Response.json(
        { success: false, error: "passphrase is required" },
        { status: 400 },
      );
    }

    // Verify passphrase against stored hash
    const entry = db.serverConfig.get(PASSPHRASE_HASH_KEY) as
      | { hash: string }
      | undefined;

    if (!entry?.hash) {
      return Response.json(
        { success: false, error: "No passphrase configured." },
        { status: 404 },
      );
    }

    const valid = await verifyPassphrase(passphrase, entry.hash);
    if (!valid) {
      return Response.json(
        { success: false, error: "Invalid passphrase." },
        { status: 401 },
      );
    }

    // Generate token
    const token = generateToken();
    const tokenHash = await hashToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl);

    const authToken: AuthToken = {
      token: tokenHash,
      hash: tokenHash,
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
    };

    // Store token
    const allTokens = getStoredTokens();
    const validTokens = cleanExpiredTokens(allTokens);
    validTokens.push(authToken);
    saveTokens(validTokens);

    return Response.json({
      success: true,
      token,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate token.";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
});

router.post("/logout", async (req) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : "";

    if (!token) {
      return Response.json(
        { success: false, error: "No token provided" },
        { status: 400 },
      );
    }

    // Remove token from storage
    const allTokens = getStoredTokens();
    const remainingTokens: AuthToken[] = [];

    for (const storedToken of allTokens) {
      const matches = await verifyToken(token, storedToken.hash);
      if (!matches) {
        remainingTokens.push(storedToken);
      }
    }

    saveTokens(remainingTokens);

    return Response.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to logout.";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
});

router.get("/verify", async (req) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : "";

    if (!token) {
      return Response.json({ valid: false }, { status: 401 });
    }

    const valid = await verifyBearerToken(token);

    return Response.json({ valid }, { status: valid ? 200 : 401 });
  } catch (error) {
    return Response.json({ valid: false }, { status: 500 });
  }
});

export { router as authRouter };
