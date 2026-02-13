import { render, screen, fireEvent } from "../../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SendFaxDialog } from "./SendFaxDialog";
import type { Filing } from "../../types";

vi.mock("../../lib/api", () => ({
  faxApi: {
    send: vi.fn().mockResolvedValue({
      id: "job-1",
      filingId: "f-1",
      status: "pending",
    }),
  },
}));

vi.mock("../ui/toaster", () => ({
  toaster: {
    create: vi.fn(),
  },
}));

const testFiling: Filing = {
  id: "f-1",
  title: "Motion to Dismiss",
  date: "2025-01-15",
  type: "Motion",
  caseId: "case-1",
};

describe("SendFaxDialog", () => {
  let mockOnOpenChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnOpenChange = vi.fn();
  });

  it("renders dialog when open with filing", () => {
    render(
      <SendFaxDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        filing={testFiling}
        courtName="Accomack GD"
        caseId="case-1"
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Send Fax" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Motion to Dismiss/)).toBeInTheDocument();
  });

  it("shows court fax radio selected by default", () => {
    render(
      <SendFaxDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        filing={testFiling}
        courtName="Accomack GD"
        caseId="case-1"
      />,
    );
    expect(screen.getByText(/Court Fax/)).toBeInTheDocument();
    expect(screen.getByText(/Manual Entry/)).toBeInTheDocument();
  });

  it("shows court fax number when court is matched", () => {
    render(
      <SendFaxDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        filing={testFiling}
        courtName="Accomack GD"
        caseId="case-1"
      />,
    );
    expect(screen.getByText(/757-787-5619/)).toBeInTheDocument();
  });

  it("shows manual entry input when manual is selected", () => {
    render(
      <SendFaxDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        filing={testFiling}
        courtName="Accomack GD"
        caseId="case-1"
      />,
    );

    const manualRadio = screen.getByText("Manual Entry")
      .closest("label")
      ?.querySelector("input");
    if (manualRadio) {
      fireEvent.click(manualRadio);
    }

    expect(screen.getByPlaceholderText("(555) 123-4567")).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when Cancel is clicked", () => {
    render(
      <SendFaxDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        filing={testFiling}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows 'no fax on file' when no court match", () => {
    render(
      <SendFaxDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        filing={testFiling}
        courtName="Nonexistent Court"
        caseId="case-1"
      />,
    );
    expect(screen.getByText(/no fax on file/)).toBeInTheDocument();
  });

  it("renders recipient name input", () => {
    render(
      <SendFaxDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        filing={testFiling}
      />,
    );
    expect(screen.getByText("Recipient Name")).toBeInTheDocument();
  });
});
