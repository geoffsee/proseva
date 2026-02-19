import { render, screen, fireEvent } from "../../../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReportTypeSelector } from "./index";

describe("ReportTypeSelector component", () => {
  let mockOnSelect: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSelect = vi.fn() as any;
  });

  it("renders heading", () => {
    render(<ReportTypeSelector onSelect={mockOnSelect} />);
    expect(
      screen.getByRole("heading", { name: "Generate Report" }),
    ).toBeInTheDocument();
  });

  it("renders all 4 report type cards", () => {
    render(<ReportTypeSelector onSelect={mockOnSelect} />);
    expect(screen.getByText("Case Summary")).toBeInTheDocument();
    expect(screen.getByText("Evidence Analysis")).toBeInTheDocument();
    expect(screen.getByText("Financial Summary")).toBeInTheDocument();
    expect(screen.getByText("Chronology")).toBeInTheDocument();
  });

  it("renders descriptions for each report type", () => {
    render(<ReportTypeSelector onSelect={mockOnSelect} />);
    expect(screen.getByText(/Complete overview of a case/)).toBeInTheDocument();
    expect(screen.getByText(/Detailed evidence catalog/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Comprehensive breakdown of all litigation-related expenses/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Timeline of all case events/)).toBeInTheDocument();
  });

  it("calls onSelect with 'case-summary' when Case Summary card is clicked", () => {
    render(<ReportTypeSelector onSelect={mockOnSelect} />);
    const caseSummaryTitle = screen.getByRole("heading", {
      name: "Case Summary",
    });
    const caseSummaryCard =
      caseSummaryTitle.closest("div[role='region']") ||
      caseSummaryTitle.closest("div")?.parentElement?.parentElement;
    fireEvent.click(caseSummaryCard!);
    expect(mockOnSelect).toHaveBeenCalledWith("case-summary");
  });

  it("calls onSelect with 'evidence-analysis' when Evidence Analysis card is clicked", () => {
    render(<ReportTypeSelector onSelect={mockOnSelect} />);
    const evidenceTitle = screen.getByRole("heading", {
      name: "Evidence Analysis",
    });
    const evidenceCard =
      evidenceTitle.closest("div[role='region']") ||
      evidenceTitle.closest("div")?.parentElement?.parentElement;
    fireEvent.click(evidenceCard!);
    expect(mockOnSelect).toHaveBeenCalledWith("evidence-analysis");
  });

  it("calls onSelect with 'financial' when Financial Summary card is clicked", () => {
    render(<ReportTypeSelector onSelect={mockOnSelect} />);
    const financialTitle = screen.getByRole("heading", {
      name: "Financial Summary",
    });
    const financialCard =
      financialTitle.closest("div[role='region']") ||
      financialTitle.closest("div")?.parentElement?.parentElement;
    fireEvent.click(financialCard!);
    expect(mockOnSelect).toHaveBeenCalledWith("financial");
  });

  it("calls onSelect with 'chronology' when Chronology card is clicked", () => {
    render(<ReportTypeSelector onSelect={mockOnSelect} />);
    const chronologyTitle = screen.getByRole("heading", { name: "Chronology" });
    const chronologyCard =
      chronologyTitle.closest("div[role='region']") ||
      chronologyTitle.closest("div")?.parentElement?.parentElement;
    fireEvent.click(chronologyCard!);
    expect(mockOnSelect).toHaveBeenCalledWith("chronology");
  });

  it("renders cards with proper structure", () => {
    const { container } = render(
      <ReportTypeSelector onSelect={mockOnSelect} />,
    );
    // Check that cards are rendered in a grid
    const grid =
      container.querySelector("[role='main']")?.parentElement ||
      container.firstChild;
    expect(grid).toBeInTheDocument();
  });

  it("card click handler works correctly", () => {
    render(<ReportTypeSelector onSelect={mockOnSelect} />);
    const caseSummaryTitle = screen.getByRole("heading", {
      name: "Case Summary",
    });
    const caseSummaryCard =
      caseSummaryTitle.closest("div[role='region']") ||
      caseSummaryTitle.closest("div")?.parentElement?.parentElement;

    fireEvent.click(caseSummaryCard!);
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith("case-summary");
  });

  it("renders each report type only once", () => {
    render(<ReportTypeSelector onSelect={mockOnSelect} />);
    expect(screen.getAllByText("Case Summary")).toHaveLength(1);
    expect(screen.getAllByText("Evidence Analysis")).toHaveLength(1);
    expect(screen.getAllByText("Financial Summary")).toHaveLength(1);
    expect(screen.getAllByText("Chronology")).toHaveLength(1);
  });

  it("handles multiple card selections sequentially", () => {
    render(<ReportTypeSelector onSelect={mockOnSelect} />);

    const caseSummaryTitle = screen.getByRole("heading", {
      name: "Case Summary",
    });
    const caseSummaryCard =
      caseSummaryTitle.closest("div[role='region']") ||
      caseSummaryTitle.closest("div")?.parentElement?.parentElement;
    fireEvent.click(caseSummaryCard!);
    expect(mockOnSelect).toHaveBeenCalledWith("case-summary");

    mockOnSelect.mockClear();

    const financialTitle = screen.getByRole("heading", {
      name: "Financial Summary",
    });
    const financialCard =
      financialTitle.closest("div[role='region']") ||
      financialTitle.closest("div")?.parentElement?.parentElement;
    fireEvent.click(financialCard!);
    expect(mockOnSelect).toHaveBeenCalledWith("financial");
  });
});
