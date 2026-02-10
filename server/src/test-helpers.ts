import { createServer, type Server } from "node:http";
import { InMemoryAdapter } from "./persistence";
import { resetDb } from "./db";
import { router } from "./index";

let server: Server;
let baseUrl: string;

export function setupTestServer() {
  beforeAll(async () => {
    freshDb();
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

  beforeEach(() => {
    freshDb();
  });

  return {
    get baseUrl() {
      return baseUrl;
    },
  };
}

export function freshDb() {
  resetDb(new InMemoryAdapter());
}

export const api = {
  async get(path: string, base: string) {
    return fetch(`${base}${path}`);
  },
  async post(path: string, body: unknown, base: string) {
    return fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  async patch(path: string, body: unknown, base: string) {
    return fetch(`${base}${path}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  async delete(path: string, base: string) {
    return fetch(`${base}${path}`, { method: "DELETE" });
  },
};
