import { render, screen, fireEvent } from "../test-utils";
import { describe, it, expect, beforeEach, vi } from "vitest";
import Timeline from "./Timeline";
import { StoreProvider } from "../store/StoreContext";
import { RootStore } from "../store/RootStore";

// Mock the API module
vi.mock("../lib/api", () => ({
  api: {
    cases: { list: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), delete: vi.fn(), addParty: vi.fn(), removeParty: vi.fn(), addFiling: vi.fn(), removeFiling: vi.fn() },
    deadlines: { list: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), delete: vi.fn(), toggleComplete: vi.fn() },
    filings: { list: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    evidences: { list: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    finances: { list: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    contacts: { list: vi.fn().mockResolvedValue([]) },
    documents: { list: vi.fn().mockResolvedValue([]) },
  },
}));

function createTestStore(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  });
}

function renderTimeline(store = createTestStore()) {
  return render(
    <StoreProvider store={store}>
      <Timeline />
    </StoreProvider>,
  );
}

describe("Timeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders timeline heading", () => {
    renderTimeline();
    expect(
      screen.getByRole("heading", { name: "Timeline" }),
    ).toBeInTheDocument();
  });

  it("shows empty state when no data", () => {
    renderTimeline();
    expect(screen.getByText(/No data yet/)).toBeInTheDocument();
  });

  it("displays source filter badges", () => {
    renderTimeline();
    expect(screen.getAllByText("Deadlines").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Filings").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Evidence").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cases").length).toBeGreaterThan(0);
  });

  it("displays events from deadlines", () => {
    const store = createTestStore({
      deadlineStore: {
        deadlines: [
          {
            id: "d1",
            title: "File motion",
            date: "2024-06-15",
            type: "filing",
            completed: false,
            caseId: "",
            description: "Important deadline",
            priority: "high",
          },
        ],
        selectedType: "all",
        selectedUrgency: "all",
        selectedCaseId: "all",
        searchQuery: "",
      },
    });
    renderTimeline(store);
    expect(screen.getByText(/File motion/)).toBeInTheDocument();
    expect(screen.getByText(/1 events/)).toBeInTheDocument();
  });

  it("displays events from filings", () => {
    const store = createTestStore({
      filingStore: {
        filings: [
          {
            id: "f1",
            title: "Complaint filed",
            date: "2024-03-01",
            type: "complaint",
            notes: "",
            caseId: "",
          },
        ],
        selectedType: "all",
        selectedCaseId: "all",
        searchQuery: "",
        dateFrom: "",
        dateTo: "",
      },
    });
    renderTimeline(store);
    expect(screen.getByText(/Complaint filed/)).toBeInTheDocument();
  });

  it("displays events from multiple sources", () => {
    const store = createTestStore({
      deadlineStore: {
        deadlines: [
          {
            id: "d1",
            title: "Hearing date",
            date: "2024-05-10",
            type: "hearing",
            completed: false,
            caseId: "",
            description: "",
            priority: "medium",
          },
        ],
        selectedType: "all",
        selectedUrgency: "all",
        selectedCaseId: "all",
        searchQuery: "",
      },
      filingStore: {
        filings: [
          {
            id: "f1",
            title: "Answer filed",
            date: "2024-04-01",
            type: "",
            notes: "",
            caseId: "",
          },
        ],
        selectedType: "all",
        selectedCaseId: "all",
        searchQuery: "",
        dateFrom: "",
        dateTo: "",
      },
    });
    renderTimeline(store);
    expect(screen.getByText(/Hearing date/)).toBeInTheDocument();
    expect(screen.getByText(/Answer filed/)).toBeInTheDocument();
    expect(screen.getByText(/2 events/)).toBeInTheDocument();
  });

  it("filters events by source when badge is clicked", () => {
    const store = createTestStore({
      deadlineStore: {
        deadlines: [
          {
            id: "d1",
            title: "Deadline event",
            date: "2024-05-10",
            type: "filing",
            completed: false,
            caseId: "",
            description: "",
            priority: "medium",
          },
        ],
        selectedType: "all",
        selectedUrgency: "all",
        selectedCaseId: "all",
        searchQuery: "",
      },
      filingStore: {
        filings: [
          {
            id: "f1",
            title: "Filing event",
            date: "2024-04-01",
            type: "",
            notes: "",
            caseId: "",
          },
        ],
        selectedType: "all",
        selectedCaseId: "all",
        searchQuery: "",
        dateFrom: "",
        dateTo: "",
      },
    });
    renderTimeline(store);

    // Click on Filings filter
    const filingsElements = screen.getAllByText("Filings");
    fireEvent.click(filingsElements[0]);

    expect(screen.getByText(/1 events/)).toBeInTheDocument();
    expect(screen.getByText(/Filing event/)).toBeInTheDocument();
  });

  it("displays date range filters", () => {
    const store = createTestStore({
      deadlineStore: {
        deadlines: [
          {
            id: "d1",
            title: "Test",
            date: "2024-01-15",
            type: "other",
            completed: false,
            caseId: "",
            description: "",
            priority: "medium",
          },
        ],
        selectedType: "all",
        selectedUrgency: "all",
        selectedCaseId: "all",
        searchQuery: "",
      },
    });
    renderTimeline(store);
    const dateInputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
    expect(dateInputs.length).toBeGreaterThanOrEqual(2);
  });

  it("displays event count", () => {
    renderTimeline();
    const eventCountText = screen.getByText(/0 events/);
    expect(eventCountText).toBeInTheDocument();
  });

  it("shows legend with source colors", () => {
    renderTimeline();
    expect(screen.getByText("Legend:")).toBeInTheDocument();
  });

  it("allows source filter toggle on/off", () => {
    const store = createTestStore({
      deadlineStore: {
        deadlines: [
          {
            id: "d1",
            title: "Test deadline",
            date: "2024-01-15",
            type: "other",
            completed: false,
            caseId: "",
            description: "",
            priority: "medium",
          },
        ],
        selectedType: "all",
        selectedUrgency: "all",
        selectedCaseId: "all",
        searchQuery: "",
      },
    });
    renderTimeline(store);
    const deadlinesElements = screen.getAllByText("Deadlines");
    fireEvent.click(deadlinesElements[0]);
    fireEvent.click(deadlinesElements[0]);
    expect(screen.getByText(/1 events/)).toBeInTheDocument();
  });

  it("marks high-priority deadlines as critical", () => {
    const store = createTestStore({
      deadlineStore: {
        deadlines: [
          {
            id: "d1",
            title: "Urgent deadline",
            date: "2024-06-15",
            type: "filing",
            completed: false,
            caseId: "",
            description: "Critical filing",
            priority: "high",
          },
        ],
        selectedType: "all",
        selectedUrgency: "all",
        selectedCaseId: "all",
        searchQuery: "",
      },
    });
    renderTimeline(store);
    // The critical warning symbol appears in the event row and the legend
    expect(screen.getAllByText(/\u26A0/).length).toBeGreaterThanOrEqual(2);
  });
});
