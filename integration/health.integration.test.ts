// @vitest-environment node
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { createProsevaClient } from "../proseva-sdk/dist/index.js";

const PORT = 4010;
const dataDir = mkdtempSync(path.join(tmpdir(), "proseva-int-"));

let localFetch: typeof fetch;

async function startApi(): Promise<void> {
  process.env.PORT = String(PORT);
  process.env.PROSEVA_DATA_DIR = dataDir;
  process.env.EVALUATION_ENABLED = "false";

  const mod = await import("../server/src/index.ts");
  const fetchHandler: (request: Request) => Promise<Response> | Response =
    mod.router.fetch.bind(mod.router);

  localFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestInit: RequestInit = { ...init };
    let url: URL;

    if (input instanceof Request) {
      url = new URL(input.url);
      requestInit.method = requestInit.method ?? input.method;
      requestInit.headers = requestInit.headers ?? input.headers;
      requestInit.body = requestInit.body ?? input.body;
    } else {
      url = new URL(
        typeof input === "string" ? input : input.toString(),
        `http://localhost:${PORT}`,
      );
    }

    if (!url.pathname.startsWith("/api/")) {
      url.pathname = `/api${url.pathname}`;
    }
    const request = new Request(url, requestInit);
    return fetchHandler(request);
  };
}

async function waitForHealth(timeoutMs = 10000): Promise<void> {
  const api = createProsevaClient({
    baseUrl: `http://localhost:${PORT}/api`,
    fetch: localFetch,
  });
  const start = Date.now();
  let lastStatus: number | null = null;
  let lastBody: unknown = null;
  while (true) {
    try {
      const result = await api.GET("/health");
      lastStatus = result.response.status;
      lastBody = result.data ?? (await result.response.text().catch(() => null));
      if (result.response.status === 200) return;
    } catch (err) {
      lastBody = (err as Error)?.message;
      // retry until timeout
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `Server did not become healthy in time (last status: ${lastStatus}, body: ${JSON.stringify(lastBody)})`,
      );
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

beforeAll(async () => {
  await startApi();
  await waitForHealth();
}, 15000);

afterAll(async () => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe("API health", () => {
  it("responds 200 on /health via SDK", { timeout: 15000 }, async () => {
    const api = createProsevaClient({
      baseUrl: `http://localhost:${PORT}/api`,
      fetch: localFetch,
    });
    const result = await api.GET("/health");
    expect(result.response.status).toBe(200);
    expect(result.data?.status).toBe("ok");
  });
});
