import { render, screen, fireEvent } from "../../../test-utils";
import { describe, it, expect, vi } from "vitest";
import { DetailsTab } from "./index";
import type { Case } from "../../../types";

const mockCase: Case = {
  id: "1",
  name: "Test Case",
  caseNumber: "123",
  court: "Test Court",
  caseType: "Divorce",
  status: "active",
  parties: [],
  filings: [],
  notes: "Some notes",
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
};

describe("DetailsTab", () => {
  it("renders status and notes", () => {
    render(
      <DetailsTab
        caseData={mockCase}
        onUpdateCase={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Some notes")).toBeInTheDocument();
  });

  it("calls onDeleteClick when delete button is clicked", () => {
    const onDelete = vi.fn();
    render(
      <DetailsTab
        caseData={mockCase}
        onUpdateCase={vi.fn()}
        onDeleteClick={onDelete}
      />,
    );
    fireEvent.click(screen.getAllByText("Delete Case")[0]);
    expect(onDelete).toHaveBeenCalled();
  });
});
