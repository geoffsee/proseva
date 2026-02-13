// @vitest-environment node
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { createProsevaClient, type ProsevaClient } from "../proseva-sdk/dist/index.js";

const PORT = 4010;
const PASSPHRASE = "integration-passphrase";
const dataDir = mkdtempSync(path.join(tmpdir(), "proseva-int-"));

let localFetch: typeof fetch;
let api: ProsevaClient;
let authedApi: ProsevaClient;
let createdCaseId: string | undefined;

function buildLocalFetch(fetchHandler: (req: Request) => Promise<Response> | Response): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (input instanceof Request) {
      const cloned = input.clone();
      const url = new URL(cloned.url);
      if (!url.pathname.startsWith("/api")) url.pathname = `/api${url.pathname}`;
      return fetchHandler(
        new Request(url, {
          method: cloned.method,
          headers: cloned.headers,
          body: cloned.body ?? undefined,
          // Required by undici when sending a ReadableStream in Node.
          duplex: "half",
        }),
      );
    }

    const url = new URL(typeof input === "string" ? input : input.toString(), `http://localhost:${PORT}`);
    if (!url.pathname.startsWith("/api")) url.pathname = `/api${url.pathname}`;
    return fetchHandler(
      new Request(url, {
        ...init,
        duplex: init?.body ? "half" : undefined,
      }),
    );
  };
}

async function startApi(): Promise<void> {
  process.env.PORT = String(PORT);
  process.env.PROSEVA_DATA_DIR = dataDir;
  process.env.EVALUATION_ENABLED = "false";

  const { setKeypairForceMemory } = await import("../server/src/encryption.ts");
  setKeypairForceMemory(true);

  const mod = await import("../server/src/index.ts");
  const fetchHandler: (request: Request) => Promise<Response> | Response =
    mod.router.fetch.bind(mod.router);

  localFetch = buildLocalFetch(fetchHandler);
  api = createProsevaClient({ baseUrl: `http://localhost:${PORT}/api`, fetch: localFetch });
}

async function waitForHealth(timeoutMs = 10000): Promise<void> {
  const start = Date.now();
  while (true) {
    const result = await api.GET("/health");
    if (result.response.status === 200) return;
    if (Date.now() - start > timeoutMs)
      throw new Error(`Health check did not return 200 in ${timeoutMs}ms`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function bootstrapAuth(): Promise<void> {
  // Configure passphrase
  const setup = await api.POST("/security/setup-passphrase", {
    body: { passphrase: PASSPHRASE },
  });
  expect(setup.response.status).toBe(200);

  // Login to get JWT
  const login = await api.POST("/auth/login", {
    body: { passphrase: PASSPHRASE },
  });
  expect(login.response.status).toBe(200);
  const token = login.data?.token;
  expect(token).toBeTruthy();

  authedApi = createProsevaClient({
    baseUrl: `http://localhost:${PORT}/api`,
    fetch: localFetch,
    getAuthToken: () => token ?? null,
  });
}

beforeAll(async () => {
  await startApi();
  await waitForHealth();
  await bootstrapAuth();
}, 20000);

afterAll(async () => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe("ProSeVA SDK", () => {
  it("returns health 200", async () => {
    const result = await api.GET("/health");
    expect(result.response.status).toBe(200);
    expect(result.data?.status).toBe("ok");
  });

  it("creates and fetches a case", async () => {
    const createRes = await authedApi.POST("/cases", {
      body: {
        name: "Integration Case",
        caseNumber: "INT-001",
        court: "Test Court",
        caseType: "civil",
        status: "active",
        notes: "created via SDK test",
      },
    });
    expect(createRes.response.status).toBe(201);
    createdCaseId = createRes.data?.id;
    expect(createdCaseId).toBeTruthy();

    const getRes = await authedApi.GET("/cases/{caseId}", {
      params: { path: { caseId: createdCaseId! } },
    });
    expect(getRes.response.status).toBe(200);
    expect(getRes.data?.name).toBe("Integration Case");
  });

  it("lists cases including the created one", async () => {
    const listRes = await authedApi.GET("/cases");
    expect(listRes.response.status).toBe(200);
    const ids = (listRes.data ?? []).map((c) => c.id);
    expect(ids).toContain(createdCaseId);
  });

  it("deletes a case", async () => {
    const delRes = await authedApi.DELETE("/cases/{caseId}", {
      params: { path: { caseId: createdCaseId! } },
    });
    expect(delRes.response.status).toBe(204);

    const listRes = await authedApi.GET("/cases");
    const ids = (listRes.data ?? []).map((c) => c.id);
    expect(ids).not.toContain(createdCaseId);
  });
});
