import { AutoRouter } from "itty-router";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";
import { verifyPassphrase } from "./crypto-utils";
import { asIttyRoute, json, openapiFormat } from "./openapi";

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

const router = AutoRouter({ base: "/api", format: openapiFormat });

/**
 * POST /api/auth/login
 * Authenticate with passphrase and receive JWT token
 */
router.post(
  "/auth/login",
  asIttyRoute("post", "/auth/login", async (req) => {
    try {
      const body = await req.json();
      const passphrase =
        typeof body?.passphrase === "string" ? body.passphrase.trim() : "";
      const ttl = typeof body?.ttl === "string" ? body.ttl : DEFAULT_TOKEN_TTL;

      if (!passphrase) {
        return json(400, { success: false, error: "passphrase is required" });
      }

      // Get stored passphrase hash
      const entry = db.serverConfig.get(PASSPHRASE_HASH_KEY) as
        | { hash: string }
        | undefined;

      if (!entry?.hash) {
        return json(404, { success: false, error: "No passphrase configured." });
      }

      // Verify passphrase
      const valid = await verifyPassphrase(passphrase, entry.hash);
      if (!valid) {
        return json(401, { success: false, error: "Invalid passphrase." });
      }

      // Generate token
      const token = await generateToken(ttl);

      return {
        success: true,
        token,
        expiresIn: parseTtl(ttl),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate token.";
      return json(500, { success: false, error: message });
    }
  }),
);

export { router as authRouter };
