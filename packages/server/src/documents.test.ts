import { describe, it, expect, beforeEach, mock } from "bun:test";

const mockIngestPdfToBlob = mock(async () => ({
  record: {
    id: "test-id",
    filename: "test.pdf",
    category: "uploads",
    title: "test",
    pageCount: 1,
    dates: [],
    fileSize: 100,
    hash: "abc123",
    caseId: "",
    extractedText: "test text",
    createdAt: "2024-01-01T00:00:00.000Z",
  },
}));
const mockDeriveCategory = mock(() => "uploads");
const mockOpenAICompletionCreate = mock(async () => ({
  choices: [{ message: { content: "No actions needed." } }],
}));
const mockInitScheduler = mock(() => {});
const mockGetSchedulerStatus = mock(() => ({
  enabled: false,
  running: false,
  lastRunTime: null,
  nextRunTime: null,
  timezone: "UTC",
  cronExpression: "0 0 18 * * *",
}));
const mockTriggerEvaluation = mock(() => {});
const mockStopScheduler = mock(() => {});
const mockRestartScheduler = mock(() => {});

mock.module("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockOpenAICompletionCreate } };
  },
}));

mock.module("./ingest", () => ({
  ingestPdfToBlob: mockIngestPdfToBlob,
  deriveCategory: mockDeriveCategory,
}));

mock.module("./scheduler", () => ({
  initScheduler: mockInitScheduler,
  getSchedulerStatus: mockGetSchedulerStatus,
  triggerEvaluation: mockTriggerEvaluation,
  stopScheduler: mockStopScheduler,
  restartScheduler: mockRestartScheduler,
}));

const [{ freshDb, generateTestToken }, { router }] = await Promise.all([
  import("./test-helpers"),
  import("./index"),
]);

let testToken: string;

beforeEach(async () => {
  await freshDb();
  testToken = await generateTestToken();
  mockIngestPdfToBlob.mockClear();
  mockDeriveCategory.mockClear();
  mockOpenAICompletionCreate.mockClear();
});

function authRequest(url: string, init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${testToken}`);
  return new Request(url, { ...init, headers });
}

describe("Document Upload API", () => {
  it("returns 400 when no files provided", async () => {
    const form = new FormData();
    form.set("category", "test");
    const res = await router.fetch(
      authRequest("http://localhost/api/documents/upload", {
        method: "POST",
        body: form,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("uploads a PDF file", async () => {
    const form = new FormData();
    form.set("category", "uploads");
    form.append(
      "files",
      new File([new Uint8Array(10)], "test.pdf", { type: "application/pdf" }),
    );

    const res = await router.fetch(
      authRequest("http://localhost/api/documents/upload", {
        method: "POST",
        body: form,
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("test-id");
  });

  it("ignores non-PDF files", async () => {
    const form = new FormData();
    form.append(
      "files",
      new File([new Uint8Array(10)], "readme.txt", { type: "text/plain" }),
    );

    const res = await router.fetch(
      authRequest("http://localhost/api/documents/upload", {
        method: "POST",
        body: form,
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveLength(0);
  });
});
