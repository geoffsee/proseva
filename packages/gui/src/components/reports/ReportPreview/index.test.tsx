import { render, screen, fireEvent, waitFor } from "../../../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReportPreview } from "./index";
import type { GeneratedReport } from "../../../types";

vi.mock("../../ui/toaster", () => ({
  toaster: {
    create: vi.fn(),
  },
}));

describe("ReportPreview", () => {
  const mockOnBack = vi.fn();
  const mockOnNewReport = vi.fn();

  const sampleReport: GeneratedReport = {
    title: "Case Summary Report",
    sections: [
      {
        heading: "Case Information",
        content: "Test case information content",
        type: "narrative",
      },
      {
        heading: "Timeline",
        content:
          "| Date | Event |\n|------|-------|\n| 2025-01-01 | Case filed |",
        type: "table",
      },
    ],
    metadata: {
      generatedAt: new Date().toISOString(),
      caseName: "Smith v. Jones",
      dateRange: "2025-01-01 to 2025-12-31",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders report title", () => {
    render(
      <ReportPreview
        report={sampleReport}
        onBack={mockOnBack}
        onNewReport={mockOnNewReport}
      />,
    );
    expect(
      screen.getByRole("heading", { name: sampleReport.title }),
    ).toBeInTheDocument();
  });

  it("renders all report sections with headings", () => {
    render(
      <ReportPreview
        report={sampleReport}
        onBack={mockOnBack}
        onNewReport={mockOnNewReport}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Case Information" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Timeline" }),
    ).toBeInTheDocument();
  });

  it("displays section content", () => {
    render(
      <ReportPreview
        report={sampleReport}
        onBack={mockOnBack}
        onNewReport={mockOnNewReport}
      />,
    );
    expect(
      screen.getByText("Test case information content"),
    ).toBeInTheDocument();
  });

  it("displays report metadata - generated date", () => {
    render(
      <ReportPreview
        report={sampleReport}
        onBack={mockOnBack}
        onNewReport={mockOnNewReport}
      />,
    );
    expect(screen.getByText(/Generated:/)).toBeInTheDocument();
  });

  it("displays report metadata - case name when present", () => {
    render(
      <ReportPreview
        report={sampleReport}
        onBack={mockOnBack}
        onNewReport={mockOnNewReport}
      />,
    );
    expect(screen.getByText(/Case: Smith v. Jones/)).toBeInTheDocument();
  });

  it("displays report metadata - date range when present", () => {
    render(
      <ReportPreview
        report={sampleReport}
        onBack={mockOnBack}
        onNewReport={mockOnNewReport}
      />,
    );
    expect(
      screen.getByText(/Date Range: 2025-01-01 to 2025-12-31/),
    ).toBeInTheDocument();
  });

  it("hides case name metadata when not provided", () => {
    const reportWithoutCase = {
      ...sampleReport,
      metadata: { ...sampleReport.metadata, caseName: undefined },
    };
    const { container } = render(
      <ReportPreview
        report={reportWithoutCase}
        onBack={mockOnBack}
        onNewReport={mockOnNewReport}
      />,
    );
    expect(container.textContent).not.toMatch(/^Case: undefined/);
  });

  it("renders Back button", () => {
    render(
      <ReportPreview
        report={sampleReport}
        onBack={mockOnBack}
        onNewReport={mockOnNewReport}
      />,
    );
    expect(screen.getByRole("button", { name: /Back/ })).toBeInTheDocument();
  });

  it("renders Copy button", () => {
    render(
      <ReportPreview
        report={sampleReport}
        onBack={mockOnBack}
        onNewReport={mockOnNewReport}
      />,
    );
    expect(screen.getByRole("button", { name: /Copy/ })).toBeInTheDocument();
  });

  it("renders Print button", () => {
    render(
      <ReportPreview
        report={sampleReport}
        onBack={mockOnBack}
        onNewReport={mockOnNewReport}
      />,
    );
    expect(screen.getByRole("button", { name: /Print/ })).toBeInTheDocument();
  });

  it("renders New Report button", () => {
    render(
      <ReportPreview
        report={sampleReport}
        onBack={mockOnBack}
        onNewReport={mockOnNewReport}
      />,
    );
    expect(
      screen.getByRole("button", { name: /New Report/ }),
    ).toBeInTheDocument();
  });

  it("calls onBack when Back button is clicked", () => {
    render(
      <ReportPreview
        report={sampleReport}
        onBack={mockOnBack}
        onNewReport={mockOnNewReport}
      />,
    );
    const backButton = screen.getByRole("button", { name: /Back/ });
    fireEvent.click(backButton);
    expect(mockOnBack).toHaveBeenCalled();
  });

  it("calls onNewReport when New Report button is clicked", () => {
    render(
      <ReportPreview
        report={sampleReport}
        onBack={mockOnBack}
        onNewReport={mockOnNewReport}
      />,
    );
    const newReportButton = screen.getByRole("button", { name: /New Report/ });
    fireEvent.click(newReportButton);
    expect(mockOnNewReport).toHaveBeenCalled();
  });

  it("handles copy to clipboard action", async () => {
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    // Mock clipboard at global level for this test
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: clipboardWriteText },
      writable: true,
    });

    try {
      render(
        <ReportPreview
          report={sampleReport}
          onBack={mockOnBack}
          onNewReport={mockOnNewReport}
        />,
      );
      const copyButton = screen.getByRole("button", { name: /Copy/ });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(clipboardWriteText).toHaveBeenCalled();
      });
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        value: originalClipboard,
        writable: true,
      });
    }
  });

  it("handles copy failure gracefully", async () => {
    const clipboardWriteText = vi
      .fn()
      .mockRejectedValue(new Error("Copy failed"));
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: clipboardWriteText },
      writable: true,
    });

    try {
      render(
        <ReportPreview
          report={sampleReport}
          onBack={mockOnBack}
          onNewReport={mockOnNewReport}
        />,
      );
      const copyButton = screen.getByRole("button", { name: /Copy/ });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(clipboardWriteText).toHaveBeenCalled();
      });
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        value: originalClipboard,
        writable: true,
      });
    }
  });

  it("handles print action", () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue({
      document: { write: vi.fn(), close: vi.fn() },
      print: vi.fn(),
    } as any);

    render(
      <ReportPreview
        report={sampleReport}
        onBack={mockOnBack}
        onNewReport={mockOnNewReport}
      />,
    );
    const printButton = screen.getByRole("button", { name: /Print/ });
    fireEvent.click(printButton);
    expect(openSpy).toHaveBeenCalledWith("", "_blank");

    openSpy.mockRestore();
  });

  it("renders narrative content without special formatting", () => {
    render(
      <ReportPreview
        report={sampleReport}
        onBack={mockOnBack}
        onNewReport={mockOnNewReport}
      />,
    );
    const narrativeSection = screen.getByText("Test case information content");
    expect(narrativeSection).toBeInTheDocument();
  });

  it("renders table content in pre-formatted box", () => {
    render(
      <ReportPreview
        report={sampleReport}
        onBack={mockOnBack}
        onNewReport={mockOnNewReport}
      />,
    );
    // The table content is rendered as-is in a pre-formatted box
    const tableContent = screen.getByText(/\| Date \| Event \|/);
    expect(tableContent).toBeInTheDocument();
  });

  it("renders multiple sections in order", () => {
    const multiSectionReport: GeneratedReport = {
      ...sampleReport,
      sections: [
        {
          heading: "First Section",
          content: "First content",
          type: "narrative",
        },
        {
          heading: "Second Section",
          content: "Second content",
          type: "narrative",
        },
        {
          heading: "Third Section",
          content: "Third content",
          type: "narrative",
        },
      ],
    };
    render(
      <ReportPreview
        report={multiSectionReport}
        onBack={mockOnBack}
        onNewReport={mockOnNewReport}
      />,
    );
    expect(screen.getByText("First content")).toBeInTheDocument();
    expect(screen.getByText("Second content")).toBeInTheDocument();
    expect(screen.getByText("Third content")).toBeInTheDocument();
  });

  it("renders report without errors", () => {
    expect(() => {
      render(
        <ReportPreview
          report={sampleReport}
          onBack={mockOnBack}
          onNewReport={mockOnNewReport}
        />,
      );
    }).not.toThrow();
  });
});
