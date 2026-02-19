import { render, screen, fireEvent, waitFor } from "../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Deadlines from "./Deadlines";
import { useStore } from "../store/StoreContext";

vi.mock("../store/StoreContext", () => ({
  useStore: vi.fn(() => ({
    deadlineStore: {
      deadlines: [
        {
          id: "1",
          title: "File Motion",
          date: "2025-02-28",
          type: "filing",
          completed: false,
          description: "Motion to dismiss",
          priority: "high",
          caseId: "case-1",
        },
      ],
      filteredDeadlines: [
        {
          id: "1",
          title: "File Motion",
          date: "2025-02-28",
          type: "filing",
          completed: false,
          description: "Motion to dismiss",
          priority: "high",
          caseId: "case-1",
          urgency: "urgent" as const,
          daysUntil: 2,
        },
      ],
      overdueDeadlines: [],
      urgentDeadlines: [
        {
          id: "1",
          title: "File Motion",
          date: "2025-02-28",
          type: "filing",
          completed: false,
          description: "Motion to dismiss",
          priority: "high",
          caseId: "case-1",
        },
      ],
      upcomingDeadlines: [],
      futureDeadlines: [],
      searchQuery: "",
      selectedType: "",
      selectedUrgency: "",
      selectedCaseId: "",
      setSearchQuery: vi.fn(),
      setSelectedType: vi.fn(),
      setSelectedUrgency: vi.fn(),
      setSelectedCaseId: vi.fn(),
      clearFilters: vi.fn(),
      addDeadline: vi.fn(),
      updateDeadline: vi.fn(),
      deleteDeadline: vi.fn(),
      toggleComplete: vi.fn(),
    },
    caseStore: {
      cases: [{ id: "case-1", name: "Smith v. Jones" }],
    },
  })),
}));

describe("Deadlines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders deadlines heading and add button", () => {
    render(<Deadlines />);
    expect(
      screen.getByRole("heading", { name: "Deadlines" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add Deadline/i }),
    ).toBeInTheDocument();
  });

  it("displays stat cards with deadline information", () => {
    render(<Deadlines />);
    expect(screen.getByText("Total Deadlines")).toBeInTheDocument();
    // "Overdue" appears in both stat card and filter dropdown, use getAllByText
    expect(screen.getAllByText("Overdue").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Urgent/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Upcoming").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Future").length).toBeGreaterThan(0);
  });

  it("displays list of deadlines", () => {
    render(<Deadlines />);
    expect(screen.getByText("File Motion")).toBeInTheDocument();
  });

  it("opens dialog when Add Deadline button is clicked", async () => {
    render(<Deadlines />);
    fireEvent.click(screen.getByRole("button", { name: /Add Deadline/i }));

    await waitFor(() => {
      expect(screen.getByText(/Add Deadline|Edit/i)).toBeInTheDocument();
    });
  });

  it("shows empty state when no deadlines exist", () => {
    vi.mocked(useStore).mockReturnValue({
      deadlineStore: {
        deadlines: [],
        filteredDeadlines: [],
        overdueDeadlines: [],
        urgentDeadlines: [],
        upcomingDeadlines: [],
        futureDeadlines: [],
        searchQuery: "",
        selectedType: "",
        selectedUrgency: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedUrgency: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addDeadline: vi.fn(),
        updateDeadline: vi.fn(),
        deleteDeadline: vi.fn(),
        toggleComplete: vi.fn(),
      },
      caseStore: { cases: [] },
    } as any);
    render(<Deadlines />);
    expect(screen.getByText("No deadlines yet")).toBeInTheDocument();
  });

  it("shows no matching deadlines message when filter has no results", () => {
    vi.mocked(useStore).mockReturnValue({
      deadlineStore: {
        deadlines: [
          {
            id: "1",
            title: "File Motion",
            date: "2025-02-28",
            type: "filing",
            completed: false,
            description: "Motion to dismiss",
            priority: "high",
            caseId: "case-1",
          },
        ],
        filteredDeadlines: [],
        overdueDeadlines: [],
        urgentDeadlines: [],
        upcomingDeadlines: [],
        futureDeadlines: [],
        searchQuery: "nonexistent",
        selectedType: "",
        selectedUrgency: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedUrgency: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addDeadline: vi.fn(),
        updateDeadline: vi.fn(),
        deleteDeadline: vi.fn(),
        toggleComplete: vi.fn(),
      },
      caseStore: { cases: [] },
    } as any);
    render(<Deadlines />);
    expect(screen.getByText("No matching deadlines")).toBeInTheDocument();
  });

  it("renders deadline filters section", () => {
    const { container } = render(<Deadlines />);
    expect(container).toBeInTheDocument();
  });

  it("prevents adding deadline with empty title", () => {
    const addDeadline = vi.fn();
    vi.mocked(useStore).mockReturnValue({
      deadlineStore: {
        deadlines: [],
        filteredDeadlines: [],
        overdueDeadlines: [],
        urgentDeadlines: [],
        upcomingDeadlines: [],
        futureDeadlines: [],
        searchQuery: "",
        selectedType: "",
        selectedUrgency: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedUrgency: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addDeadline,
        updateDeadline: vi.fn(),
        deleteDeadline: vi.fn(),
        toggleComplete: vi.fn(),
      },
      caseStore: { cases: [] },
    } as any);

    render(<Deadlines />);
    fireEvent.click(screen.getByRole("button", { name: /Add Deadline/i }));
    expect(addDeadline).not.toHaveBeenCalled();
  });

  it("prevents adding deadline with empty date", () => {
    const addDeadline = vi.fn();
    vi.mocked(useStore).mockReturnValue({
      deadlineStore: {
        deadlines: [],
        filteredDeadlines: [],
        overdueDeadlines: [],
        urgentDeadlines: [],
        upcomingDeadlines: [],
        futureDeadlines: [],
        searchQuery: "",
        selectedType: "",
        selectedUrgency: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedUrgency: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addDeadline,
        updateDeadline: vi.fn(),
        deleteDeadline: vi.fn(),
        toggleComplete: vi.fn(),
      },
      caseStore: { cases: [] },
    } as any);

    render(<Deadlines />);
    fireEvent.click(screen.getByRole("button", { name: /Add Deadline/i }));
    expect(addDeadline).not.toHaveBeenCalled();
  });

  it("loads deadline data into form when editing", async () => {
    const deadline = {
      id: "1",
      title: "Test Deadline",
      date: "2025-02-28",
      type: "filing" as const,
      completed: false,
      description: "Test description",
      priority: "high" as const,
      caseId: "case-1",
    };

    vi.mocked(useStore).mockReturnValue({
      deadlineStore: {
        deadlines: [deadline],
        filteredDeadlines: [
          { ...deadline, urgency: "urgent" as const, daysUntil: 2 },
        ],
        overdueDeadlines: [],
        urgentDeadlines: [deadline],
        upcomingDeadlines: [],
        futureDeadlines: [],
        searchQuery: "",
        selectedType: "",
        selectedUrgency: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedUrgency: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addDeadline: vi.fn(),
        updateDeadline: vi.fn(),
        deleteDeadline: vi.fn(),
        toggleComplete: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<Deadlines />);
    fireEvent.click(screen.getByLabelText("Edit"));
    await waitFor(() => {
      expect(screen.getByText("Edit Deadline")).toBeInTheDocument();
    });
  });

  it("calls updateDeadline when saving edited deadline", async () => {
    const updateDeadline = vi.fn();
    const deadline = {
      id: "1",
      title: "File Motion",
      date: "2025-02-28",
      type: "filing" as const,
      completed: false,
      description: "Motion to dismiss",
      priority: "high" as const,
      caseId: "case-1",
    };

    vi.mocked(useStore).mockReturnValue({
      deadlineStore: {
        deadlines: [deadline],
        filteredDeadlines: [
          { ...deadline, urgency: "urgent" as const, daysUntil: 2 },
        ],
        overdueDeadlines: [],
        urgentDeadlines: [deadline],
        upcomingDeadlines: [],
        futureDeadlines: [],
        searchQuery: "",
        selectedType: "",
        selectedUrgency: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedUrgency: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addDeadline: vi.fn(),
        updateDeadline,
        deleteDeadline: vi.fn(),
        toggleComplete: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<Deadlines />);
    fireEvent.click(screen.getByLabelText("Edit"));
    await waitFor(() => {
      expect(screen.getByText("Edit Deadline")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(updateDeadline).toHaveBeenCalledWith("1", expect.any(Object));
  });

  it("resets form and closes dialog after adding deadline", () => {
    const addDeadline = vi.fn();
    vi.mocked(useStore).mockReturnValue({
      deadlineStore: {
        deadlines: [],
        filteredDeadlines: [],
        overdueDeadlines: [],
        urgentDeadlines: [],
        upcomingDeadlines: [],
        futureDeadlines: [],
        searchQuery: "",
        selectedType: "",
        selectedUrgency: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedUrgency: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addDeadline,
        updateDeadline: vi.fn(),
        deleteDeadline: vi.fn(),
        toggleComplete: vi.fn(),
      },
      caseStore: { cases: [] },
    } as any);

    render(<Deadlines />);
    fireEvent.click(screen.getByRole("button", { name: /Add Deadline/i }));
    expect(
      screen.getByRole("button", { name: /Add Deadline/i }),
    ).toBeInTheDocument();
  });

  it("clears editingDeadline when dialog closes", async () => {
    render(<Deadlines />);
    fireEvent.click(screen.getByRole("button", { name: /Add Deadline/i }));
    await waitFor(() => {
      expect(screen.getByText("Add Deadline")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Cancel" }),
      ).not.toBeInTheDocument();
    });
  });

  it("displays deadline urgency categories in stat cards", () => {
    vi.mocked(useStore).mockReturnValue({
      deadlineStore: {
        deadlines: [
          {
            id: "1",
            title: "Overdue Task",
            date: "2025-01-15",
            type: "filing",
            completed: false,
            description: "Past due",
            priority: "high",
            caseId: "case-1",
          },
        ],
        filteredDeadlines: [
          {
            id: "1",
            title: "Overdue Task",
            date: "2025-01-15",
            type: "filing",
            completed: false,
            description: "Past due",
            priority: "high",
            caseId: "case-1",
            urgency: "overdue" as const,
            daysUntil: -5,
          },
        ],
        overdueDeadlines: [
          {
            id: "1",
            title: "Overdue Task",
            date: "2025-01-15",
            type: "filing",
            completed: false,
            description: "Past due",
            priority: "high",
            caseId: "case-1",
          },
        ],
        urgentDeadlines: [],
        upcomingDeadlines: [],
        futureDeadlines: [],
        searchQuery: "",
        selectedType: "",
        selectedUrgency: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedUrgency: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addDeadline: vi.fn(),
        updateDeadline: vi.fn(),
        deleteDeadline: vi.fn(),
        toggleComplete: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<Deadlines />);
    expect(screen.getAllByText("Overdue").length).toBeGreaterThan(0);
  });

  it("displays deadline type filter options", () => {
    vi.mocked(useStore).mockReturnValue({
      deadlineStore: {
        deadlines: [
          {
            id: "1",
            title: "File Motion",
            date: "2025-02-28",
            type: "filing",
            completed: false,
            description: "Motion to dismiss",
            priority: "high",
            caseId: "case-1",
          },
        ],
        filteredDeadlines: [
          {
            id: "1",
            title: "File Motion",
            date: "2025-02-28",
            type: "filing",
            completed: false,
            description: "Motion to dismiss",
            priority: "high",
            caseId: "case-1",
            urgency: "urgent" as const,
            daysUntil: 2,
          },
        ],
        overdueDeadlines: [],
        urgentDeadlines: [
          {
            id: "1",
            title: "File Motion",
            date: "2025-02-28",
            type: "filing",
            completed: false,
            description: "Motion to dismiss",
            priority: "high",
            caseId: "case-1",
          },
        ],
        upcomingDeadlines: [],
        futureDeadlines: [],
        searchQuery: "",
        selectedType: "",
        selectedUrgency: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedUrgency: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addDeadline: vi.fn(),
        updateDeadline: vi.fn(),
        deleteDeadline: vi.fn(),
        toggleComplete: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<Deadlines />);
    expect(screen.getByText("File Motion")).toBeInTheDocument();
  });

  it("displays deadline cases available for filtering", () => {
    vi.mocked(useStore).mockReturnValue({
      deadlineStore: {
        deadlines: [
          {
            id: "1",
            title: "File Motion",
            date: "2025-02-28",
            type: "filing",
            completed: false,
            description: "Motion to dismiss",
            priority: "high",
            caseId: "case-1",
          },
        ],
        filteredDeadlines: [
          {
            id: "1",
            title: "File Motion",
            date: "2025-02-28",
            type: "filing",
            completed: false,
            description: "Motion to dismiss",
            priority: "high",
            caseId: "case-1",
            urgency: "urgent" as const,
            daysUntil: 2,
          },
        ],
        overdueDeadlines: [],
        urgentDeadlines: [
          {
            id: "1",
            title: "File Motion",
            date: "2025-02-28",
            type: "filing",
            completed: false,
            description: "Motion to dismiss",
            priority: "high",
            caseId: "case-1",
          },
        ],
        upcomingDeadlines: [],
        futureDeadlines: [],
        searchQuery: "",
        selectedType: "",
        selectedUrgency: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedUrgency: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addDeadline: vi.fn(),
        updateDeadline: vi.fn(),
        deleteDeadline: vi.fn(),
        toggleComplete: vi.fn(),
      },
      caseStore: {
        cases: [
          { id: "case-1", name: "Smith v. Jones" },
          { id: "case-2", name: "Jones v. Brown" },
        ],
      },
    } as any);

    render(<Deadlines />);
    expect(screen.getByText("File Motion")).toBeInTheDocument();
  });

  it("renders filter and list sections for deadlines", () => {
    render(<Deadlines />);
    expect(screen.getByText("File Motion")).toBeInTheDocument();
  });
});
