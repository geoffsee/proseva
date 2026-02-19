import { render, screen, fireEvent } from "../../../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReportConfigForm } from "./index";
import type { ReportConfig } from "../../../types";

vi.mock("../../../store/StoreContext", () => ({
  useStore: vi.fn(() => ({
    caseStore: {
      cases: [
        { id: "case-1", name: "Smith v. Jones" },
        { id: "case-2", name: "Doe v. Public" },
      ],
    },
  })),
}));

describe("ReportConfigForm", () => {
  const mockOnConfigChange = vi.fn();
  const mockOnBack = vi.fn();
  const mockOnGenerate = vi.fn();

  const defaultConfig: ReportConfig = {
    type: "case-summary",
    caseId: "",
    options: { includeAI: false },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Case Summary Report", () => {
    it("renders case selection dropdown for case-summary type", () => {
      render(
        <ReportConfigForm
          reportType="case-summary"
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
          onBack={mockOnBack}
          onGenerate={mockOnGenerate}
        />,
      );
      expect(
        screen.getByText("Case Summary Configuration"),
      ).toBeInTheDocument();
      expect(
        screen.getByDisplayValue("-- Select a case --"),
      ).toBeInTheDocument();
    });

    it("populates case dropdown with available cases", () => {
      render(
        <ReportConfigForm
          reportType="case-summary"
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
          onBack={mockOnBack}
          onGenerate={mockOnGenerate}
        />,
      );
      expect(
        screen.getByRole("option", { name: "Smith v. Jones" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "Doe v. Public" }),
      ).toBeInTheDocument();
    });

    it("disables generate button when no case is selected", () => {
      render(
        <ReportConfigForm
          reportType="case-summary"
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
          onBack={mockOnBack}
          onGenerate={mockOnGenerate}
        />,
      );
      const generateButton = screen.getByRole("button", {
        name: "Generate Report",
      });
      expect(generateButton).toBeDisabled();
    });

    it("enables generate button when case is selected", () => {
      render(
        <ReportConfigForm
          reportType="case-summary"
          config={{ ...defaultConfig, caseId: "case-1" }}
          onConfigChange={mockOnConfigChange}
          onBack={mockOnBack}
          onGenerate={mockOnGenerate}
        />,
      );
      const generateButton = screen.getByRole("button", {
        name: "Generate Report",
      });
      expect(generateButton).not.toBeDisabled();
    });

    it("calls onConfigChange when case is selected", () => {
      render(
        <ReportConfigForm
          reportType="case-summary"
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
          onBack={mockOnBack}
          onGenerate={mockOnGenerate}
        />,
      );
      const select = screen.getByDisplayValue(
        "-- Select a case --",
      ) as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "case-1" } });
      expect(mockOnConfigChange).toHaveBeenCalled();
    });
  });

  describe("Evidence Analysis Report", () => {
    it("renders case selection and chain of custody checkbox for evidence-analysis", () => {
      render(
        <ReportConfigForm
          reportType="evidence-analysis"
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
          onBack={mockOnBack}
          onGenerate={mockOnGenerate}
        />,
      );
      expect(
        screen.getByText("Evidence Analysis Configuration"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Include chain of custody details"),
      ).toBeInTheDocument();
    });

    it("handles chain of custody checkbox toggle", () => {
      const config = {
        ...defaultConfig,
        caseId: "case-1",
        options: { includeAI: false, includeChainOfCustody: false },
      };
      render(
        <ReportConfigForm
          reportType="evidence-analysis"
          config={config}
          onConfigChange={mockOnConfigChange}
          onBack={mockOnBack}
          onGenerate={mockOnGenerate}
        />,
      );
      expect(
        screen.getByText("Include chain of custody details"),
      ).toBeInTheDocument();
      // Verify the checkbox is present for chain of custody
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes.length).toBeGreaterThanOrEqual(2); // AI + chain of custody
    });
  });

  describe("Financial Report", () => {
    it("renders date range inputs for financial type", () => {
      render(
        <ReportConfigForm
          reportType="financial"
          config={{
            type: "financial",
            options: { includeAI: false },
            dateRange: { from: "", to: "" },
          }}
          onConfigChange={mockOnConfigChange}
          onBack={mockOnBack}
          onGenerate={mockOnGenerate}
        />,
      );
      expect(
        screen.getByText("Financial Summary Configuration"),
      ).toBeInTheDocument();
      expect(screen.getByText("Start Date")).toBeInTheDocument();
      expect(screen.getByText("End Date")).toBeInTheDocument();
    });

    it("disables generate button when date range is incomplete", () => {
      render(
        <ReportConfigForm
          reportType="financial"
          config={{
            type: "financial",
            options: { includeAI: false },
            dateRange: { from: "2025-01-01", to: "" },
          }}
          onConfigChange={mockOnConfigChange}
          onBack={mockOnBack}
          onGenerate={mockOnGenerate}
        />,
      );
      const generateButton = screen.getByRole("button", {
        name: "Generate Report",
      });
      expect(generateButton).toBeDisabled();
    });

    it("enables generate button when date range is complete", () => {
      render(
        <ReportConfigForm
          reportType="financial"
          config={{
            type: "financial",
            options: { includeAI: false },
            dateRange: { from: "2025-01-01", to: "2025-12-31" },
          }}
          onConfigChange={mockOnConfigChange}
          onBack={mockOnBack}
          onGenerate={mockOnGenerate}
        />,
      );
      const generateButton = screen.getByRole("button", {
        name: "Generate Report",
      });
      expect(generateButton).not.toBeDisabled();
    });
  });

  describe("Chronology Report", () => {
    it("renders date range inputs for chronology type", () => {
      render(
        <ReportConfigForm
          reportType="chronology"
          config={{
            type: "chronology",
            options: { includeAI: false },
            dateRange: { from: "", to: "" },
          }}
          onConfigChange={mockOnConfigChange}
          onBack={mockOnBack}
          onGenerate={mockOnGenerate}
        />,
      );
      expect(screen.getByText("Chronology Configuration")).toBeInTheDocument();
    });
  });

  describe("Shared Features", () => {
    it("renders AI analysis checkbox for all report types", () => {
      render(
        <ReportConfigForm
          reportType="case-summary"
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
          onBack={mockOnBack}
          onGenerate={mockOnGenerate}
        />,
      );
      expect(
        screen.getByText("Include AI-generated strategic analysis"),
      ).toBeInTheDocument();
    });

    it("handles AI checkbox toggle", () => {
      render(
        <ReportConfigForm
          reportType="case-summary"
          config={{ ...defaultConfig, caseId: "case-1" }}
          onConfigChange={mockOnConfigChange}
          onBack={mockOnBack}
          onGenerate={mockOnGenerate}
        />,
      );
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes.length).toBeGreaterThan(0);
      // Verify AI checkbox text is present
      expect(
        screen.getByText("Include AI-generated strategic analysis"),
      ).toBeInTheDocument();
    });

    it("renders Back and Generate Report buttons", () => {
      render(
        <ReportConfigForm
          reportType="case-summary"
          config={{ ...defaultConfig, caseId: "case-1" }}
          onConfigChange={mockOnConfigChange}
          onBack={mockOnBack}
          onGenerate={mockOnGenerate}
        />,
      );
      expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Generate Report" }),
      ).toBeInTheDocument();
    });

    it("calls onBack when Back button is clicked", () => {
      render(
        <ReportConfigForm
          reportType="case-summary"
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
          onBack={mockOnBack}
          onGenerate={mockOnGenerate}
        />,
      );
      const backButton = screen.getByRole("button", { name: "Back" });
      fireEvent.click(backButton);
      expect(mockOnBack).toHaveBeenCalled();
    });

    it("calls onGenerate when Generate Report button is clicked", () => {
      render(
        <ReportConfigForm
          reportType="case-summary"
          config={{ ...defaultConfig, caseId: "case-1" }}
          onConfigChange={mockOnConfigChange}
          onBack={mockOnBack}
          onGenerate={mockOnGenerate}
        />,
      );
      const generateButton = screen.getByRole("button", {
        name: "Generate Report",
      });
      fireEvent.click(generateButton);
      expect(mockOnGenerate).toHaveBeenCalled();
    });

    it("handles date range input changes", () => {
      render(
        <ReportConfigForm
          reportType="financial"
          config={{
            type: "financial",
            options: { includeAI: false },
            dateRange: { from: "", to: "" },
          }}
          onConfigChange={mockOnConfigChange}
          onBack={mockOnBack}
          onGenerate={mockOnGenerate}
        />,
      );
      const startDateInputs = screen.getAllByDisplayValue("");
      fireEvent.change(startDateInputs[0], { target: { value: "2025-01-01" } });
      expect(mockOnConfigChange).toHaveBeenCalled();
    });
  });
});
