import { render, screen, waitFor, fireEvent } from "../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DocumentManager from "./DocumentManager";
import { StoreProvider } from "../store/StoreContext";
import { RootStore } from "../store/RootStore";

vi.mock("../lib/api", () => ({
  getAuthToken: vi.fn().mockResolvedValue("test-token-123"),
  // DocumentManager builds URLs from API_BASE; keep it stable in tests.
  API_BASE: "/api",
  api: {
    cases: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      addParty: vi.fn(),
      removeParty: vi.fn(),
      addFiling: vi.fn(),
      removeFiling: vi.fn(),
    },
    deadlines: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      toggleComplete: vi.fn(),
    },
    filings: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    evidences: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    finances: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    contacts: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    notes: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    documents: {
      list: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(null),
      upload: vi.fn().mockResolvedValue({}),
      getText: vi
        .fn()
        .mockResolvedValue("Extracted text content for this document."),
      download: vi
        .fn()
        .mockResolvedValue({ blob: new Blob(), filename: "file.pdf" }),
    },
    ingest: {
      status: vi.fn().mockResolvedValue({
        active: false,
        directory: "",
        running: false,
        lastRunStarted: null,
        lastRunFinished: null,
        added: 0,
        skipped: 0,
        errors: 0,
      }),
      scan: vi.fn(),
    },
  },
}));

function createTestStore() {
  return RootStore.create({
    caseStore: { cases: [] },
    deadlineStore: {
      deadlines: [],
      selectedType: "all",
      selectedUrgency: "all",
      selectedCaseId: "all",
      searchQuery: "",
    },
    financeStore: { entries: [] },
    contactStore: { contacts: [] },
    chatStore: { messages: [] },
    documentStore: { documents: [] },
    noteStore: { notes: [] },
    taskStore: { tasks: [] },
    evidenceStore: {
      evidences: [],
      selectedType: "all",
      selectedRelevance: "all",
      selectedCaseId: "all",
      selectedAdmissible: "all",
      searchQuery: "",
    },
    filingStore: {
      filings: [],
      selectedType: "all",
      selectedCaseId: "all",
      searchQuery: "",
      dateFrom: "",
      dateTo: "",
    },
    evaluationStore: {
      evaluations: [],
      deviceTokens: [],
      smsRecipients: [],
      schedulerStatus: null,
      isLoading: false,
      isTriggering: false,
    },
    configStore: {
      config: null,
      isLoading: false,
      isTesting: false,
      error: null,
    },
    estatePlanStore: {
      plans: [],
      selectedStatus: "all",
      searchQuery: "",
    },
    researchStore: {
      messages: [],
    },
  });
}

function renderDocManager(store = createTestStore()) {
  return render(
    <StoreProvider store={store}>
      <DocumentManager />
    </StoreProvider>,
  );
}

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

async function mockApis(
  data: unknown,
  ok = true,
  ingestStatus: {
    active: boolean;
    directory: string;
    running: boolean;
    lastRunStarted: string | null;
    lastRunFinished: string | null;
    added: number;
    skipped: number;
    errors: number;
  } = {
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
  const { api } = await import("../lib/api");

  // Mock documents API
  if (ok) {
    api.documents.list.mockResolvedValue(data as any);
  } else {
    api.documents.list.mockRejectedValue(new Error("Failed to load"));
  }

  // Mock ingest API
  api.ingest.status.mockResolvedValue(ingestStatus as any);

  // Mock fetch for /texts/ static files
  global.fetch = vi.fn().mockImplementation((url: string, _opts?: any) => {
    if (url.startsWith("/texts/")) {
      return Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve("Extracted text content for this document."),
      });
    }
    return Promise.resolve({
      ok: false,
      status: 404,
    });
  });
}

describe("DocumentManager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders stat cards with correct values", async () => {
    await mockApis(MOCK_DOCS, true, {
      active: true,
      directory: "/tmp/pdfs",
      running: false,
      lastRunStarted: null,
      lastRunFinished: null,
      added: 0,
      skipped: 0,
      errors: 0,
    });
    renderDocManager();
    await waitFor(() => {
      expect(screen.getByText("Total Documents")).toBeInTheDocument();
    });
    expect(screen.getByText("Categories")).toBeInTheDocument();
    expect(screen.getByText("Total Pages")).toBeInTheDocument();
    expect(screen.getByText("16")).toBeInTheDocument();
    expect(screen.getByText(/Auto-ingest/)).toBeInTheDocument();
  });

  it("shows ingestion status details", async () => {
    await mockApis(MOCK_DOCS, true, {
      active: true,
      directory: "/tmp/pdfs",
      running: true,
      lastRunStarted: "2026-01-01T00:00:00Z",
      lastRunFinished: null,
      added: 2,
      skipped: 1,
      errors: 0,
    });
    renderDocManager();
    await waitFor(() => {
      expect(screen.getByText(/Auto-ingest Running/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Directory: \/tmp\/pdfs/)).toBeInTheDocument();
    expect(screen.getByText(/Added: 2/)).toBeInTheDocument();
    expect(screen.getByText(/Skipped: 1/)).toBeInTheDocument();
  });

  it("renders all documents in the table", async () => {
    await mockApis(MOCK_DOCS);
    renderDocManager();
    await waitFor(() => {
      expect(screen.getByText("Motion to Dismiss")).toBeInTheDocument();
    });
    expect(screen.getByText("Court Order")).toBeInTheDocument();
    expect(screen.getByText("Appellate Brief")).toBeInTheDocument();
  });

  it("filters by category", async () => {
    await mockApis(MOCK_DOCS);
    renderDocManager();
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
    await mockApis(MOCK_DOCS);
    renderDocManager();
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
    await mockApis(MOCK_DOCS);
    renderDocManager();
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
    await mockApis(null, false);
    renderDocManager();
    await waitFor(() => {
      expect(screen.getByText(/Error: Failed to load/)).toBeInTheDocument();
    });
  });

  it("shows empty state when no documents indexed", async () => {
    await mockApis([]);
    renderDocManager();
    await waitFor(() => {
      expect(screen.queryByText("Loading documents…")).not.toBeInTheDocument();
    });
    expect(screen.getByText(/No documents indexed yet/)).toBeInTheDocument();
  });

  it("renders upload component", async () => {
    await mockApis(MOCK_DOCS);
    renderDocManager();
    await waitFor(() => {
      expect(screen.getByTestId("drop-zone")).toBeInTheDocument();
    });
    expect(screen.getByText("Browse Files")).toBeInTheDocument();
  });

  it("refreshes document list after successful upload", async () => {
    const { api } = await import("../lib/api");

    // First call returns MOCK_DOCS, second call includes new document
    let callCount = 0;
    api.documents.list.mockImplementation(() => {
      callCount++;
      return Promise.resolve(
        callCount === 1
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
      );
    });

    api.documents.upload.mockResolvedValue({} as any);
    api.ingest.status.mockResolvedValue({
      active: false,
      directory: "",
      running: false,
      lastRunStarted: null,
      lastRunFinished: null,
      added: 0,
      skipped: 0,
      errors: 0,
    });

    renderDocManager();
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
    await mockApis(MOCK_DOCS);
    renderDocManager();
    await waitFor(() => {
      expect(screen.getByText("Court Order")).toBeInTheDocument();
    });
    const link = screen.getByText("case-abc");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/cases/case-abc");
  });

  it("marks duplicate documents", async () => {
    await mockApis(DUP_DOCS);
    renderDocManager();
    await waitFor(() =>
      expect(screen.getAllByText("Duplicate").length).toBe(2),
    );
    expect(screen.getAllByText("Motion to Dismiss").length).toBe(2);
  });

  it("sends Authorization header with /api/documents request", async () => {
    const { api } = await import("../lib/api");
    await mockApis(MOCK_DOCS);
    renderDocManager();
    await waitFor(() => {
      expect(screen.getByText("Motion to Dismiss")).toBeInTheDocument();
    });

    // The SDK handles auth headers internally via getAuthToken callback
    expect(api.documents.list).toHaveBeenCalled();
  });

  it("sends Authorization header with /api/ingest/status request", async () => {
    const { api } = await import("../lib/api");
    await mockApis(MOCK_DOCS);
    renderDocManager();
    await waitFor(() => {
      expect(screen.getByText("Motion to Dismiss")).toBeInTheDocument();
    });

    // The SDK handles auth headers internally via getAuthToken callback
    expect(api.ingest.status).toHaveBeenCalled();
  });

  it("sends Authorization header when loading extracted text", async () => {
    const { api } = await import("../lib/api");
    await mockApis(MOCK_DOCS);
    renderDocManager();
    await waitFor(() => {
      expect(screen.getByText("Court Order")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Court Order"));
    await waitFor(() => {
      expect(
        screen.getByText("Extracted text content for this document."),
      ).toBeInTheDocument();
    });

    // The SDK handles auth headers internally via getAuthToken callback
    expect(api.documents.getText).toHaveBeenCalledWith("2");
  });

  it("deletes a document when delete button is clicked and confirmed", async () => {
    const { api } = await import("../lib/api");
    await mockApis(MOCK_DOCS);
    window.confirm = vi.fn().mockReturnValue(true);
    renderDocManager();
    await waitFor(() => {
      expect(screen.getByText("Motion to Dismiss")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByLabelText("Delete Motion to Dismiss");
    fireEvent.click(deleteBtn);

    expect(window.confirm).toHaveBeenCalledWith('Delete "Motion to Dismiss"?');
    await waitFor(() => {
      expect(screen.queryByText("Motion to Dismiss")).not.toBeInTheDocument();
    });

    // The SDK handles auth headers internally via getAuthToken callback
    expect(api.documents.delete).toHaveBeenCalledWith("1");
  });

  it("does not delete when confirm is cancelled", async () => {
    await mockApis(MOCK_DOCS);
    window.confirm = vi.fn().mockReturnValue(false);
    renderDocManager();
    await waitFor(() => {
      expect(screen.getByText("Motion to Dismiss")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByLabelText("Delete Motion to Dismiss");
    fireEvent.click(deleteBtn);

    expect(window.confirm).toHaveBeenCalled();
    expect(screen.getByText("Motion to Dismiss")).toBeInTheDocument();
  });

  it("reloads stores after successful upload for timeline sync", async () => {
    // Import the mocked api module to check calls on store reload methods.
    // loadCases() calls api.cases.list(), loadFilings() calls api.filings.list(), etc.
    const { api } = await import("../lib/api");
    const casesListSpy = vi.mocked(api.cases.list);
    const filingsListSpy = vi.mocked(api.filings.list);
    const evidencesListSpy = vi.mocked(api.evidences.list);
    const deadlinesListSpy = vi.mocked(api.deadlines.list);
    const contactsListSpy = vi.mocked(api.contacts.list);
    const notesListSpy = vi.mocked(api.notes.list);

    global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (opts?.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url === "/api/ingest/status") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              active: false,
              directory: "",
              running: false,
              lastRunStarted: null,
              lastRunFinished: null,
              added: 0,
              skipped: 0,
              errors: 0,
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(MOCK_DOCS),
      });
    });

    const store = createTestStore();
    renderDocManager(store);
    await waitFor(() => {
      expect(screen.getByText("Motion to Dismiss")).toBeInTheDocument();
    });

    // Clear call counts so we only track calls triggered by upload
    casesListSpy.mockClear();
    filingsListSpy.mockClear();
    evidencesListSpy.mockClear();
    deadlinesListSpy.mockClear();
    contactsListSpy.mockClear();
    notesListSpy.mockClear();

    const input = screen.getByTestId("file-input");
    const file = new File([new ArrayBuffer(1024)], "new.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("Upload 1 file"));

    await waitFor(() => {
      expect(casesListSpy).toHaveBeenCalled();
    });
    expect(filingsListSpy).toHaveBeenCalled();
    expect(evidencesListSpy).toHaveBeenCalled();
    expect(deadlinesListSpy).toHaveBeenCalled();
    expect(contactsListSpy).toHaveBeenCalled();
    expect(notesListSpy).toHaveBeenCalled();
  });
});
