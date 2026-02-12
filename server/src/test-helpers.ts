import { createServer, type Server } from "node:http";
import { InMemoryAdapter } from "./persistence";
import { resetDb, db } from "./db";
import { router } from "./index";
import { SignJWT } from "jose";

let server: Server;
let baseUrl: string;
let testToken: string;

/**
 * Generate a test JWT token
 */
async function generateTestToken(): Promise<string> {
  // Ensure JWT secret exists
  const JWT_SECRET_KEY = "jwt_secret";
  let secret = db.serverConfig.get(JWT_SECRET_KEY) as
    | { secret: string }
    | undefined;

  if (!secret?.secret) {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const secretBase64 = Buffer.from(randomBytes).toString("base64");
    secret = { secret: secretBase64 };
    db.serverConfig.set(JWT_SECRET_KEY, secret as any);
    db.persist();
  }

  const secretBytes = Buffer.from(secret.secret, "base64");

  const token = await new SignJWT({ type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("proseva")
    .setAudience("proseva-api")
    .setExpirationTime(Math.floor(Date.now() / 1000) + 86400) // 24 hours
    .sign(secretBytes);

  return token;
}

export function setupTestServer() {
  beforeAll(async () => {
    await freshDb();
    testToken = await generateTestToken();
    server = createServer(async (req, res) => {
      const url = `http://localhost${req.url}`;
      const headers = new Headers();
      for (const [key, val] of Object.entries(req.headers)) {
        if (val) headers.set(key, Array.isArray(val) ? val[0] : val);
      }

      const body = await new Promise<Buffer>((resolve) => {
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks)));
      });

      const fetchReq = new Request(url, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method!) ? undefined : body,
      });

      const fetchRes = await router.fetch(fetchReq);

      res.writeHead(
        fetchRes.status,
        Object.fromEntries(fetchRes.headers.entries()),
      );
      const resBody = await fetchRes.arrayBuffer();
      res.end(Buffer.from(resBody));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(async () => {
    await freshDb();
    testToken = await generateTestToken();
  });

  return {
    get baseUrl() {
      return baseUrl;
    },
  };
}

export async function freshDb() {
  await resetDb(new InMemoryAdapter());
}

function getAuthHeaders(additionalHeaders?: Record<string, string>) {
  return {
    ...additionalHeaders,
    Authorization: `Bearer ${testToken}`,
  };
}

export const api = {
  async get(path: string, base: string) {
    return fetch(`${base}${path}`, {
      headers: getAuthHeaders(),
    });
  },
  async post(path: string, body: unknown, base: string) {
    return fetch(`${base}${path}`, {
      method: "POST",
      headers: getAuthHeaders({ "content-type": "application/json" }),
      body: JSON.stringify(body),
    });
  },
  async patch(path: string, body: unknown, base: string) {
    return fetch(`${base}${path}`, {
      method: "PATCH",
      headers: getAuthHeaders({ "content-type": "application/json" }),
      body: JSON.stringify(body),
    });
  },
  async delete(path: string, base: string) {
    return fetch(`${base}${path}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
  },
};
