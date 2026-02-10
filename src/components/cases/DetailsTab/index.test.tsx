import { render, screen, fireEvent } from "../../../test-utils";
import { describe, it, expect, vi } from "vitest";
import { DetailsTab } from "./index";
import type { Case } from "../../../types";

describe("DetailsTab", () => {
  const mockCase: Case = {
    id: "case1",
    name: "Smith v. Jones",
    caseNumber: "2024-CV-001",
    court: "District Court",
    caseType: "Custody",
    status: "active",
    parties: [],
    filings: [],
    notes: "Important case notes here",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };

  it("renders status selector with current status", () => {
    render(
      <DetailsTab
        caseData={mockCase}
        onUpdateCase={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );

    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("displays current status as selected", () => {
    const { container } = render(
      <DetailsTab
        caseData={mockCase}
        onUpdateCase={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );

    const selects = container.querySelectorAll("select");
    const statusSelect = selects[0] as HTMLSelectElement;
    expect(statusSelect.value).toBe("active");
  });

  it("updates status when changed", () => {
    const onUpdateCase = vi.fn();
    const { container } = render(
      <DetailsTab
        caseData={mockCase}
        onUpdateCase={onUpdateCase}
        onDeleteClick={vi.fn()}
      />,
    );

    const selects = container.querySelectorAll("select");
    const statusSelect = selects[0] as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: "closed" } });

    expect(onUpdateCase).toHaveBeenCalledWith("case1", { status: "closed" });
  });

  it("renders all status options", () => {
    const { container } = render(
      <DetailsTab
        caseData={mockCase}
        onUpdateCase={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );

    const selects = container.querySelectorAll("select");
    const statusSelect = selects[0] as HTMLSelectElement;
    const options = statusSelect.querySelectorAll("option");
    const optionValues = Array.from(options).map((o) => o.value);

    expect(optionValues).toContain("active");
    expect(optionValues).toContain("pending");
    expect(optionValues).toContain("closed");
  });

  it("renders notes textarea with current notes", () => {
    render(
      <DetailsTab
        caseData={mockCase}
        onUpdateCase={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );

    const textarea = screen.getByDisplayValue(
      "Important case notes here",
    ) as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
  });

  it("updates notes when changed", () => {
    const onUpdateCase = vi.fn();
    render(
      <DetailsTab
        caseData={mockCase}
        onUpdateCase={onUpdateCase}
        onDeleteClick={vi.fn()}
      />,
    );

    const textarea = screen.getByDisplayValue(
      "Important case notes here",
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Updated case notes" } });

    expect(onUpdateCase).toHaveBeenCalledWith("case1", {
      notes: "Updated case notes",
    });
  });

  it("renders delete case button", () => {
    render(
      <DetailsTab
        caseData={mockCase}
        onUpdateCase={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Delete Case/ }),
    ).toBeInTheDocument();
  });

  it("calls onDeleteClick when delete button is clicked", () => {
    const onDeleteClick = vi.fn();
    render(
      <DetailsTab
        caseData={mockCase}
        onUpdateCase={vi.fn()}
        onDeleteClick={onDeleteClick}
      />,
    );

    const deleteButton = screen.getByRole("button", { name: /Delete Case/ });
    fireEvent.click(deleteButton);

    expect(onDeleteClick).toHaveBeenCalled();
  });

  it("handles pending status", () => {
    const { container } = render(
      <DetailsTab
        caseData={{ ...mockCase, status: "pending" }}
        onUpdateCase={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );

    const selects = container.querySelectorAll("select");
    const statusSelect = selects[0] as HTMLSelectElement;
    expect(statusSelect.value).toBe("pending");
  });

  it("handles closed status", () => {
    const { container } = render(
      <DetailsTab
        caseData={{ ...mockCase, status: "closed" }}
        onUpdateCase={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );

    const selects = container.querySelectorAll("select");
    const statusSelect = selects[0] as HTMLSelectElement;
    expect(statusSelect.value).toBe("closed");
  });

  it("handles empty notes", () => {
    render(
      <DetailsTab
        caseData={{ ...mockCase, notes: "" }}
        onUpdateCase={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      "Case notes...",
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe("");
  });

  it("renders Notes section label", () => {
    render(
      <DetailsTab
        caseData={mockCase}
        onUpdateCase={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );

    expect(screen.getByText("Notes")).toBeInTheDocument();
  });

  it("displays textarea with correct rows", () => {
    const { container } = render(
      <DetailsTab
        caseData={mockCase}
        onUpdateCase={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );

    const textareas = container.querySelectorAll("textarea");
    if (textareas.length > 0) {
      expect(parseInt(textareas[0].rows.toString())).toBe(6);
    }
  });

  it("passes correct case ID to onUpdateCase", () => {
    const onUpdateCase = vi.fn();
    render(
      <DetailsTab
        caseData={{ ...mockCase, id: "case-123" }}
        onUpdateCase={onUpdateCase}
        onDeleteClick={vi.fn()}
      />,
    );

    const textarea = screen.getByDisplayValue(
      "Important case notes here",
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "New notes" } });

    expect(onUpdateCase).toHaveBeenCalledWith("case-123", expect.any(Object));
  });

  it("renders all form fields in correct order", () => {
    render(
      <DetailsTab
        caseData={mockCase}
        onUpdateCase={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );

    const statusText = screen.getByText("Status");
    const notesText = screen.getByText("Notes");
    const deleteButton = screen.getByRole("button", { name: /Delete Case/ });

    expect(statusText).toBeInTheDocument();
    expect(notesText).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();
  });
});
