import { Router } from "itty-router";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "./db";

const PASSPHRASE_HASH_KEY = "passphrase_hash";
const JWT_SECRET_KEY = "jwt_secret";
const DEFAULT_TOKEN_TTL = "24h"; // 24 hours
type ServerConfigValue =
  typeof db.serverConfig extends Map<string, infer TValue> ? TValue : never;

/**
 * Get or generate JWT secret key
 */
function getJwtSecret(): Uint8Array {
  let secret = db.serverConfig.get(JWT_SECRET_KEY) as
    | { secret: string }
    | undefined;

  if (!secret?.secret) {
    // Generate new random secret (32 bytes = 256 bits)
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const secretBase64 = Buffer.from(randomBytes).toString("base64");
    secret = { secret: secretBase64 };
    db.serverConfig.set(JWT_SECRET_KEY, secret as unknown as ServerConfigValue);
    db.persist();
  }

  return Buffer.from(secret.secret, "base64");
}

/**
 * Parse TTL string (e.g., "24h", "7d", "30m") to seconds
 */
function parseTtl(ttl: string): number {
  const match = ttl.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error("Invalid TTL format. Use format like '24h', '7d', '30m'");
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 60 * 60;
    case "d":
      return value * 24 * 60 * 60;
    default:
      throw new Error("Invalid TTL unit");
  }
}

/**
 * Verify passphrase against stored hash
 */
async function verifyPassphrase(
  passphrase: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(passphrase, hash);
}

/**
 * Generate JWT token with specified TTL
 */
async function generateToken(ttl: string = DEFAULT_TOKEN_TTL): Promise<string> {
  const secret = getJwtSecret();
  const ttlSeconds = parseTtl(ttl);

  const token = await new SignJWT({ type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("proseva")
    .setAudience("proseva-api")
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(secret);

  return token;
}

/**
 * Verify JWT token
 */
export async function verifyToken(token: string): Promise<boolean> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      issuer: "proseva",
      audience: "proseva-api",
    });
    return payload.type === "access";
  } catch {
    return false;
  }
}

const router = Router({ base: "/api/auth" });

/**
 * POST /api/auth/login
 * Authenticate with passphrase and receive JWT token
 */
router.post("/login", async (req) => {
  try {
    const body = await req.json();
    const passphrase =
      typeof body?.passphrase === "string" ? body.passphrase.trim() : "";
    const ttl = typeof body?.ttl === "string" ? body.ttl : DEFAULT_TOKEN_TTL;

    if (!passphrase) {
      return Response.json(
        { success: false, error: "passphrase is required" },
        { status: 400 },
      );
    }

    // Get stored passphrase hash
    const entry = db.serverConfig.get(PASSPHRASE_HASH_KEY) as
      | { hash: string }
      | undefined;

    if (!entry?.hash) {
      return Response.json(
        { success: false, error: "No passphrase configured." },
        { status: 404 },
      );
    }

    // Verify passphrase
    const valid = await verifyPassphrase(passphrase, entry.hash);
    if (!valid) {
      return Response.json(
        { success: false, error: "Invalid passphrase." },
        { status: 401 },
      );
    }

    // Generate token
    const token = await generateToken(ttl);

    return Response.json({
      success: true,
      token,
      expiresIn: parseTtl(ttl),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate token.";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
});

export { router as authRouter };
