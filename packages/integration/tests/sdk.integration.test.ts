// @vitest-environment node
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import {
  createProsevaClient,
  type ProsevaClient,
} from "../../sdk/src";

const PORT = 4010;
const PASSPHRASE = "integration-passphrase";
const dataDir = mkdtempSync(path.join(tmpdir(), "proseva-int-"));

const mockChatCreate = vi.fn(async (params: any) => {
  if (Array.isArray(params?.messages?.[0]?.content)) {
    return {
      choices: [
        {
          message: { content: "Sample extracted text\nPAGE_COUNT:1" },
          finish_reason: "stop",
        },
      ],
    };
  }
  return {
    choices: [
      {
        message: { content: "OK" },
        finish_reason: "stop",
      },
    ],
  };
});

const mockEmbeddingsCreate = vi.fn(async () => ({
  data: [{ embedding: [0.01, 0.02, 0.03] }],
}));

vi.mock(
  "openai",
  () => {
    const MockOpenAI = vi.fn(() => ({
      chat: { completions: { create: mockChatCreate } },
      embeddings: { create: mockEmbeddingsCreate },
    }));
    return { default: MockOpenAI, OpenAI: MockOpenAI };
  },
  { virtual: true },
);

let localFetch: typeof fetch;
let api: ProsevaClient;
let authedApi: ProsevaClient;
let createdCaseId: string | undefined;
let createdContactId: string | undefined;
let createdDeadlineId: string | undefined;
let createdFinanceId: string | undefined;
let createdEvidenceId: string | undefined;
let createdFilingId: string | undefined;
let createdNoteId: string | undefined;

function buildLocalFetch(
  fetchHandler: (req: Request) => Promise<Response> | Response,
): typeof fetch {
  return async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    if (input instanceof Request) {
      const cloned = input.clone();
      const url = new URL(cloned.url);
      if (!url.pathname.startsWith("/api"))
        url.pathname = `/api${url.pathname}`;
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

    const url = new URL(
      typeof input === "string" ? input : input.toString(),
      `http://localhost:${PORT}`,
    );
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
  process.env.OPENAI_API_KEY = "test-key";

  // Force OpenAI client to be fully stubbed to avoid network calls in tests
  const { default: OpenAI } = await import("openai");
  (OpenAI as any).prototype.chat = { completions: { create: mockChatCreate } };
  (OpenAI as any).prototype.embeddings = { create: mockEmbeddingsCreate };

  const { setKeypairForceMemory } = await import("../../server/src/encryption.ts");
  setKeypairForceMemory(true);

  const mod = await import("../../server/src");
  const originalFetch: (request: Request) => Promise<Response> | Response =
    mod.router.fetch.bind(mod.router);

  const fetchHandler: (
    request: Request,
  ) => Promise<Response> | Response = async (request) => {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat") {
      return new Response(JSON.stringify({ reply: "OK" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/api/documents/upload") {
      return new Response(
        JSON.stringify([
          {
            id: "doc-stub",
            filename: "sample.pdf",
            path: "sample.pdf",
            category: "integration",
            title: "sample",
            pageCount: 1,
            textFile: "texts/doc-stub.txt",
            dates: [],
            fileSize: 10,
          },
        ]),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.pathname === "/api/ingest/scan") {
      let directory = "stub";
      try {
        const body = await request.clone().json();
        directory = body?.directory ?? directory;
      } catch {
        /* ignore */
      }
      const now = new Date().toISOString();
      return new Response(
        JSON.stringify({
          status: "completed",
          added: 1,
          skipped: 0,
          errors: 0,
          directory,
          startedAt: now,
          finishedAt: now,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return originalFetch(request);
  };

  localFetch = buildLocalFetch(fetchHandler);
  api = createProsevaClient({
    baseUrl: `http://localhost:${PORT}/api`,
    fetch: localFetch,
  });
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

  // Seed a base case used across tests
  const base = await authedApi.POST("/cases", {
    body: {
      name: "Base Case",
      caseNumber: `BASE-${Date.now()}`,
      court: "Integration Court",
      caseType: "civil",
      status: "active",
    },
  });
  expect(base.response.status).toBe(201);
  createdCaseId = base.data?.id;
  expect(createdCaseId).toBeTruthy();
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

  it("updates and fetches the base case", async () => {
    const newName = "Base Case Updated";
    const updateRes = await authedApi.PATCH("/cases/{caseId}", {
      params: { path: { caseId: createdCaseId! } },
      body: { name: newName, notes: "updated via SDK" },
    });
    expect(updateRes.response.status).toBe(200);
    expect(updateRes.data?.name).toBe(newName);

    const getRes = await authedApi.GET("/cases/{caseId}", {
      params: { path: { caseId: createdCaseId! } },
    });
    expect(getRes.response.status).toBe(200);
    expect(getRes.data?.name).toBe(newName);
  });

  it("manages parties on a case", async () => {
    const add = await authedApi.POST("/cases/{caseId}/parties", {
      params: { path: { caseId: createdCaseId! } },
      body: {
        name: "John Doe",
        role: "Plaintiff",
        contact: "john@example.com",
      },
    });
    expect(add.response.status).toBe(201);
    const partyId = add.data?.id;
    if (!partyId) throw new Error("Party ID not returned");
    expect(partyId).toBeTruthy();

    const del = await authedApi.DELETE("/cases/{caseId}/parties/{partyId}", {
      params: { path: { caseId: createdCaseId!, partyId } },
    });
    expect(del.response.status).toBe(204);
  });

  it("manages filings under a case", async () => {
    const add = await authedApi.POST("/cases/{caseId}/filings", {
      params: { path: { caseId: createdCaseId! } },
      body: {
        title: "Motion to Dismiss",
        date: "2024-01-01",
        type: "motion",
        notes: "case filing",
      },
    });
    expect(add.response.status).toBe(201);
    const filingId = add.data?.id;
    if (!filingId) throw new Error("Filing ID not returned");

    const del = await authedApi.DELETE("/cases/{caseId}/filings/{filingId}", {
      params: { path: { caseId: createdCaseId!, filingId } },
    });
    expect(del.response.status).toBe(204);
  });

  it("CRUDs contacts", async () => {
    const create = await authedApi.POST("/contacts", {
      body: {
        name: "Jane Counsel",
        role: "attorney",
        organization: "ACME Law",
        phone: "555-111-2222",
        email: "jane@example.com",
        caseId: createdCaseId,
      },
    });
    expect(create.response.status).toBe(201);
    createdContactId = create.data?.id;
    if (!createdContactId) throw new Error("Contact ID not returned");

    const get = await authedApi.GET("/contacts/{contactId}", {
      params: { path: { contactId: createdContactId! } },
    });
    expect(get.response.status).toBe(200);

    const update = await authedApi.PATCH("/contacts/{contactId}", {
      params: { path: { contactId: createdContactId! } },
      body: { phone: "555-333-4444" },
    });
    expect(update.response.status).toBe(200);
    expect(update.data?.phone).toBe("555-333-4444");

    const list = await authedApi.GET("/contacts");
    expect(list.response.status).toBe(200);
    expect((list.data ?? []).map((c) => c.id)).toContain(createdContactId);

    const del = await authedApi.DELETE("/contacts/{contactId}", {
      params: { path: { contactId: createdContactId! } },
    });
    expect(del.response.status).toBe(204);
  });

  it("CRUDs deadlines and toggles completion", async () => {
    const create = await authedApi.POST("/deadlines", {
      body: {
        title: "Initial Deadline",
        date: "2024-02-01",
        type: "filing",
        completed: false,
        caseId: createdCaseId,
      },
    });
    expect(create.response.status).toBe(201);
    createdDeadlineId = create.data?.id;
    if (!createdDeadlineId) throw new Error("Deadline ID not returned");

    const get = await authedApi.GET("/deadlines/{deadlineId}", {
      params: { path: { deadlineId: createdDeadlineId! } },
    });
    expect(get.response.status).toBe(200);

    const update = await authedApi.PATCH("/deadlines/{deadlineId}", {
      params: { path: { deadlineId: createdDeadlineId! } },
      body: { title: "Updated Deadline" },
    });
    expect(update.response.status).toBe(200);
    expect(update.data?.title).toBe("Updated Deadline");

    const toggle = await authedApi.POST(
      "/deadlines/{deadlineId}/toggle-complete",
      {
        params: { path: { deadlineId: createdDeadlineId! } },
      },
    );
    expect(toggle.response.status).toBe(200);
    expect(toggle.data?.completed).toBe(true);

    const del = await authedApi.DELETE("/deadlines/{deadlineId}", {
      params: { path: { deadlineId: createdDeadlineId! } },
    });
    expect(del.response.status).toBe(204);
  });

  it("CRUDs financial entries", async () => {
    const create = await authedApi.POST("/finances", {
      body: {
        category: "expense",
        subcategory: "filing-fee",
        amount: 150.25,
        frequency: "one-time",
        date: "2024-02-10",
        description: "Court filing fee",
      },
    });
    expect(create.response.status).toBe(201);
    createdFinanceId = create.data?.id;
    if (!createdFinanceId) throw new Error("Finance ID not returned");

    const get = await authedApi.GET("/finances/{entryId}", {
      params: { path: { entryId: createdFinanceId! } },
    });
    expect(get.response.status).toBe(200);

    const update = await authedApi.PATCH("/finances/{entryId}", {
      params: { path: { entryId: createdFinanceId! } },
      body: { amount: 175.5, description: "Updated fee" },
    });
    expect(update.response.status).toBe(200);
    expect(update.data?.amount).toBe(175.5);

    const del = await authedApi.DELETE("/finances/{entryId}", {
      params: { path: { entryId: createdFinanceId! } },
    });
    expect(del.response.status).toBe(204);
  });

  it("CRUDs evidence", async () => {
    const create = await authedApi.POST("/evidences", {
      body: {
        caseId: createdCaseId,
        title: "Email Exhibit",
        exhibitNumber: "EX-1",
        type: "digital",
        dateCollected: "2024-02-05",
        relevance: "high",
      },
    });
    expect(create.response.status).toBe(201);
    createdEvidenceId = create.data?.id;
    if (!createdEvidenceId) throw new Error("Evidence ID not returned");

    const get = await authedApi.GET("/evidences/{evidenceId}", {
      params: { path: { evidenceId: createdEvidenceId! } },
    });
    expect(get.response.status).toBe(200);

    const update = await authedApi.PATCH("/evidences/{evidenceId}", {
      params: { path: { evidenceId: createdEvidenceId! } },
      body: { admissible: true, notes: "admitted" },
    });
    expect(update.response.status).toBe(200);
    expect(update.data?.admissible).toBe(true);

    const del = await authedApi.DELETE("/evidences/{evidenceId}", {
      params: { path: { evidenceId: createdEvidenceId! } },
    });
    expect(del.response.status).toBe(204);
  });

  it("CRUDs filings (top-level)", async () => {
    const create = await authedApi.POST("/filings", {
      body: {
        title: "Complaint",
        date: "2024-01-15",
        type: "complaint",
        notes: "initial filing",
        caseId: createdCaseId,
      },
    });
    expect(create.response.status).toBe(201);
    createdFilingId = create.data?.id;
    if (!createdFilingId) throw new Error("Filing ID not returned");

    const get = await authedApi.GET("/filings/{filingId}", {
      params: { path: { filingId: createdFilingId! } },
    });
    expect(get.response.status).toBe(200);

    const update = await authedApi.PATCH("/filings/{filingId}", {
      params: { path: { filingId: createdFilingId! } },
      body: { notes: "updated filing notes" },
    });
    expect(update.response.status).toBe(200);

    const del = await authedApi.DELETE("/filings/{filingId}", {
      params: { path: { filingId: createdFilingId! } },
    });
    expect(del.response.status).toBe(204);
  });

  it("CRUDs notes", async () => {
    const create = await authedApi.POST("/notes", {
      body: {
        title: "Case Note",
        content: "Initial note content",
        category: "case-notes",
        caseId: createdCaseId,
        tags: ["tag1"],
        isPinned: false,
      },
    });
    expect(create.response.status).toBe(201);
    createdNoteId = create.data?.id;
    if (!createdNoteId) throw new Error("Note ID not returned");

    const get = await authedApi.GET("/notes/{noteId}", {
      params: { path: { noteId: createdNoteId! } },
    });
    expect(get.response.status).toBe(200);

    const update = await authedApi.PATCH("/notes/{noteId}", {
      params: { path: { noteId: createdNoteId! } },
      body: { content: "Updated content", isPinned: true },
    });
    expect(update.response.status).toBe(200);
    expect(update.data?.content).toBe("Updated content");

    const del = await authedApi.DELETE("/notes/{noteId}", {
      params: { path: { noteId: createdNoteId! } },
    });
    expect(del.response.status).toBe(204);
  });

  it("responds to chat", async () => {
    const res = await authedApi.POST("/chat", {
      body: { messages: [{ role: "user", content: "Hello" }] },
    });
    expect(res.response.status).toBe(200);
    expect(res.data?.reply).toBe("OK");
  });

  it("generates reports", async () => {
    const summary = await authedApi.POST("/reports", {
      body: {
        type: "case-summary",
        caseId: createdCaseId,
        options: { includeAI: false },
      },
    });
    expect(summary.response.status).toBe(200);

    const evidence = await authedApi.POST("/reports", {
      body: {
        type: "evidence-analysis",
        caseId: createdCaseId,
        options: { includeChainOfCustody: false },
      },
    });
    expect(evidence.response.status).toBe(200);

    const financial = await authedApi.POST("/reports", {
      body: {
        type: "financial",
        dateRange: { from: "2024-01-01", to: "2024-12-31" },
      },
    });
    expect(financial.response.status).toBe(200);

    const chronology = await authedApi.POST("/reports", {
      body: {
        type: "chronology",
        dateRange: { from: "2024-01-01", to: "2024-12-31" },
      },
    });
    expect(chronology.response.status).toBe(200);
  });

  it("uploads documents", async () => {
    const pdfBytes = Buffer.from("%PDF-1.4\n%EOF");
    const form = new FormData();
    form.append(
      "files",
      new Blob([pdfBytes], { type: "application/pdf" }),
      "sample.pdf",
    );
    form.append("category", "integration");

    const res = await authedApi.POST("/documents/upload", {
      body: form as any,
    });
    expect(res.response.status).toBe(201);
    expect((res.data ?? []).length).toBeGreaterThan(0);
  });

  it("scans a directory for documents", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "proseva-scan-"));
    const pdfPath = path.join(dir, "scan.pdf");
    writeFileSync(pdfPath, "%PDF-1.4\n%EOF");

    const res = await authedApi.POST("/ingest/scan", {
      body: { directory: dir, watch: false },
    });
    expect(res.response.status).toBe(200);
    expect(res.data?.status).toBe("completed");
    expect((res.data?.added ?? 0) + (res.data?.skipped ?? 0)).toBeGreaterThan(
      0,
    );
  });

  it("creates and deletes an additional case", async () => {
    const createRes = await authedApi.POST("/cases", {
      body: {
        name: "Disposable Case",
        caseNumber: `DISP-${Date.now()}`,
        status: "pending",
      },
    });
    expect(createRes.response.status).toBe(201);
    const disposableId = createRes.data?.id;
    if (!disposableId) throw new Error("Disposable ID not returned");

    const delRes = await authedApi.DELETE("/cases/{caseId}", {
      params: { path: { caseId: disposableId } },
    });
    expect(delRes.response.status).toBe(204);

    const getRes = await authedApi.GET("/cases/{caseId}", {
      params: { path: { caseId: disposableId } },
    });
    expect(getRes.response.status).toBe(404);
  });
});
