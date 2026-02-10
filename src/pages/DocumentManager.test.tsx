import { render, screen, waitFor, fireEvent } from "../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DocumentManager from "./DocumentManager";

const MOCK_DOCS = [
  {
    id: "1",
    filename: "motion.pdf",
    path: "motions/motion.pdf",
    category: "Motions",
    title: "Motion to Dismiss",
    pageCount: 3,
    textFile: "texts/1.txt",
    dates: ["01/15/2024", "02/01/2024"],
    fileSize: 102400,
    caseId: "",
  },
  {
    id: "2",
    filename: "order.pdf",
    path: "orders/order.pdf",
    category: "Orders",
    title: "Court Order",
    pageCount: 1,
    textFile: "texts/2.txt",
    dates: ["03/10/2024"],
    fileSize: 51200,
    caseId: "case-abc",
  },
  {
    id: "3",
    filename: "brief.pdf",
    path: "motions/brief.pdf",
    category: "Motions",
    title: "Appellate Brief",
    pageCount: 12,
    textFile: "texts/3.txt",
    dates: [],
    fileSize: 2048000,
  },
];

const DUP_DOCS = [
  ...MOCK_DOCS,
  {
    id: "4",
    filename: "motion-copy.pdf",
    path: "motions/motion-copy.pdf",
    category: "Motions",
    title: "Motion to Dismiss",
    pageCount: 3,
    textFile: "texts/4.txt",
    dates: ["01/15/2024"],
    fileSize: 102400,
  },
];

function mockFetch(
  data: unknown,
  ok = true,
  ingestStatus = {
    active: false,
    directory: "",
    running: false,
    lastRunStarted: null,
    lastRunFinished: null,
    added: 0,
    skipped: 0,
    errors: 0,
  },
) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.startsWith("/texts/")) {
      return Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve("Extracted text content for this document."),
      });
    }
    if (url === "/api/ingest/status") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(ingestStatus),
      });
    }
    return Promise.resolve({
      ok,
      status: ok ? 200 : 500,
      json: () => Promise.resolve(data),
    });
  });
}

describe("DocumentManager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders stat cards with correct values", async () => {
    mockFetch(MOCK_DOCS, true, {
      active: true,
      directory: "/tmp/pdfs",
      running: false,
      lastRunStarted: null,
      lastRunFinished: null,
      added: 0,
      skipped: 0,
      errors: 0,
    });
    render(<DocumentManager />);
    await waitFor(() => {
      expect(screen.getByText("Total Documents")).toBeInTheDocument();
    });
    expect(screen.getByText("Categories")).toBeInTheDocument();
    expect(screen.getByText("Total Pages")).toBeInTheDocument();
    expect(screen.getByText("16")).toBeInTheDocument();
    expect(screen.getByText(/Auto-ingest/)).toBeInTheDocument();
  });

  it("shows ingestion status details", async () => {
    mockFetch(MOCK_DOCS, true, {
      active: true,
      directory: "/tmp/pdfs",
      running: true,
      lastRunStarted: "2026-01-01T00:00:00Z",
      lastRunFinished: null,
      added: 2,
      skipped: 1,
      errors: 0,
    });
    render(<DocumentManager />);
    await waitFor(() => {
      expect(screen.getByText(/Auto-ingest Running/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Directory: \/tmp\/pdfs/)).toBeInTheDocument();
    expect(screen.getByText(/Added: 2/)).toBeInTheDocument();
    expect(screen.getByText(/Skipped: 1/)).toBeInTheDocument();
  });

  it("renders all documents in the table", async () => {
    mockFetch(MOCK_DOCS);
    render(<DocumentManager />);
    await waitFor(() => {
      expect(screen.getByText("Motion to Dismiss")).toBeInTheDocument();
    });
    expect(screen.getByText("Court Order")).toBeInTheDocument();
    expect(screen.getByText("Appellate Brief")).toBeInTheDocument();
  });

  it("filters by category", async () => {
    mockFetch(MOCK_DOCS);
    render(<DocumentManager />);
    await waitFor(() => {
      expect(screen.getByText("Motion to Dismiss")).toBeInTheDocument();
    });

    const select = screen.getByDisplayValue("All Categories");
    fireEvent.change(select, { target: { value: "Orders" } });

    expect(screen.getByText("Court Order")).toBeInTheDocument();
    expect(screen.queryByText("Motion to Dismiss")).not.toBeInTheDocument();
    expect(screen.queryByText("Appellate Brief")).not.toBeInTheDocument();
  });

  it("filters by search text", async () => {
    mockFetch(MOCK_DOCS);
    render(<DocumentManager />);
    await waitFor(() => {
      expect(screen.getByText("Motion to Dismiss")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Search by title…");
    fireEvent.change(input, { target: { value: "appellate" } });

    expect(screen.getByText("Appellate Brief")).toBeInTheDocument();
    expect(screen.queryByText("Motion to Dismiss")).not.toBeInTheDocument();
    expect(screen.queryByText("Court Order")).not.toBeInTheDocument();
  });

  it("expands row to lazy-load extracted text", async () => {
    mockFetch(MOCK_DOCS);
    render(<DocumentManager />);
    await waitFor(() => {
      expect(screen.getByText("Court Order")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Court Order"));
    await waitFor(() => {
      expect(
        screen.getByText("Extracted text content for this document."),
      ).toBeInTheDocument();
    });
  });

  it("shows error on fetch failure", async () => {
    mockFetch(null, false);
    render(<DocumentManager />);
    await waitFor(() => {
      expect(screen.getByText(/Error: Failed to load/)).toBeInTheDocument();
    });
  });

  it("shows empty state when no documents indexed", async () => {
    mockFetch([]);
    render(<DocumentManager />);
    await waitFor(() => {
      expect(screen.queryByText("Loading documents…")).not.toBeInTheDocument();
    });
    expect(screen.getByText(/No documents indexed yet/)).toBeInTheDocument();
  });

  it("renders upload component", async () => {
    mockFetch(MOCK_DOCS);
    render(<DocumentManager />);
    await waitFor(() => {
      expect(screen.getByTestId("drop-zone")).toBeInTheDocument();
    });
    expect(screen.getByText("Browse Files")).toBeInTheDocument();
  });

  it("refreshes document list after successful upload", async () => {
    let fetchCount = 0;
    global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (opts?.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.startsWith("/texts/")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve("text"),
        });
      }
      fetchCount++;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(
            fetchCount === 1
              ? MOCK_DOCS
              : [
                  ...MOCK_DOCS,
                  {
                    id: "4",
                    filename: "new.pdf",
                    path: "new/new.pdf",
                    category: "_new_filings",
                    title: "New Document",
                    pageCount: 1,
                    textFile: "texts/4.txt",
                    dates: [],
                    fileSize: 512,
                  },
                ],
          ),
      });
    });

    render(<DocumentManager />);
    await waitFor(() => {
      expect(screen.getByText("Motion to Dismiss")).toBeInTheDocument();
    });

    const input = screen.getByTestId("file-input");
    const file = new File([new ArrayBuffer(1024)], "new.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("Upload 1 file"));

    await waitFor(() => {
      expect(screen.getByText("New Document")).toBeInTheDocument();
    });
  });

  it("renders caseId as link when present", async () => {
    mockFetch(MOCK_DOCS);
    render(<DocumentManager />);
    await waitFor(() => {
      expect(screen.getByText("Court Order")).toBeInTheDocument();
    });
    const link = screen.getByText("case-abc");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/cases/case-abc");
  });

  it("marks duplicate documents", async () => {
    mockFetch(DUP_DOCS);
    render(<DocumentManager />);
    await waitFor(() =>
      expect(screen.getAllByText("Duplicate").length).toBe(2),
    );
    expect(screen.getAllByText("Motion to Dismiss").length).toBe(2);
  });
});
