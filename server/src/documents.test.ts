import { describe, it, expect, vi } from "vitest";

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

import { freshDb } from "./test-helpers";
import { router } from "./index";

beforeEach(() => {
  freshDb();
});

describe("Document Upload API", () => {
  it("returns 400 when no files provided", async () => {
    const form = new FormData();
    form.set("category", "test");
    const res = await router.fetch(
      new Request("http://localhost/api/documents/upload", {
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
      new Request("http://localhost/api/documents/upload", {
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
      new Request("http://localhost/api/documents/upload", {
        method: "POST",
        body: form,
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveLength(0);
  });
});
