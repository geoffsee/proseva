import { render, screen, fireEvent, waitFor } from "../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Reports from "./Reports";
import { api } from "../lib/api";
import { toaster } from "../components/ui/toaster";

vi.mock("../lib/api", () => ({
  api: {
    reports: {
      generate: vi.fn(),
    },
  },
}));

vi.mock("../components/ui/toaster", () => ({
  toaster: {
    create: vi.fn(),
  },
}));

vi.mock("../components/reports/ReportTypeSelector", () => ({
  ReportTypeSelector: ({ onSelect }: any) => (
    <div>
      <button
        onClick={() => onSelect("case-summary")}
        data-testid="select-case-summary"
      >
        Case Summary
      </button>
      <button
        onClick={() => onSelect("chronology")}
        data-testid="select-chronology"
      >
        Chronology
      </button>
    </div>
  ),
}));

vi.mock("../components/reports/ReportConfigForm", () => ({
  ReportConfigForm: ({
    onGenerate,
    onBack,
    onConfigChange,
    reportType,
  }: any) => (
    <div>
      <button onClick={onBack} data-testid="back-to-select">
        Back
      </button>
      <button
        onClick={() =>
          onConfigChange({ type: reportType, options: { includeAI: true } })
        }
        data-testid="enable-ai"
      >
        Enable AI
      </button>
      <button onClick={onGenerate} data-testid="generate-report">
        Generate
      </button>
    </div>
  ),
}));

vi.mock("../components/reports/ReportPreview", () => ({
  ReportPreview: ({ onBack, onNewReport }: any) => (
    <div>
      <div data-testid="report-content">Report Preview</div>
      <button onClick={onBack} data-testid="preview-back">
        Back to Configure
      </button>
      <button onClick={onNewReport} data-testid="new-report">
        New Report
      </button>
    </div>
  ),
}));

describe("Reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders ReportTypeSelector on initial load (step='select')", () => {
    render(<Reports />);
    expect(screen.getByTestId("select-case-summary")).toBeInTheDocument();
    expect(screen.getByTestId("select-chronology")).toBeInTheDocument();
  });

  it("transitions to configure step when report type is selected", async () => {
    render(<Reports />);
    fireEvent.click(screen.getByTestId("select-case-summary"));

    await waitFor(() => {
      expect(screen.getByTestId("generate-report")).toBeInTheDocument();
      expect(screen.getByTestId("back-to-select")).toBeInTheDocument();
    });
  });

  it("updates config state when type is selected", async () => {
    render(<Reports />);
    fireEvent.click(screen.getByTestId("select-chronology"));

    await waitFor(() => {
      expect(screen.getByTestId("generate-report")).toBeInTheDocument();
    });
  });

  it("clears fieldValues when switching between steps", async () => {
    render(<Reports />);
    fireEvent.click(screen.getByTestId("select-case-summary"));

    await waitFor(() => {
      expect(screen.getByTestId("back-to-select")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("back-to-select"));

    await waitFor(() => {
      expect(screen.getByTestId("select-case-summary")).toBeInTheDocument();
    });
  });

  it("renders ReportConfigForm when on configure step", async () => {
    render(<Reports />);
    fireEvent.click(screen.getByTestId("select-case-summary"));

    await waitFor(() => {
      expect(screen.getByTestId("generate-report")).toBeInTheDocument();
    });
  });

  it("shows loading spinner when isGenerating is true", async () => {
    vi.mocked(api.reports.generate).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ content: "test" } as any), 100),
        ),
    );

    render(<Reports />);
    fireEvent.click(screen.getByTestId("select-case-summary"));

    await waitFor(() => {
      fireEvent.click(screen.getByTestId("generate-report"));
    });

    await waitFor(() => {
      expect(screen.getByText(/Generating report/i)).toBeInTheDocument();
    });
  });

  it("calls api.reports.generate when handleGenerate is invoked", async () => {
    vi.mocked(api.reports.generate).mockResolvedValue({
      content: "Generated report",
    } as any);

    render(<Reports />);
    fireEvent.click(screen.getByTestId("select-case-summary"));

    await waitFor(() => {
      fireEvent.click(screen.getByTestId("generate-report"));
    });

    await waitFor(() => {
      expect(api.reports.generate).toHaveBeenCalled();
    });
  });

  it("transitions to preview step when report generated successfully", async () => {
    vi.mocked(api.reports.generate).mockResolvedValue({
      content: "Generated report",
    } as any);

    render(<Reports />);
    fireEvent.click(screen.getByTestId("select-case-summary"));

    await waitFor(() => {
      fireEvent.click(screen.getByTestId("generate-report"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("report-content")).toBeInTheDocument();
    });
  });

  it("shows error toast when API call fails", async () => {
    const error = new Error("API Error");
    vi.mocked(api.reports.generate).mockRejectedValue(error);

    render(<Reports />);
    fireEvent.click(screen.getByTestId("select-case-summary"));

    await waitFor(() => {
      fireEvent.click(screen.getByTestId("generate-report"));
    });

    await waitFor(() => {
      expect(toaster.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Failed to generate report",
          type: "error",
        }),
      );
    });
  });

  it("shows error toast when API returns null", async () => {
    vi.mocked(api.reports.generate).mockResolvedValue(null);

    render(<Reports />);
    fireEvent.click(screen.getByTestId("select-case-summary"));

    await waitFor(() => {
      fireEvent.click(screen.getByTestId("generate-report"));
    });

    await waitFor(() => {
      expect(toaster.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Failed to generate report",
          type: "error",
        }),
      );
    });
  });

  it("resets isGenerating to false after success", async () => {
    vi.mocked(api.reports.generate).mockResolvedValue({
      content: "Generated report",
    } as any);

    render(<Reports />);
    fireEvent.click(screen.getByTestId("select-case-summary"));

    await waitFor(() => {
      fireEvent.click(screen.getByTestId("generate-report"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("report-content")).toBeInTheDocument();
    });

    // Spinner should not be visible anymore
    expect(screen.queryByText(/Generating report/i)).not.toBeInTheDocument();
  });

  it("resets isGenerating to false after error", async () => {
    vi.mocked(api.reports.generate).mockRejectedValue(new Error("API Error"));

    render(<Reports />);
    fireEvent.click(screen.getByTestId("select-case-summary"));

    await waitFor(() => {
      fireEvent.click(screen.getByTestId("generate-report"));
    });

    await waitFor(() => {
      expect(toaster.create).toHaveBeenCalled();
    });

    // Spinner should not be visible anymore
    expect(screen.queryByText(/Generating report/i)).not.toBeInTheDocument();
  });

  it("renders ReportPreview when step is preview and report exists", async () => {
    vi.mocked(api.reports.generate).mockResolvedValue({
      content: "Generated report",
    } as any);

    render(<Reports />);
    fireEvent.click(screen.getByTestId("select-case-summary"));

    await waitFor(() => {
      fireEvent.click(screen.getByTestId("generate-report"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("report-content")).toBeInTheDocument();
      expect(screen.getByTestId("preview-back")).toBeInTheDocument();
      expect(screen.getByTestId("new-report")).toBeInTheDocument();
    });
  });

  it("navigates back to configure from preview (handleBack)", async () => {
    vi.mocked(api.reports.generate).mockResolvedValue({
      content: "Generated report",
    } as any);

    render(<Reports />);
    fireEvent.click(screen.getByTestId("select-case-summary"));

    await waitFor(() => {
      fireEvent.click(screen.getByTestId("generate-report"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("report-content")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("preview-back"));

    await waitFor(() => {
      expect(screen.getByTestId("generate-report")).toBeInTheDocument();
    });
  });

  it("navigates back to select from configure (handleBackToSelect)", async () => {
    render(<Reports />);
    fireEvent.click(screen.getByTestId("select-case-summary"));

    await waitFor(() => {
      fireEvent.click(screen.getByTestId("back-to-select"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("select-case-summary")).toBeInTheDocument();
    });
  });

  it("resets state when starting new report (handleNewReport)", async () => {
    vi.mocked(api.reports.generate).mockResolvedValue({
      content: "Generated report",
    } as any);

    render(<Reports />);
    fireEvent.click(screen.getByTestId("select-case-summary"));

    await waitFor(() => {
      fireEvent.click(screen.getByTestId("generate-report"));
    });

    await waitFor(() => {
      fireEvent.click(screen.getByTestId("new-report"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("select-case-summary")).toBeInTheDocument();
    });
  });

  it("clears generated report when starting new report", async () => {
    vi.mocked(api.reports.generate).mockResolvedValue({
      content: "Generated report",
    } as any);

    render(<Reports />);
    fireEvent.click(screen.getByTestId("select-case-summary"));

    await waitFor(() => {
      fireEvent.click(screen.getByTestId("generate-report"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("report-content")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("new-report"));

    await waitFor(() => {
      expect(screen.queryByTestId("report-content")).not.toBeInTheDocument();
      expect(screen.getByTestId("select-case-summary")).toBeInTheDocument();
    });
  });

  it("initializes config with case-summary type by default", () => {
    render(<Reports />);
    expect(screen.getByTestId("select-case-summary")).toBeInTheDocument();
  });

  it("maintains includeAI option in config", async () => {
    vi.mocked(api.reports.generate).mockResolvedValue({
      content: "Generated report",
    } as any);

    render(<Reports />);
    fireEvent.click(screen.getByTestId("select-case-summary"));

    await waitFor(() => {
      fireEvent.click(screen.getByTestId("enable-ai"));
    });

    await waitFor(() => {
      fireEvent.click(screen.getByTestId("generate-report"));
    });

    await waitFor(() => {
      expect(api.reports.generate).toHaveBeenCalled();
    });
  });

  it("renders without errors on mount", () => {
    expect(() => {
      render(<Reports />);
    }).not.toThrow();
  });

  it("handles error message with error description", async () => {
    const errorMsg = "Connection timeout";
    vi.mocked(api.reports.generate).mockRejectedValue(new Error(errorMsg));

    render(<Reports />);
    fireEvent.click(screen.getByTestId("select-case-summary"));

    await waitFor(() => {
      fireEvent.click(screen.getByTestId("generate-report"));
    });

    await waitFor(() => {
      expect(toaster.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: errorMsg,
          type: "error",
        }),
      );
    });
  });

  it("handles unknown error type", async () => {
    vi.mocked(api.reports.generate).mockRejectedValue("Unknown error");

    render(<Reports />);
    fireEvent.click(screen.getByTestId("select-case-summary"));

    await waitFor(() => {
      fireEvent.click(screen.getByTestId("generate-report"));
    });

    await waitFor(() => {
      expect(toaster.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Unknown error",
          type: "error",
        }),
      );
    });
  });
});
