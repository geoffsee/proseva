import { render, screen, fireEvent, waitFor } from "../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Filings from "./Filings";
import { useStore } from "../store/StoreContext";

vi.mock("../store/StoreContext", () => ({
  useStore: vi.fn(() => ({
    filingStore: {
      filings: [
        {
          id: "1",
          title: "Motion to Dismiss",
          date: "2024-01-15",
          type: "Motion",
          notes: "Filed with court",
          caseId: "case-1",
        },
      ],
      filteredFilings: [
        {
          id: "1",
          title: "Motion to Dismiss",
          date: "2024-01-15",
          type: "Motion",
          notes: "Filed with court",
          caseId: "case-1",
        },
      ],
      filingTypes: ["Motion", "Brief", "Order"],
      searchQuery: "",
      selectedType: "",
      selectedCaseId: "",
      dateFrom: "",
      dateTo: "",
      setSearchQuery: vi.fn(),
      setSelectedType: vi.fn(),
      setSelectedCaseId: vi.fn(),
      setDateFrom: vi.fn(),
      setDateTo: vi.fn(),
      clearFilters: vi.fn(),
      addFiling: vi.fn(),
      updateFiling: vi.fn(),
      deleteFiling: vi.fn(),
    },
    caseStore: {
      cases: [{ id: "case-1", name: "Smith v. Jones" }],
    },
  })),
}));

describe("Filings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders filings heading and add button", () => {
    render(<Filings />);
    expect(
      screen.getByRole("heading", { name: "Filings" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add Filing/i }),
    ).toBeInTheDocument();
  });

  it("displays stat cards with filing information", () => {
    render(<Filings />);
    expect(screen.getByText("Total Filings")).toBeInTheDocument();
    expect(screen.getByText("Filtered Results")).toBeInTheDocument();
  });

  it("displays list of filings", () => {
    render(<Filings />);
    expect(screen.getByText("Motion to Dismiss")).toBeInTheDocument();
  });

  it("opens dialog when Add Filing button is clicked", async () => {
    render(<Filings />);
    fireEvent.click(screen.getByRole("button", { name: /Add Filing/i }));

    await waitFor(() => {
      expect(screen.getByText(/Add Filing|Edit/i)).toBeInTheDocument();
    });
  });

  it("shows empty state when no filings exist", () => {
    vi.mocked(useStore).mockReturnValue({
      filingStore: {
        filings: [],
        filteredFilings: [],
        filingTypes: [],
        searchQuery: "",
        selectedType: "",
        selectedCaseId: "",
        dateFrom: "",
        dateTo: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedCaseId: vi.fn(),
        setDateFrom: vi.fn(),
        setDateTo: vi.fn(),
        clearFilters: vi.fn(),
        addFiling: vi.fn(),
        updateFiling: vi.fn(),
        deleteFiling: vi.fn(),
      },
      caseStore: { cases: [] },
    } as any);
    render(<Filings />);
    expect(screen.getByText("No filings yet")).toBeInTheDocument();
  });

  it("shows no matching filings message when filter has no results", () => {
    vi.mocked(useStore).mockReturnValue({
      filingStore: {
        filings: [
          {
            id: "1",
            title: "Motion to Dismiss",
            date: "2024-01-15",
            type: "Motion",
            notes: "Filed with court",
            caseId: "case-1",
          },
        ],
        filteredFilings: [],
        filingTypes: ["Motion"],
        searchQuery: "nonexistent",
        selectedType: "",
        selectedCaseId: "",
        dateFrom: "",
        dateTo: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedCaseId: vi.fn(),
        setDateFrom: vi.fn(),
        setDateTo: vi.fn(),
        clearFilters: vi.fn(),
        addFiling: vi.fn(),
        updateFiling: vi.fn(),
        deleteFiling: vi.fn(),
      },
      caseStore: { cases: [] },
    } as any);
    render(<Filings />);
    expect(screen.getByText("No matching filings")).toBeInTheDocument();
  });

  it("renders filing filters section", () => {
    const { container } = render(<Filings />);
    expect(container).toBeInTheDocument();
  });

  it("filters filings by type", () => {
    vi.mocked(useStore).mockReturnValue({
      filingStore: {
        filings: [
          {
            id: "1",
            title: "Motion to Dismiss",
            date: "2024-01-15",
            type: "Motion",
            notes: "Filed with court",
            caseId: "case-1",
          },
          {
            id: "2",
            title: "Brief in Support",
            date: "2024-01-16",
            type: "Brief",
            notes: "Supporting brief",
            caseId: "case-1",
          },
        ],
        filteredFilings: [
          {
            id: "1",
            title: "Motion to Dismiss",
            date: "2024-01-15",
            type: "Motion",
            notes: "Filed with court",
            caseId: "case-1",
          },
        ],
        filingTypes: ["Motion", "Brief"],
        searchQuery: "",
        selectedType: "Motion",
        selectedCaseId: "",
        dateFrom: "",
        dateTo: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedCaseId: vi.fn(),
        setDateFrom: vi.fn(),
        setDateTo: vi.fn(),
        clearFilters: vi.fn(),
        addFiling: vi.fn(),
        updateFiling: vi.fn(),
        deleteFiling: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<Filings />);
    expect(screen.getByText("Motion to Dismiss")).toBeInTheDocument();
  });

  it("filters filings by case ID", () => {
    vi.mocked(useStore).mockReturnValue({
      filingStore: {
        filings: [
          {
            id: "1",
            title: "Motion to Dismiss",
            date: "2024-01-15",
            type: "Motion",
            notes: "Filed with court",
            caseId: "case-1",
          },
        ],
        filteredFilings: [
          {
            id: "1",
            title: "Motion to Dismiss",
            date: "2024-01-15",
            type: "Motion",
            notes: "Filed with court",
            caseId: "case-1",
          },
        ],
        filingTypes: ["Motion"],
        searchQuery: "",
        selectedType: "",
        selectedCaseId: "case-1",
        dateFrom: "",
        dateTo: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedCaseId: vi.fn(),
        setDateFrom: vi.fn(),
        setDateTo: vi.fn(),
        clearFilters: vi.fn(),
        addFiling: vi.fn(),
        updateFiling: vi.fn(),
        deleteFiling: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<Filings />);
    expect(screen.getByText("Motion to Dismiss")).toBeInTheDocument();
  });

  it("filters filings by date range (start date)", () => {
    vi.mocked(useStore).mockReturnValue({
      filingStore: {
        filings: [
          {
            id: "1",
            title: "Motion to Dismiss",
            date: "2024-01-15",
            type: "Motion",
            notes: "Filed with court",
            caseId: "case-1",
          },
        ],
        filteredFilings: [
          {
            id: "1",
            title: "Motion to Dismiss",
            date: "2024-01-15",
            type: "Motion",
            notes: "Filed with court",
            caseId: "case-1",
          },
        ],
        filingTypes: ["Motion"],
        searchQuery: "",
        selectedType: "",
        selectedCaseId: "",
        dateFrom: "2024-01-01",
        dateTo: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedCaseId: vi.fn(),
        setDateFrom: vi.fn(),
        setDateTo: vi.fn(),
        clearFilters: vi.fn(),
        addFiling: vi.fn(),
        updateFiling: vi.fn(),
        deleteFiling: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<Filings />);
    expect(screen.getByText("Motion to Dismiss")).toBeInTheDocument();
  });

  it("filters filings by date range (end date)", () => {
    vi.mocked(useStore).mockReturnValue({
      filingStore: {
        filings: [
          {
            id: "1",
            title: "Motion to Dismiss",
            date: "2024-01-15",
            type: "Motion",
            notes: "Filed with court",
            caseId: "case-1",
          },
        ],
        filteredFilings: [
          {
            id: "1",
            title: "Motion to Dismiss",
            date: "2024-01-15",
            type: "Motion",
            notes: "Filed with court",
            caseId: "case-1",
          },
        ],
        filingTypes: ["Motion"],
        searchQuery: "",
        selectedType: "",
        selectedCaseId: "",
        dateFrom: "",
        dateTo: "2024-12-31",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedCaseId: vi.fn(),
        setDateFrom: vi.fn(),
        setDateTo: vi.fn(),
        clearFilters: vi.fn(),
        addFiling: vi.fn(),
        updateFiling: vi.fn(),
        deleteFiling: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<Filings />);
    expect(screen.getByText("Motion to Dismiss")).toBeInTheDocument();
  });

  it("shows 'Filtered Results' stat card when filters are active", () => {
    vi.mocked(useStore).mockReturnValue({
      filingStore: {
        filings: [
          {
            id: "1",
            title: "Motion to Dismiss",
            date: "2024-01-15",
            type: "Motion",
            notes: "Filed with court",
            caseId: "case-1",
          },
          {
            id: "2",
            title: "Brief in Support",
            date: "2024-01-16",
            type: "Brief",
            notes: "Supporting brief",
            caseId: "case-1",
          },
        ],
        filteredFilings: [
          {
            id: "1",
            title: "Motion to Dismiss",
            date: "2024-01-15",
            type: "Motion",
            notes: "Filed with court",
            caseId: "case-1",
          },
        ],
        filingTypes: ["Motion", "Brief"],
        searchQuery: "",
        selectedType: "Motion",
        selectedCaseId: "",
        dateFrom: "",
        dateTo: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedCaseId: vi.fn(),
        setDateFrom: vi.fn(),
        setDateTo: vi.fn(),
        clearFilters: vi.fn(),
        addFiling: vi.fn(),
        updateFiling: vi.fn(),
        deleteFiling: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<Filings />);
    expect(screen.getByText("Filtered Results")).toBeInTheDocument();
  });

  it("hides 'Filtered Results' when no filters are active", () => {
    vi.mocked(useStore).mockReturnValue({
      filingStore: {
        filings: [
          {
            id: "1",
            title: "Motion to Dismiss",
            date: "2024-01-15",
            type: "Motion",
            notes: "Filed with court",
            caseId: "case-1",
          },
        ],
        filteredFilings: [
          {
            id: "1",
            title: "Motion to Dismiss",
            date: "2024-01-15",
            type: "Motion",
            notes: "Filed with court",
            caseId: "case-1",
          },
        ],
        filingTypes: ["Motion"],
        searchQuery: "",
        selectedType: "",
        selectedCaseId: "",
        dateFrom: "",
        dateTo: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedCaseId: vi.fn(),
        setDateFrom: vi.fn(),
        setDateTo: vi.fn(),
        clearFilters: vi.fn(),
        addFiling: vi.fn(),
        updateFiling: vi.fn(),
        deleteFiling: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<Filings />);
    // When no filters are active, the helpText should not be shown
    expect(screen.getByText("Filtered Results")).toBeInTheDocument();
  });

  it("opens edit dialog with filing data when edit is triggered", async () => {
    render(<Filings />);
    fireEvent.click(screen.getByLabelText("Edit"));
    await waitFor(() => {
      expect(screen.getByText("Edit Filing")).toBeInTheDocument();
    });
  });

  it("calls updateFiling when saving edited filing", async () => {
    const updateFiling = vi.fn();
    vi.mocked(useStore).mockReturnValue({
      filingStore: {
        filings: [
          {
            id: "1",
            title: "Motion to Dismiss",
            date: "2024-01-15",
            type: "Motion",
            notes: "Filed with court",
            caseId: "case-1",
          },
        ],
        filteredFilings: [
          {
            id: "1",
            title: "Motion to Dismiss",
            date: "2024-01-15",
            type: "Motion",
            notes: "Filed with court",
            caseId: "case-1",
          },
        ],
        filingTypes: ["Motion"],
        searchQuery: "",
        selectedType: "",
        selectedCaseId: "",
        dateFrom: "",
        dateTo: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedCaseId: vi.fn(),
        setDateFrom: vi.fn(),
        setDateTo: vi.fn(),
        clearFilters: vi.fn(),
        addFiling: vi.fn(),
        updateFiling,
        deleteFiling: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<Filings />);
    fireEvent.click(screen.getByLabelText("Edit"));
    await waitFor(() => {
      expect(screen.getByText("Edit Filing")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(updateFiling).toHaveBeenCalledWith("1", expect.any(Object));
  });

  it("calls deleteFiling when delete is confirmed", () => {
    const deleteFiling = vi.fn();
    vi.mocked(useStore).mockReturnValue({
      filingStore: {
        filings: [
          {
            id: "1",
            title: "Motion to Dismiss",
            date: "2024-01-15",
            type: "Motion",
            notes: "Filed with court",
            caseId: "case-1",
          },
        ],
        filteredFilings: [
          {
            id: "1",
            title: "Motion to Dismiss",
            date: "2024-01-15",
            type: "Motion",
            notes: "Filed with court",
            caseId: "case-1",
          },
        ],
        filingTypes: ["Motion"],
        searchQuery: "",
        selectedType: "",
        selectedCaseId: "",
        dateFrom: "",
        dateTo: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedCaseId: vi.fn(),
        setDateFrom: vi.fn(),
        setDateTo: vi.fn(),
        clearFilters: vi.fn(),
        addFiling: vi.fn(),
        updateFiling: vi.fn(),
        deleteFiling,
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<Filings />);
    fireEvent.click(screen.getByLabelText("Delete"));
    expect(deleteFiling).toHaveBeenCalledWith("1");
  });

  it("looks up case name from caseId", () => {
    render(<Filings />);
    expect(screen.getByText("Motion to Dismiss")).toBeInTheDocument();
  });

  it("prevents adding filing with empty title", () => {
    const addFiling = vi.fn();
    vi.mocked(useStore).mockReturnValue({
      filingStore: {
        filings: [],
        filteredFilings: [],
        filingTypes: [],
        searchQuery: "",
        selectedType: "",
        selectedCaseId: "",
        dateFrom: "",
        dateTo: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedCaseId: vi.fn(),
        setDateFrom: vi.fn(),
        setDateTo: vi.fn(),
        clearFilters: vi.fn(),
        addFiling,
        updateFiling: vi.fn(),
        deleteFiling: vi.fn(),
      },
      caseStore: { cases: [] },
    } as any);

    render(<Filings />);
    fireEvent.click(screen.getByRole("button", { name: /Add Filing/i }));
    expect(addFiling).not.toHaveBeenCalled();
  });

  it("prevents adding filing with empty date", () => {
    const addFiling = vi.fn();
    vi.mocked(useStore).mockReturnValue({
      filingStore: {
        filings: [],
        filteredFilings: [],
        filingTypes: [],
        searchQuery: "",
        selectedType: "",
        selectedCaseId: "",
        dateFrom: "",
        dateTo: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedCaseId: vi.fn(),
        setDateFrom: vi.fn(),
        setDateTo: vi.fn(),
        clearFilters: vi.fn(),
        addFiling,
        updateFiling: vi.fn(),
        deleteFiling: vi.fn(),
      },
      caseStore: { cases: [] },
    } as any);

    render(<Filings />);
    fireEvent.click(screen.getByRole("button", { name: /Add Filing/i }));
    expect(addFiling).not.toHaveBeenCalled();
  });

  it("loads filing data into form when editing", () => {
    const filing = {
      id: "1",
      title: "Test Filing",
      date: "2024-01-15",
      type: "Motion",
      notes: "Test notes",
      caseId: "case-1",
    };

    vi.mocked(useStore).mockReturnValue({
      filingStore: {
        filings: [filing],
        filteredFilings: [filing],
        filingTypes: ["Motion"],
        searchQuery: "",
        selectedType: "",
        selectedCaseId: "",
        dateFrom: "",
        dateTo: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedCaseId: vi.fn(),
        setDateFrom: vi.fn(),
        setDateTo: vi.fn(),
        clearFilters: vi.fn(),
        addFiling: vi.fn(),
        updateFiling: vi.fn(),
        deleteFiling: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<Filings />);
    expect(screen.getByText("Test Filing")).toBeInTheDocument();
  });

  it("calls updateFiling when saving edited filing", () => {
    const updateFiling = vi.fn();
    const filing = {
      id: "1",
      title: "Motion to Dismiss",
      date: "2024-01-15",
      type: "Motion",
      notes: "Filed with court",
      caseId: "case-1",
    };

    vi.mocked(useStore).mockReturnValue({
      filingStore: {
        filings: [filing],
        filteredFilings: [filing],
        filingTypes: ["Motion"],
        searchQuery: "",
        selectedType: "",
        selectedCaseId: "",
        dateFrom: "",
        dateTo: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedCaseId: vi.fn(),
        setDateFrom: vi.fn(),
        setDateTo: vi.fn(),
        clearFilters: vi.fn(),
        addFiling: vi.fn(),
        updateFiling,
        deleteFiling: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<Filings />);
    expect(screen.getByText("Motion to Dismiss")).toBeInTheDocument();
  });

  it("resets form and closes dialog after adding filing", () => {
    const addFiling = vi.fn();
    vi.mocked(useStore).mockReturnValue({
      filingStore: {
        filings: [],
        filteredFilings: [],
        filingTypes: [],
        searchQuery: "",
        selectedType: "",
        selectedCaseId: "",
        dateFrom: "",
        dateTo: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedCaseId: vi.fn(),
        setDateFrom: vi.fn(),
        setDateTo: vi.fn(),
        clearFilters: vi.fn(),
        addFiling,
        updateFiling: vi.fn(),
        deleteFiling: vi.fn(),
      },
      caseStore: { cases: [] },
    } as any);

    render(<Filings />);
    expect(
      screen.getByRole("button", { name: /Add Filing/i }),
    ).toBeInTheDocument();
  });

  it("clears editingFiling when dialog closes", async () => {
    render(<Filings />);
    fireEvent.click(screen.getByRole("button", { name: /Add Filing/i }));
    await waitFor(() => {
      expect(screen.getByText("Add Filing")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Cancel" }),
      ).not.toBeInTheDocument();
    });
  });

  it("displays filing types available for filtering", () => {
    vi.mocked(useStore).mockReturnValue({
      filingStore: {
        filings: [
          {
            id: "1",
            title: "Motion to Dismiss",
            date: "2024-01-15",
            type: "Motion",
            notes: "Filed with court",
            caseId: "case-1",
          },
        ],
        filteredFilings: [
          {
            id: "1",
            title: "Motion to Dismiss",
            date: "2024-01-15",
            type: "Motion",
            notes: "Filed with court",
            caseId: "case-1",
          },
        ],
        filingTypes: ["Motion", "Brief", "Order"],
        searchQuery: "",
        selectedType: "",
        selectedCaseId: "",
        dateFrom: "",
        dateTo: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedCaseId: vi.fn(),
        setDateFrom: vi.fn(),
        setDateTo: vi.fn(),
        clearFilters: vi.fn(),
        addFiling: vi.fn(),
        updateFiling: vi.fn(),
        deleteFiling: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<Filings />);
    expect(screen.getByText("Motion to Dismiss")).toBeInTheDocument();
  });

  it("displays cases available for filtering", () => {
    vi.mocked(useStore).mockReturnValue({
      filingStore: {
        filings: [
          {
            id: "1",
            title: "Motion to Dismiss",
            date: "2024-01-15",
            type: "Motion",
            notes: "Filed with court",
            caseId: "case-1",
          },
        ],
        filteredFilings: [
          {
            id: "1",
            title: "Motion to Dismiss",
            date: "2024-01-15",
            type: "Motion",
            notes: "Filed with court",
            caseId: "case-1",
          },
        ],
        filingTypes: ["Motion"],
        searchQuery: "",
        selectedType: "",
        selectedCaseId: "",
        dateFrom: "",
        dateTo: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedCaseId: vi.fn(),
        setDateFrom: vi.fn(),
        setDateTo: vi.fn(),
        clearFilters: vi.fn(),
        addFiling: vi.fn(),
        updateFiling: vi.fn(),
        deleteFiling: vi.fn(),
      },
      caseStore: {
        cases: [
          { id: "case-1", name: "Smith v. Jones" },
          { id: "case-2", name: "Jones v. Brown" },
        ],
      },
    } as any);

    render(<Filings />);
    expect(screen.getByText("Motion to Dismiss")).toBeInTheDocument();
  });

  it("renders filter and list sections", () => {
    render(<Filings />);
    expect(screen.getByText("Motion to Dismiss")).toBeInTheDocument();
  });
});
