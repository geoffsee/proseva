import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("openai", () => ({
  default: class MockOpenAI {},
}));

const { mockReadFile, mockWriteFile, mockMkdir, mockStat } = vi.hoisted(() => ({
  mockReadFile: vi.fn().mockResolvedValue("[]"),
  mockWriteFile: vi.fn().mockResolvedValue(undefined),
  mockMkdir: vi.fn().mockResolvedValue(undefined),
  mockStat: vi.fn().mockResolvedValue({ size: 100 }),
}));

vi.mock("fs/promises", () => ({
  default: {
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    mkdir: mockMkdir,
    stat: mockStat,
  },
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
  stat: mockStat,
}));

vi.mock("./ingest", () => ({
  ingestPdfBuffer: vi.fn().mockResolvedValue({
    entry: {
      id: "test-id",
      filename: "test.pdf",
      path: "uploads/test.pdf",
      category: "uploads",
      title: "test",
      pageCount: 1,
      textFile: "texts/test-id.txt",
      dates: [],
      fileSize: 100,
      caseId: "",
    },
  }),
}));

vi.mock("./ingestion-agent", () => ({
  autoPopulateFromDocument: vi.fn().mockResolvedValue({ caseId: "" }),
}));

vi.mock("./scheduler", () => ({
  initScheduler: vi.fn(),
  getSchedulerStatus: vi.fn().mockReturnValue({
    enabled: false,
    running: false,
    lastRunTime: null,
    nextRunTime: null,
    timezone: "UTC",
    cronExpression: "0 0 18 * * *",
  }),
  triggerEvaluation: vi.fn(),
  stopScheduler: vi.fn(),
  restartScheduler: vi.fn(),
}));

import { freshDb, generateTestToken } from "./test-helpers";
import { router } from "./index";

let testToken: string;

beforeEach(async () => {
  await freshDb();
  testToken = await generateTestToken();
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
