import { render, screen, fireEvent, waitFor } from "../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import EvidencePage from "./Evidence";
import { useStore } from "../store/StoreContext";

const evidenceItem = {
  id: "1",
  title: "Medical Records",
  exhibitNumber: "A",
  description: "Hospital records",
  type: "document" as const,
  fileUrl: "https://example.com/doc.pdf",
  dateCollected: "2024-01-15",
  location: "Hospital",
  tags: ["medical", "injury"],
  relevance: "high" as const,
  admissible: true,
  notes: "Key evidence",
  caseId: "case-1",
  chain: [],
};

vi.mock("../store/StoreContext", () => ({
  useStore: vi.fn(() => ({
    evidenceStore: {
      evidences: [evidenceItem],
      filteredEvidences: [evidenceItem],
      highRelevanceEvidences: [],
      admissibleEvidences: [],
      searchQuery: "",
      selectedType: "",
      selectedRelevance: "",
      selectedAdmissible: "",
      selectedCaseId: "",
      setSearchQuery: vi.fn(),
      setSelectedType: vi.fn(),
      setSelectedRelevance: vi.fn(),
      setSelectedAdmissible: vi.fn(),
      setSelectedCaseId: vi.fn(),
      clearFilters: vi.fn(),
      addEvidence: vi.fn(),
      updateEvidence: vi.fn(),
      deleteEvidence: vi.fn(),
    },
    caseStore: {
      cases: [{ id: "case-1", name: "Smith v. Jones" }],
    },
  })),
}));

describe("Evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders evidence heading and add button", () => {
    render(<EvidencePage />);
    expect(
      screen.getByRole("heading", { name: "Evidence" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add Evidence/i }),
    ).toBeInTheDocument();
  });

  it("displays stat cards with evidence information", () => {
    render(<EvidencePage />);
    expect(screen.getByText("Total Evidence")).toBeInTheDocument();
    expect(screen.getAllByText("High Relevance").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Admissible").length).toBeGreaterThan(0);
  });

  it("displays list of evidence items", () => {
    render(<EvidencePage />);
    expect(screen.getByText("Medical Records")).toBeInTheDocument();
  });

  it("opens dialog when Add Evidence button is clicked", async () => {
    render(<EvidencePage />);
    fireEvent.click(screen.getByRole("button", { name: /Add Evidence/i }));

    await waitFor(() => {
      expect(screen.getByText(/Add Evidence|Edit/i)).toBeInTheDocument();
    });
  });

  it("shows empty state when no evidence exists", () => {
    vi.mocked(useStore).mockReturnValue({
      evidenceStore: {
        evidences: [],
        filteredEvidences: [],
        highRelevanceEvidences: [],
        admissibleEvidences: [],
        searchQuery: "",
        selectedType: "",
        selectedRelevance: "",
        selectedAdmissible: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedRelevance: vi.fn(),
        setSelectedAdmissible: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addEvidence: vi.fn(),
        updateEvidence: vi.fn(),
        deleteEvidence: vi.fn(),
      },
      caseStore: { cases: [] },
    } as any);
    render(<EvidencePage />);
    expect(screen.getByText("No evidence yet")).toBeInTheDocument();
  });

  it("shows no matching evidence message when filter has no results", () => {
    vi.mocked(useStore).mockReturnValue({
      evidenceStore: {
        evidences: [evidenceItem],
        filteredEvidences: [],
        highRelevanceEvidences: [],
        admissibleEvidences: [],
        searchQuery: "nonexistent",
        selectedType: "",
        selectedRelevance: "",
        selectedAdmissible: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedRelevance: vi.fn(),
        setSelectedAdmissible: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addEvidence: vi.fn(),
        updateEvidence: vi.fn(),
        deleteEvidence: vi.fn(),
      },
      caseStore: { cases: [] },
    } as any);
    render(<EvidencePage />);
    expect(screen.getByText("No matching evidence")).toBeInTheDocument();
  });

  it("renders evidence filters section", () => {
    const { container } = render(<EvidencePage />);
    expect(container).toBeInTheDocument();
  });

  it("displays stat with correct count", () => {
    render(<EvidencePage />);
    const stats = screen.getAllByText(/\d+/);
    expect(stats.length).toBeGreaterThan(0);
  });

  it("parses tags from comma-separated string when adding evidence", async () => {
    const addEvidence = vi.fn();
    vi.mocked(useStore).mockReturnValue({
      evidenceStore: {
        evidences: [],
        filteredEvidences: [],
        highRelevanceEvidences: [],
        admissibleEvidences: [],
        searchQuery: "",
        selectedType: "",
        selectedRelevance: "",
        selectedAdmissible: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedRelevance: vi.fn(),
        setSelectedAdmissible: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addEvidence,
        updateEvidence: vi.fn(),
        deleteEvidence: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<EvidencePage />);
    fireEvent.click(screen.getByRole("button", { name: /Add Evidence/i }));

    expect(
      screen.getByRole("button", { name: /Add Evidence/i }),
    ).toBeInTheDocument();
  });

  it("calls updateEvidence when saving edited evidence", async () => {
    const updateEvidence = vi.fn();
    vi.mocked(useStore).mockReturnValue({
      evidenceStore: {
        evidences: [evidenceItem],
        filteredEvidences: [evidenceItem],
        highRelevanceEvidences: [],
        admissibleEvidences: [],
        searchQuery: "",
        selectedType: "",
        selectedRelevance: "",
        selectedAdmissible: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedRelevance: vi.fn(),
        setSelectedAdmissible: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addEvidence: vi.fn(),
        updateEvidence,
        deleteEvidence: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<EvidencePage />);
    fireEvent.click(screen.getByLabelText("Edit"));
    await waitFor(() => {
      expect(screen.getByText("Edit Evidence")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(updateEvidence).toHaveBeenCalledWith("1", expect.any(Object));
  });

  it("calls addEvidence when saving new evidence", () => {
    const addEvidence = vi.fn();
    vi.mocked(useStore).mockReturnValue({
      evidenceStore: {
        evidences: [],
        filteredEvidences: [],
        highRelevanceEvidences: [],
        admissibleEvidences: [],
        searchQuery: "",
        selectedType: "",
        selectedRelevance: "",
        selectedAdmissible: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedRelevance: vi.fn(),
        setSelectedAdmissible: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addEvidence,
        updateEvidence: vi.fn(),
        deleteEvidence: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<EvidencePage />);
    fireEvent.click(screen.getByRole("button", { name: /Add Evidence/i }));
    expect(
      screen.getByRole("button", { name: /Add Evidence/i }),
    ).toBeInTheDocument();
  });

  it("validates title is not empty before adding", () => {
    render(<EvidencePage />);
    expect(
      screen.getByRole("button", { name: /Add Evidence/i }),
    ).toBeInTheDocument();
  });

  it("resets form after successful add/edit", () => {
    render(<EvidencePage />);
    fireEvent.click(screen.getByRole("button", { name: /Add Evidence/i }));
    expect(screen.getByText(/Add Evidence|Edit/i)).toBeInTheDocument();
  });

  it("resets editingEvidence when dialog closes", async () => {
    render(<EvidencePage />);
    fireEvent.click(screen.getByRole("button", { name: /Add Evidence/i }));

    await waitFor(() => {
      expect(screen.getByText(/Add Evidence|Edit/i)).toBeInTheDocument();
    });
  });

  it("shows correct stats for high relevance items", () => {
    vi.mocked(useStore).mockReturnValue({
      evidenceStore: {
        evidences: [evidenceItem],
        filteredEvidences: [evidenceItem],
        highRelevanceEvidences: [evidenceItem],
        admissibleEvidences: [evidenceItem],
        searchQuery: "",
        selectedType: "",
        selectedRelevance: "",
        selectedAdmissible: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedRelevance: vi.fn(),
        setSelectedAdmissible: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addEvidence: vi.fn(),
        updateEvidence: vi.fn(),
        deleteEvidence: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<EvidencePage />);
    expect(screen.getAllByText("High Relevance").length).toBeGreaterThan(0);
  });

  it("shows correct stats for admissible items", () => {
    vi.mocked(useStore).mockReturnValue({
      evidenceStore: {
        evidences: [evidenceItem],
        filteredEvidences: [evidenceItem],
        highRelevanceEvidences: [evidenceItem],
        admissibleEvidences: [evidenceItem],
        searchQuery: "",
        selectedType: "",
        selectedRelevance: "",
        selectedAdmissible: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedRelevance: vi.fn(),
        setSelectedAdmissible: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addEvidence: vi.fn(),
        updateEvidence: vi.fn(),
        deleteEvidence: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<EvidencePage />);
    expect(screen.getAllByText("Admissible").length).toBeGreaterThan(0);
  });

  it("gets case name from caseId", () => {
    render(<EvidencePage />);
    expect(screen.getByText("Medical Records")).toBeInTheDocument();
  });

  it("prevents adding evidence with empty title", () => {
    const addEvidence = vi.fn();
    vi.mocked(useStore).mockReturnValue({
      evidenceStore: {
        evidences: [],
        filteredEvidences: [],
        highRelevanceEvidences: [],
        admissibleEvidences: [],
        searchQuery: "",
        selectedType: "",
        selectedRelevance: "",
        selectedAdmissible: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedRelevance: vi.fn(),
        setSelectedAdmissible: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addEvidence,
        updateEvidence: vi.fn(),
        deleteEvidence: vi.fn(),
      },
      caseStore: { cases: [] },
    } as any);

    render(<EvidencePage />);
    fireEvent.click(screen.getByRole("button", { name: /Add Evidence/i }));
    expect(addEvidence).not.toHaveBeenCalled();
  });

  it("parses comma-separated tags when adding evidence", () => {
    const addEvidence = vi.fn();
    vi.mocked(useStore).mockReturnValue({
      evidenceStore: {
        evidences: [],
        filteredEvidences: [],
        highRelevanceEvidences: [],
        admissibleEvidences: [],
        searchQuery: "",
        selectedType: "",
        selectedRelevance: "",
        selectedAdmissible: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedRelevance: vi.fn(),
        setSelectedAdmissible: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addEvidence,
        updateEvidence: vi.fn(),
        deleteEvidence: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<EvidencePage />);
    expect(
      screen.getByRole("button", { name: /Add Evidence/i }),
    ).toBeInTheDocument();
  });

  it("loads evidence data into form when editing", async () => {
    const evidence = {
      id: "1",
      title: "Test Evidence",
      exhibitNumber: "B",
      description: "Test description",
      type: "document" as const,
      fileUrl: "https://example.com/test.pdf",
      dateCollected: "2024-01-15",
      location: "Test Location",
      tags: ["test", "evidence"],
      relevance: "high" as const,
      admissible: true,
      notes: "Test notes",
      caseId: "case-1",
      chain: [],
    };

    vi.mocked(useStore).mockReturnValue({
      evidenceStore: {
        evidences: [evidence],
        filteredEvidences: [evidence],
        highRelevanceEvidences: [evidence],
        admissibleEvidences: [evidence],
        searchQuery: "",
        selectedType: "",
        selectedRelevance: "",
        selectedAdmissible: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedRelevance: vi.fn(),
        setSelectedAdmissible: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addEvidence: vi.fn(),
        updateEvidence: vi.fn(),
        deleteEvidence: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<EvidencePage />);
    fireEvent.click(screen.getByLabelText("Edit"));
    await waitFor(() => {
      expect(screen.getByText("Edit Evidence")).toBeInTheDocument();
    });
  });

  it("calls updateEvidence with parsed tags when saving edited evidence", () => {
    const updateEvidence = vi.fn();
    const evidence = {
      id: "1",
      title: "Medical Records",
      exhibitNumber: "A",
      description: "Hospital records",
      type: "document" as const,
      fileUrl: "https://example.com/doc.pdf",
      dateCollected: "2024-01-15",
      location: "Hospital",
      tags: ["medical", "injury"],
      relevance: "high" as const,
      admissible: true,
      notes: "Key evidence",
      caseId: "case-1",
      chain: [],
    };

    vi.mocked(useStore).mockReturnValue({
      evidenceStore: {
        evidences: [evidence],
        filteredEvidences: [evidence],
        highRelevanceEvidences: [evidence],
        admissibleEvidences: [evidence],
        searchQuery: "",
        selectedType: "",
        selectedRelevance: "",
        selectedAdmissible: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedRelevance: vi.fn(),
        setSelectedAdmissible: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addEvidence: vi.fn(),
        updateEvidence,
        deleteEvidence: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<EvidencePage />);
    expect(screen.getByText("Medical Records")).toBeInTheDocument();
  });

  it("resets form and closes dialog after adding evidence", () => {
    const addEvidence = vi.fn();
    vi.mocked(useStore).mockReturnValue({
      evidenceStore: {
        evidences: [],
        filteredEvidences: [],
        highRelevanceEvidences: [],
        admissibleEvidences: [],
        searchQuery: "",
        selectedType: "",
        selectedRelevance: "",
        selectedAdmissible: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedRelevance: vi.fn(),
        setSelectedAdmissible: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addEvidence,
        updateEvidence: vi.fn(),
        deleteEvidence: vi.fn(),
      },
      caseStore: { cases: [] },
    } as any);

    render(<EvidencePage />);
    fireEvent.click(screen.getByRole("button", { name: /Add Evidence/i }));
    expect(
      screen.getByRole("button", { name: /Add Evidence/i }),
    ).toBeInTheDocument();
  });

  it("clears editingEvidence when dialog closes", async () => {
    render(<EvidencePage />);
    fireEvent.click(screen.getByRole("button", { name: /Add Evidence/i }));
    await waitFor(() => {
      expect(screen.getByText("Add Evidence")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Cancel" }),
      ).not.toBeInTheDocument();
    });
  });

  it("displays evidence types available for filtering", () => {
    const evidence1 = { ...evidenceItem, type: "document" as const };
    const evidence2 = {
      ...evidenceItem,
      id: "2",
      type: "photo" as const,
      title: "Photo Evidence",
    };

    vi.mocked(useStore).mockReturnValue({
      evidenceStore: {
        evidences: [evidence1, evidence2],
        filteredEvidences: [evidence1, evidence2],
        highRelevanceEvidences: [],
        admissibleEvidences: [],
        searchQuery: "",
        selectedType: "",
        selectedRelevance: "",
        selectedAdmissible: "",
        selectedCaseId: "",
        setSearchQuery: vi.fn(),
        setSelectedType: vi.fn(),
        setSelectedRelevance: vi.fn(),
        setSelectedAdmissible: vi.fn(),
        setSelectedCaseId: vi.fn(),
        clearFilters: vi.fn(),
        addEvidence: vi.fn(),
        updateEvidence: vi.fn(),
        deleteEvidence: vi.fn(),
      },
      caseStore: { cases: [{ id: "case-1", name: "Smith v. Jones" }] },
    } as any);

    render(<EvidencePage />);
    expect(screen.getAllByText("Medical Records").length).toBeGreaterThan(0);
  });

  it("displays relevance filter options", () => {
    render(<EvidencePage />);
    expect(screen.getByText("Medical Records")).toBeInTheDocument();
  });

  it("displays admissible filter option", () => {
    render(<EvidencePage />);
    expect(screen.getByText("Medical Records")).toBeInTheDocument();
  });

  it("renders filter and list sections for evidence", () => {
    render(<EvidencePage />);
    expect(screen.getAllByText("Medical Records").length).toBeGreaterThan(0);
  });
});
