import { render, screen, fireEvent, act } from "../test-utils";
import { describe, it, expect, beforeEach, vi } from "vitest";
import Timeline from "./Timeline";
import { StoreProvider } from "../store/StoreContext";
import { RootStore } from "../store/RootStore";

// Mock the API module
vi.mock("../lib/api", () => ({
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
    researchStore: {
      messages: [],
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

  describe("scroll-to-zoom", () => {
    function createZoomStore() {
      return createTestStore({
        deadlineStore: {
          deadlines: [
            {
              id: "d1",
              title: "Early event",
              date: "2024-01-01",
              type: "filing",
              completed: false,
              caseId: "",
              description: "",
              priority: "medium",
            },
            {
              id: "d2",
              title: "Late event",
              date: "2025-01-01",
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
      });
    }

    function getDateInputValues() {
      const from = screen.getByTestId("timeline-date-from") as HTMLInputElement;
      const to = screen.getByTestId("timeline-date-to") as HTMLInputElement;
      return { from: from.value, to: to.value };
    }

    function getTimelineContainer() {
      // The zoomable container wraps the ruler; find via the cursor style
      const ruler = screen.getByText("2024");
      // Walk up to the grab-cursor container
      let el = ruler.parentElement!;
      while (el && !el.style?.cursor && !el.getAttribute("style")?.includes("grab")) {
        // The container is the one with the ref - it's the parent of the ruler box
        if (el.parentElement) {
          el = el.parentElement;
        } else break;
      }
      // Fallback: go to ruler's grandparent (ruler Box -> zoomable Box)
      return ruler.parentElement!.parentElement!;
    }

    it("zooms in when scrolling up (negative deltaY)", () => {
      renderTimeline(createZoomStore());
      const before = getDateInputValues();

      const container = getTimelineContainer();
      Object.defineProperty(container, "getBoundingClientRect", {
        value: () => ({ left: 0, width: 1000, top: 0, height: 200, right: 1000, bottom: 200 }),
      });

      // Scroll up (zoom in) at the center of the timeline
      act(() => {
        container.dispatchEvent(
          new WheelEvent("wheel", { deltaY: -100, clientX: 500, bubbles: true }),
        );
      });

      const after = getDateInputValues();
      // Range should be narrower: start moved forward and/or end moved backward
      expect(after.from > before.from || after.to < before.to).toBe(true);
    });

    it("zooms out when scrolling down (positive deltaY)", () => {
      renderTimeline(createZoomStore());
      const before = getDateInputValues();

      const container = getTimelineContainer();
      Object.defineProperty(container, "getBoundingClientRect", {
        value: () => ({ left: 0, width: 1000, top: 0, height: 200, right: 1000, bottom: 200 }),
      });

      // Scroll down (zoom out)
      act(() => {
        container.dispatchEvent(
          new WheelEvent("wheel", { deltaY: 100, clientX: 500, bubbles: true }),
        );
      });

      const after = getDateInputValues();
      // Range should be wider: start moved backward and/or end moved forward
      expect(after.from < before.from || after.to > before.to).toBe(true);
    });

    it("zooms anchored to cursor position", () => {
      renderTimeline(createZoomStore());

      const container = getTimelineContainer();
      Object.defineProperty(container, "getBoundingClientRect", {
        value: () => ({ left: 0, width: 1000, top: 0, height: 200, right: 1000, bottom: 200 }),
      });

      // Zoom in at the left edge (clientX=0)
      act(() => {
        container.dispatchEvent(
          new WheelEvent("wheel", { deltaY: -100, clientX: 0, bubbles: true }),
        );
      });
      const afterLeft = getDateInputValues();

      // Start should stay roughly the same when zooming at the left edge
      // (the end should pull in more than the start moves)
      expect(afterLeft.to < "2025-01-01").toBe(true);
    });
  });

  describe("click-and-drag panning", () => {
    function createPanStore() {
      return createTestStore({
        deadlineStore: {
          deadlines: [
            {
              id: "d1",
              title: "Start event",
              date: "2024-01-01",
              type: "filing",
              completed: false,
              caseId: "",
              description: "",
              priority: "medium",
            },
            {
              id: "d2",
              title: "End event",
              date: "2025-01-01",
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
      });
    }

    function getDateInputValues() {
      const from = screen.getByTestId("timeline-date-from") as HTMLInputElement;
      const to = screen.getByTestId("timeline-date-to") as HTMLInputElement;
      return { from: from.value, to: to.value };
    }

    function getTimelineContainer() {
      const ruler = screen.getByText("2024");
      return ruler.parentElement!.parentElement!;
    }

    it("pans the date range when dragging left (shifts forward in time)", () => {
      renderTimeline(createPanStore());
      const before = getDateInputValues();

      const container = getTimelineContainer();
      Object.defineProperty(container, "getBoundingClientRect", {
        value: () => ({ left: 0, width: 1000, top: 0, height: 200, right: 1000, bottom: 200 }),
      });

      // Drag left: mousedown at 500, then mousemove to 300 (200px left)
      act(() => {
        container.dispatchEvent(
          new MouseEvent("mousedown", { clientX: 500, bubbles: true }),
        );
      });
      act(() => {
        document.dispatchEvent(
          new MouseEvent("mousemove", { clientX: 300, bubbles: true }),
        );
      });
      act(() => {
        document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      });

      const after = getDateInputValues();
      // Dragging left shifts the range forward in time
      expect(after.from > before.from).toBe(true);
      expect(after.to > before.to).toBe(true);
    });

    it("pans the date range when dragging right (shifts backward in time)", () => {
      renderTimeline(createPanStore());
      const before = getDateInputValues();

      const container = getTimelineContainer();
      Object.defineProperty(container, "getBoundingClientRect", {
        value: () => ({ left: 0, width: 1000, top: 0, height: 200, right: 1000, bottom: 200 }),
      });

      // Drag right: mousedown at 500, then mousemove to 700 (200px right)
      act(() => {
        container.dispatchEvent(
          new MouseEvent("mousedown", { clientX: 500, bubbles: true }),
        );
      });
      act(() => {
        document.dispatchEvent(
          new MouseEvent("mousemove", { clientX: 700, bubbles: true }),
        );
      });
      act(() => {
        document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      });

      const after = getDateInputValues();
      // Dragging right shifts the range backward in time
      expect(after.from < before.from).toBe(true);
      expect(after.to < before.to).toBe(true);
    });

    it("preserves range width when panning (only shifts, no zoom)", () => {
      renderTimeline(createPanStore());
      const before = getDateInputValues();
      const rangeBefore =
        new Date(before.to).getTime() - new Date(before.from).getTime();

      const container = getTimelineContainer();
      Object.defineProperty(container, "getBoundingClientRect", {
        value: () => ({ left: 0, width: 1000, top: 0, height: 200, right: 1000, bottom: 200 }),
      });

      act(() => {
        container.dispatchEvent(
          new MouseEvent("mousedown", { clientX: 500, bubbles: true }),
        );
      });
      act(() => {
        document.dispatchEvent(
          new MouseEvent("mousemove", { clientX: 300, bubbles: true }),
        );
      });
      act(() => {
        document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      });

      const after = getDateInputValues();
      const rangeAfter =
        new Date(after.to).getTime() - new Date(after.from).getTime();

      // The range width should be the same (panning doesn't zoom)
      // Allow 1 day tolerance due to date rounding
      const oneDayMs = 24 * 60 * 60 * 1000;
      expect(Math.abs(rangeAfter - rangeBefore)).toBeLessThanOrEqual(oneDayMs);
    });

    it("stops panning on mouseup", () => {
      renderTimeline(createPanStore());

      const container = getTimelineContainer();
      Object.defineProperty(container, "getBoundingClientRect", {
        value: () => ({ left: 0, width: 1000, top: 0, height: 200, right: 1000, bottom: 200 }),
      });

      // Drag and release
      act(() => {
        container.dispatchEvent(
          new MouseEvent("mousedown", { clientX: 500, bubbles: true }),
        );
      });
      act(() => {
        document.dispatchEvent(
          new MouseEvent("mousemove", { clientX: 300, bubbles: true }),
        );
      });
      act(() => {
        document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      });

      const afterRelease = getDateInputValues();

      // Move mouse again after release — should NOT change anything
      act(() => {
        document.dispatchEvent(
          new MouseEvent("mousemove", { clientX: 100, bubbles: true }),
        );
      });

      const afterExtraMove = getDateInputValues();
      expect(afterExtraMove.from).toBe(afterRelease.from);
      expect(afterExtraMove.to).toBe(afterRelease.to);
    });
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
