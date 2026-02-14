import { describe, it, expect, vi, beforeEach } from "vitest";
import { DocumentStore } from "./DocumentStore";
import * as apiModule from "../lib/api";

const MOCK_DOCS = [
  {
    id: "abc123",
    filename: "motion.pdf",
    path: "motions/motion.pdf",
    category: "Motions",
    title: "Motion to Dismiss",
    pageCount: 3,
    textFile: "texts/abc123.txt",
    dates: ["01/15/2024"],
    fileSize: 102400,
    caseId: "",
  },
  {
    id: "def456",
    filename: "order.pdf",
    path: "orders/order.pdf",
    category: "Orders",
    title: "Court Order",
    pageCount: 1,
    textFile: "texts/def456.txt",
    dates: [],
    fileSize: 51200,
    caseId: "case-1",
  },
];

describe("DocumentStore", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with empty documents", () => {
    const store = DocumentStore.create({ documents: [] });
    expect(store.documents).toHaveLength(0);
  });

  it("loadDocuments fetches and populates documents", async () => {
    vi.spyOn(apiModule.api.documents, "list").mockResolvedValue(MOCK_DOCS);

    const store = DocumentStore.create({ documents: [] });
    await store.loadDocuments();

    expect(store.documents).toHaveLength(2);
    expect(store.documents[0].title).toBe("Motion to Dismiss");
    expect(store.documents[1].caseId).toBe("case-1");
  });

  it("loadDocuments handles fetch failure gracefully", async () => {
    vi.spyOn(apiModule.api.documents, "list").mockRejectedValue(
      new Error("Failed to load"),
    );

    const store = DocumentStore.create({ documents: [] });
    await store.loadDocuments();

    expect(store.documents).toHaveLength(0);
  });

  it("categorySummary returns correct counts", () => {
    const store = DocumentStore.create({ documents: MOCK_DOCS as any });
    expect(store.categorySummary).toEqual({ Motions: 1, Orders: 1 });
  });

  it("summary includes document count and titles", () => {
    const store = DocumentStore.create({ documents: MOCK_DOCS as any });
    expect(store.summary).toContain("2 indexed documents");
    expect(store.summary).toContain("Motion to Dismiss");
    expect(store.summary).toContain("Court Order");
  });

  it("summary returns empty message when no documents", () => {
    const store = DocumentStore.create({ documents: [] });
    expect(store.summary).toBe("No documents are currently indexed.");
  });
});
