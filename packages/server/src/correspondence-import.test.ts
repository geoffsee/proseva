import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Correspondence } from "./db";

// Mock dependencies before importing the module under test
vi.mock("./config", () => ({
  getConfig: vi.fn(),
}));

vi.mock("./ingest", () => ({
  ingestPdfToBlob: vi.fn(),
}));

vi.mock("./ingestion-agent", () => ({
  autoPopulateFromDocument: vi.fn(),
}));

vi.mock("./blob-store", () => ({
  getBlobStore: vi.fn(),
  BlobStore: { computeHash: () => "fakehash" },
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {},
}));

import { getConfig } from "./config";
import { ingestPdfToBlob } from "./ingest";
import { autoPopulateFromDocument } from "./ingestion-agent";
import { getBlobStore } from "./blob-store";
import { ingestEmailAttachments } from "./correspondence-import";

const mockGetConfig = vi.mocked(getConfig);
const mockIngestPdfToBlob = vi.mocked(ingestPdfToBlob);
const mockAutoPopulate = vi.mocked(autoPopulateFromDocument);
const mockGetBlobStore = vi.mocked(getBlobStore);

function makeCorrespondence(
  overrides: Partial<Correspondence> = {},
): Correspondence {
  return {
    id: "corr-1",
    caseId: "",
    date: new Date().toISOString(),
    direction: "incoming",
    channel: "email",
    subject: "Test",
    sender: "a@b.com",
    recipient: "c@d.com",
    summary: "",
    notes: "",
    attachments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("ingestEmailAttachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips when OpenAI is not configured", async () => {
    mockGetConfig.mockReturnValue("");

    const corr = makeCorrespondence({
      attachments: [
        {
          id: "att-1",
          filename: "doc.pdf",
          contentType: "application/pdf",
          size: 1024,
          hash: "abc",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    await ingestEmailAttachments(corr);

    expect(mockIngestPdfToBlob).not.toHaveBeenCalled();
  });

  it("skips when there are no PDF attachments", async () => {
    mockGetConfig.mockReturnValue("sk-test-key");

    const corr = makeCorrespondence({
      attachments: [
        {
          id: "att-1",
          filename: "image.png",
          contentType: "image/png",
          size: 512,
          hash: "abc",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    await ingestEmailAttachments(corr);

    expect(mockIngestPdfToBlob).not.toHaveBeenCalled();
  });

  it("skips when attachments list is empty", async () => {
    mockGetConfig.mockReturnValue("sk-test-key");

    const corr = makeCorrespondence({ attachments: [] });

    await ingestEmailAttachments(corr);

    expect(mockIngestPdfToBlob).not.toHaveBeenCalled();
  });

  it("ingests PDF attachments and links case to correspondence", async () => {
    mockGetConfig.mockImplementation((key: string) => {
      if (key === "OPENAI_API_KEY") return "sk-test-key";
      return "";
    });

    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    mockGetBlobStore.mockReturnValue({
      retrieve: vi.fn().mockResolvedValue(pdfBytes),
    } as any);

    const fakeRecord = {
      id: "doc-1",
      filename: "filing.pdf",
      category: "Correspondence",
      title: "filing",
      pageCount: 2,
      dates: [],
      fileSize: 1024,
      hash: "abc",
      caseId: "",
      extractedText: "Court order text",
      createdAt: new Date().toISOString(),
    };
    mockIngestPdfToBlob.mockResolvedValue({ record: fakeRecord });
    mockAutoPopulate.mockResolvedValue({
      caseId: "case-42",
      log: ["created case"],
    });

    const corr = makeCorrespondence({
      attachments: [
        {
          id: "att-pdf",
          filename: "filing.pdf",
          contentType: "application/pdf",
          size: 1024,
          hash: "abc",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    await ingestEmailAttachments(corr);

    expect(mockIngestPdfToBlob).toHaveBeenCalledWith(
      expect.any(Buffer),
      "filing.pdf",
      "Correspondence",
      expect.any(Object),
    );
    expect(mockAutoPopulate).toHaveBeenCalledWith({
      openai: expect.any(Object),
      entry: fakeRecord,
      text: "Court order text",
    });
    expect(corr.caseId).toBe("case-42");
  });

  it("does not overwrite existing caseId on correspondence", async () => {
    mockGetConfig.mockImplementation((key: string) => {
      if (key === "OPENAI_API_KEY") return "sk-test-key";
      return "";
    });

    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    mockGetBlobStore.mockReturnValue({
      retrieve: vi.fn().mockResolvedValue(pdfBytes),
    } as any);

    mockIngestPdfToBlob.mockResolvedValue({
      record: {
        id: "doc-1",
        filename: "doc.pdf",
        category: "Correspondence",
        title: "doc",
        pageCount: 1,
        dates: [],
        fileSize: 512,
        hash: "abc",
        caseId: "",
        extractedText: "text",
        createdAt: new Date().toISOString(),
      },
    });
    mockAutoPopulate.mockResolvedValue({ caseId: "case-99", log: [] });

    const corr = makeCorrespondence({
      caseId: "case-existing",
      attachments: [
        {
          id: "att-1",
          filename: "doc.pdf",
          contentType: "application/pdf",
          size: 512,
          hash: "abc",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    await ingestEmailAttachments(corr);

    // Should NOT overwrite the existing caseId
    expect(corr.caseId).toBe("case-existing");
  });

  it("processes only PDF attachments and skips others", async () => {
    mockGetConfig.mockImplementation((key: string) => {
      if (key === "OPENAI_API_KEY") return "sk-test-key";
      return "";
    });

    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    mockGetBlobStore.mockReturnValue({
      retrieve: vi.fn().mockResolvedValue(pdfBytes),
    } as any);

    mockIngestPdfToBlob.mockResolvedValue({
      record: {
        id: "doc-1",
        filename: "order.pdf",
        category: "Correspondence",
        title: "order",
        pageCount: 1,
        dates: [],
        fileSize: 512,
        hash: "abc",
        caseId: "",
        extractedText: "text",
        createdAt: new Date().toISOString(),
      },
    });
    mockAutoPopulate.mockResolvedValue({ caseId: undefined, log: [] });

    const corr = makeCorrespondence({
      attachments: [
        {
          id: "att-img",
          filename: "photo.jpg",
          contentType: "image/jpeg",
          size: 2048,
          hash: "img",
          createdAt: new Date().toISOString(),
        },
        {
          id: "att-pdf",
          filename: "order.pdf",
          contentType: "application/pdf",
          size: 512,
          hash: "pdf",
          createdAt: new Date().toISOString(),
        },
        {
          id: "att-doc",
          filename: "notes.docx",
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          size: 1024,
          hash: "doc",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    await ingestEmailAttachments(corr);

    // Only the PDF should be ingested
    expect(mockIngestPdfToBlob).toHaveBeenCalledTimes(1);
    expect(mockIngestPdfToBlob).toHaveBeenCalledWith(
      expect.any(Buffer),
      "order.pdf",
      "Correspondence",
      expect.any(Object),
    );
  });

  it("continues processing remaining attachments when one fails", async () => {
    mockGetConfig.mockImplementation((key: string) => {
      if (key === "OPENAI_API_KEY") return "sk-test-key";
      return "";
    });

    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const mockRetrieve = vi
      .fn()
      .mockResolvedValueOnce(pdfBytes) // first PDF succeeds
      .mockResolvedValueOnce(pdfBytes); // second PDF succeeds

    mockGetBlobStore.mockReturnValue({ retrieve: mockRetrieve } as any);

    mockIngestPdfToBlob
      .mockRejectedValueOnce(new Error("OCR failed")) // first fails
      .mockResolvedValueOnce({
        record: {
          id: "doc-2",
          filename: "second.pdf",
          category: "Correspondence",
          title: "second",
          pageCount: 1,
          dates: [],
          fileSize: 512,
          hash: "abc",
          caseId: "",
          extractedText: "text",
          createdAt: new Date().toISOString(),
        },
      });
    mockAutoPopulate.mockResolvedValue({ caseId: undefined, log: [] });

    const corr = makeCorrespondence({
      attachments: [
        {
          id: "att-1",
          filename: "first.pdf",
          contentType: "application/pdf",
          size: 512,
          hash: "a",
          createdAt: new Date().toISOString(),
        },
        {
          id: "att-2",
          filename: "second.pdf",
          contentType: "application/pdf",
          size: 512,
          hash: "b",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    // Should not throw — continues past the first failure
    await ingestEmailAttachments(corr);

    expect(mockIngestPdfToBlob).toHaveBeenCalledTimes(2);
    expect(mockAutoPopulate).toHaveBeenCalledTimes(1); // only the second succeeded
  });

  it("handles blob not found gracefully", async () => {
    mockGetConfig.mockImplementation((key: string) => {
      if (key === "OPENAI_API_KEY") return "sk-test-key";
      return "";
    });

    mockGetBlobStore.mockReturnValue({
      retrieve: vi.fn().mockResolvedValue(null),
    } as any);

    const corr = makeCorrespondence({
      attachments: [
        {
          id: "att-missing",
          filename: "gone.pdf",
          contentType: "application/pdf",
          size: 512,
          hash: "abc",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    await ingestEmailAttachments(corr);

    expect(mockIngestPdfToBlob).not.toHaveBeenCalled();
  });

  it("detects PDFs by filename extension even without PDF content type", async () => {
    mockGetConfig.mockImplementation((key: string) => {
      if (key === "OPENAI_API_KEY") return "sk-test-key";
      return "";
    });

    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    mockGetBlobStore.mockReturnValue({
      retrieve: vi.fn().mockResolvedValue(pdfBytes),
    } as any);

    mockIngestPdfToBlob.mockResolvedValue({
      record: {
        id: "doc-1",
        filename: "order.PDF",
        category: "Correspondence",
        title: "order",
        pageCount: 1,
        dates: [],
        fileSize: 512,
        hash: "abc",
        caseId: "",
        extractedText: "text",
        createdAt: new Date().toISOString(),
      },
    });
    mockAutoPopulate.mockResolvedValue({ caseId: undefined, log: [] });

    const corr = makeCorrespondence({
      attachments: [
        {
          id: "att-1",
          filename: "order.PDF",
          contentType: "application/octet-stream", // generic type
          size: 512,
          hash: "abc",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    await ingestEmailAttachments(corr);

    expect(mockIngestPdfToBlob).toHaveBeenCalledTimes(1);
  });
});
