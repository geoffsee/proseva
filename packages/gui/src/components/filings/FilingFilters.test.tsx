import { render, screen, fireEvent } from "../../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FilingFilters } from "./FilingFilters";

describe("FilingFilters component", () => {
  let mockOnSearchChange: any;
  let mockOnTypeChange: any;
  let mockOnCaseChange: any;
  let mockOnDateFromChange: any;
  let mockOnDateToChange: any;
  let mockOnClearFilters: any;
  let defaultFilingTypes: string[];
  let defaultCases: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSearchChange = vi.fn() as any;
    mockOnTypeChange = vi.fn() as any;
    mockOnCaseChange = vi.fn() as any;
    mockOnDateFromChange = vi.fn() as any;
    mockOnDateToChange = vi.fn() as any;
    mockOnClearFilters = vi.fn() as any;
    defaultFilingTypes = ["Motion", "Order", "Brief"];
    defaultCases = [{ id: "case-1", name: "Smith v. Jones" }];
  });

  it("renders filters heading", () => {
    render(
      <FilingFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedType="all"
        onTypeChange={mockOnTypeChange}
        selectedCaseId="all"
        onCaseChange={mockOnCaseChange}
        dateFrom=""
        onDateFromChange={mockOnDateFromChange}
        dateTo=""
        onDateToChange={mockOnDateToChange}
        filingTypes={defaultFilingTypes}
        cases={defaultCases}
        onClearFilters={mockOnClearFilters}
      />,
    );
    expect(screen.getByText("Filters")).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(
      <FilingFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedType="all"
        onTypeChange={mockOnTypeChange}
        selectedCaseId="all"
        onCaseChange={mockOnCaseChange}
        dateFrom=""
        onDateFromChange={mockOnDateFromChange}
        dateTo=""
        onDateToChange={mockOnDateToChange}
        filingTypes={defaultFilingTypes}
        cases={defaultCases}
        onClearFilters={mockOnClearFilters}
      />,
    );
    expect(
      screen.getByPlaceholderText("Search filings..."),
    ).toBeInTheDocument();
  });

  it("calls onSearchChange when search input changes", () => {
    render(
      <FilingFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedType="all"
        onTypeChange={mockOnTypeChange}
        selectedCaseId="all"
        onCaseChange={mockOnCaseChange}
        dateFrom=""
        onDateFromChange={mockOnDateFromChange}
        dateTo=""
        onDateToChange={mockOnDateToChange}
        filingTypes={defaultFilingTypes}
        cases={defaultCases}
        onClearFilters={mockOnClearFilters}
      />,
    );
    const searchInput = screen.getByPlaceholderText("Search filings...");
    fireEvent.change(searchInput, { target: { value: "motion" } });
    expect(mockOnSearchChange).toHaveBeenCalledWith("motion");
  });

  it("displays current search value", () => {
    render(
      <FilingFilters
        searchQuery="test search"
        onSearchChange={mockOnSearchChange}
        selectedType="all"
        onTypeChange={mockOnTypeChange}
        selectedCaseId="all"
        onCaseChange={mockOnCaseChange}
        dateFrom=""
        onDateFromChange={mockOnDateFromChange}
        dateTo=""
        onDateToChange={mockOnDateToChange}
        filingTypes={defaultFilingTypes}
        cases={defaultCases}
        onClearFilters={mockOnClearFilters}
      />,
    );
    const searchInput = screen.getByPlaceholderText(
      "Search filings...",
    ) as HTMLInputElement;
    expect(searchInput.value).toBe("test search");
  });

  it("renders filing type dropdown with all types", () => {
    render(
      <FilingFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedType="all"
        onTypeChange={mockOnTypeChange}
        selectedCaseId="all"
        onCaseChange={mockOnCaseChange}
        dateFrom=""
        onDateFromChange={mockOnDateFromChange}
        dateTo=""
        onDateToChange={mockOnDateToChange}
        filingTypes={defaultFilingTypes}
        cases={defaultCases}
        onClearFilters={mockOnClearFilters}
      />,
    );
    expect(screen.getByText("All Types")).toBeInTheDocument();
    expect(screen.getByText("Motion")).toBeInTheDocument();
    expect(screen.getByText("Order")).toBeInTheDocument();
    expect(screen.getByText("Brief")).toBeInTheDocument();
  });

  it("calls onTypeChange when filing type selection changes", () => {
    render(
      <FilingFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedType="all"
        onTypeChange={mockOnTypeChange}
        selectedCaseId="all"
        onCaseChange={mockOnCaseChange}
        dateFrom=""
        onDateFromChange={mockOnDateFromChange}
        dateTo=""
        onDateToChange={mockOnDateToChange}
        filingTypes={defaultFilingTypes}
        cases={defaultCases}
        onClearFilters={mockOnClearFilters}
      />,
    );
    const typeSelects = screen.getAllByDisplayValue("All Types");
    fireEvent.change(typeSelects[0], { target: { value: "Motion" } });
    expect(mockOnTypeChange).toHaveBeenCalledWith("Motion");
  });

  it("renders case dropdown with all cases", () => {
    render(
      <FilingFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedType="all"
        onTypeChange={mockOnTypeChange}
        selectedCaseId="all"
        onCaseChange={mockOnCaseChange}
        dateFrom=""
        onDateFromChange={mockOnDateFromChange}
        dateTo=""
        onDateToChange={mockOnDateToChange}
        filingTypes={defaultFilingTypes}
        cases={defaultCases}
        onClearFilters={mockOnClearFilters}
      />,
    );
    expect(screen.getByText("All Cases")).toBeInTheDocument();
    expect(screen.getByText("No Case")).toBeInTheDocument();
    expect(screen.getByText("Smith v. Jones")).toBeInTheDocument();
  });

  it("calls onCaseChange when case selection changes", () => {
    render(
      <FilingFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedType="all"
        onTypeChange={mockOnTypeChange}
        selectedCaseId="all"
        onCaseChange={mockOnCaseChange}
        dateFrom=""
        onDateFromChange={mockOnDateFromChange}
        dateTo=""
        onDateToChange={mockOnDateToChange}
        filingTypes={defaultFilingTypes}
        cases={defaultCases}
        onClearFilters={mockOnClearFilters}
      />,
    );
    const caseSelects = screen.getAllByDisplayValue("All Cases");
    fireEvent.change(caseSelects[0], { target: { value: "case-1" } });
    expect(mockOnCaseChange).toHaveBeenCalledWith("case-1");
  });

  it("renders date from input", () => {
    render(
      <FilingFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedType="all"
        onTypeChange={mockOnTypeChange}
        selectedCaseId="all"
        onCaseChange={mockOnCaseChange}
        dateFrom=""
        onDateFromChange={mockOnDateFromChange}
        dateTo=""
        onDateToChange={mockOnDateToChange}
        filingTypes={defaultFilingTypes}
        cases={defaultCases}
        onClearFilters={mockOnClearFilters}
      />,
    );
    const dateInputs = screen.getAllByDisplayValue("");
    expect(dateInputs.length).toBeGreaterThan(0);
  });

  it("calls onDateFromChange when date from changes", () => {
    const { container } = render(
      <FilingFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedType="all"
        onTypeChange={mockOnTypeChange}
        selectedCaseId="all"
        onCaseChange={mockOnCaseChange}
        dateFrom=""
        onDateFromChange={mockOnDateFromChange}
        dateTo=""
        onDateToChange={mockOnDateToChange}
        filingTypes={defaultFilingTypes}
        cases={defaultCases}
        onClearFilters={mockOnClearFilters}
      />,
    );
    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: "2025-01-01" } });
    expect(mockOnDateFromChange).toHaveBeenCalledWith("2025-01-01");
  });

  it("calls onDateToChange when date to changes", () => {
    const { container } = render(
      <FilingFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedType="all"
        onTypeChange={mockOnTypeChange}
        selectedCaseId="all"
        onCaseChange={mockOnCaseChange}
        dateFrom="2025-01-01"
        onDateFromChange={mockOnDateFromChange}
        dateTo=""
        onDateToChange={mockOnDateToChange}
        filingTypes={defaultFilingTypes}
        cases={defaultCases}
        onClearFilters={mockOnClearFilters}
      />,
    );
    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[1], { target: { value: "2025-12-31" } });
    expect(mockOnDateToChange).toHaveBeenCalledWith("2025-12-31");
  });

  it("does not show clear filters button when no filters are active", () => {
    render(
      <FilingFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedType="all"
        onTypeChange={mockOnTypeChange}
        selectedCaseId="all"
        onCaseChange={mockOnCaseChange}
        dateFrom=""
        onDateFromChange={mockOnDateFromChange}
        dateTo=""
        onDateToChange={mockOnDateToChange}
        filingTypes={defaultFilingTypes}
        cases={defaultCases}
        onClearFilters={mockOnClearFilters}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /Clear Filters/i }),
    ).not.toBeInTheDocument();
  });

  it("shows clear filters button when search query is active", () => {
    render(
      <FilingFilters
        searchQuery="test"
        onSearchChange={mockOnSearchChange}
        selectedType="all"
        onTypeChange={mockOnTypeChange}
        selectedCaseId="all"
        onCaseChange={mockOnCaseChange}
        dateFrom=""
        onDateFromChange={mockOnDateFromChange}
        dateTo=""
        onDateToChange={mockOnDateToChange}
        filingTypes={defaultFilingTypes}
        cases={defaultCases}
        onClearFilters={mockOnClearFilters}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Clear Filters/i }),
    ).toBeInTheDocument();
  });

  it("shows clear filters button when type filter is active", () => {
    render(
      <FilingFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedType="Motion"
        onTypeChange={mockOnTypeChange}
        selectedCaseId="all"
        onCaseChange={mockOnCaseChange}
        dateFrom=""
        onDateFromChange={mockOnDateFromChange}
        dateTo=""
        onDateToChange={mockOnDateToChange}
        filingTypes={defaultFilingTypes}
        cases={defaultCases}
        onClearFilters={mockOnClearFilters}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Clear Filters/i }),
    ).toBeInTheDocument();
  });

  it("shows clear filters button when case filter is active", () => {
    render(
      <FilingFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedType="all"
        onTypeChange={mockOnTypeChange}
        selectedCaseId="case-1"
        onCaseChange={mockOnCaseChange}
        dateFrom=""
        onDateFromChange={mockOnDateFromChange}
        dateTo=""
        onDateToChange={mockOnDateToChange}
        filingTypes={defaultFilingTypes}
        cases={defaultCases}
        onClearFilters={mockOnClearFilters}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Clear Filters/i }),
    ).toBeInTheDocument();
  });

  it("shows clear filters button when date from is set", () => {
    render(
      <FilingFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedType="all"
        onTypeChange={mockOnTypeChange}
        selectedCaseId="all"
        onCaseChange={mockOnCaseChange}
        dateFrom="2025-01-01"
        onDateFromChange={mockOnDateFromChange}
        dateTo=""
        onDateToChange={mockOnDateToChange}
        filingTypes={defaultFilingTypes}
        cases={defaultCases}
        onClearFilters={mockOnClearFilters}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Clear Filters/i }),
    ).toBeInTheDocument();
  });

  it("shows clear filters button when date to is set", () => {
    render(
      <FilingFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedType="all"
        onTypeChange={mockOnTypeChange}
        selectedCaseId="all"
        onCaseChange={mockOnCaseChange}
        dateFrom=""
        onDateFromChange={mockOnDateFromChange}
        dateTo="2025-12-31"
        onDateToChange={mockOnDateToChange}
        filingTypes={defaultFilingTypes}
        cases={defaultCases}
        onClearFilters={mockOnClearFilters}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Clear Filters/i }),
    ).toBeInTheDocument();
  });

  it("calls onClearFilters when clear filters button is clicked", () => {
    render(
      <FilingFilters
        searchQuery="test"
        onSearchChange={mockOnSearchChange}
        selectedType="all"
        onTypeChange={mockOnTypeChange}
        selectedCaseId="all"
        onCaseChange={mockOnCaseChange}
        dateFrom=""
        onDateFromChange={mockOnDateFromChange}
        dateTo=""
        onDateToChange={mockOnDateToChange}
        filingTypes={defaultFilingTypes}
        cases={defaultCases}
        onClearFilters={mockOnClearFilters}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Clear Filters/i }));
    expect(mockOnClearFilters).toHaveBeenCalled();
  });

  it("handles empty filing types list", () => {
    render(
      <FilingFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedType="all"
        onTypeChange={mockOnTypeChange}
        selectedCaseId="all"
        onCaseChange={mockOnCaseChange}
        dateFrom=""
        onDateFromChange={mockOnDateFromChange}
        dateTo=""
        onDateToChange={mockOnDateToChange}
        filingTypes={[]}
        cases={defaultCases}
        onClearFilters={mockOnClearFilters}
      />,
    );
    expect(screen.getByText("All Types")).toBeInTheDocument();
  });

  it("handles empty cases list", () => {
    render(
      <FilingFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedType="all"
        onTypeChange={mockOnTypeChange}
        selectedCaseId="all"
        onCaseChange={mockOnCaseChange}
        dateFrom=""
        onDateFromChange={mockOnDateFromChange}
        dateTo=""
        onDateToChange={mockOnDateToChange}
        filingTypes={defaultFilingTypes}
        cases={[]}
        onClearFilters={mockOnClearFilters}
      />,
    );
    expect(screen.getByText("All Cases")).toBeInTheDocument();
    expect(screen.getByText("No Case")).toBeInTheDocument();
  });

  it("displays selected date range values", () => {
    const { container } = render(
      <FilingFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedType="all"
        onTypeChange={mockOnTypeChange}
        selectedCaseId="all"
        onCaseChange={mockOnCaseChange}
        dateFrom="2025-01-01"
        onDateFromChange={mockOnDateFromChange}
        dateTo="2025-12-31"
        onDateToChange={mockOnDateToChange}
        filingTypes={defaultFilingTypes}
        cases={defaultCases}
        onClearFilters={mockOnClearFilters}
      />,
    );
    const dateInputs = container.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBe(2);
  });
});
