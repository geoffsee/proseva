import { render, screen, fireEvent } from "../../../test-utils";
import { EstateDocumentList } from "./index";
import { vi, describe, it, expect } from "vitest";

const mockDocuments = [
  {
    id: "1",
    type: "last-will",
    title: "My Will",
    status: "draft",
    reviewDate: "2025-01-01",
    updatedAt: "2024-12-01",
  },
];

describe("EstateDocumentList", () => {
  it("renders empty state when no documents", () => {
    render(
      <EstateDocumentList
        documents={[]}
        onDraft={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        onStatusChange={vi.fn()}
      />
    );

    expect(screen.getByText("No documents yet")).toBeInTheDocument();
  });

  it("renders documents correctly", () => {
    render(
      <EstateDocumentList
        documents={mockDocuments}
        onDraft={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        onStatusChange={vi.fn()}
      />
    );

    expect(screen.getByText("My Will")).toBeInTheDocument();
    expect(screen.getByText("Last Will & Testament")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Mark Review")).toBeInTheDocument();
  });

  it("calls onDraft when Draft Document button is clicked", () => {
    const onDraft = vi.fn();
    render(
      <EstateDocumentList
        documents={[]}
        onDraft={onDraft}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        onStatusChange={vi.fn()}
      />
    );

    const draftButton = screen.getByRole("button", { name: "Draft Document" });
    fireEvent.click(draftButton);

    expect(onDraft).toHaveBeenCalled();
  });

  it("calls onStatusChange when status button is clicked", () => {
    const onStatusChange = vi.fn();
    render(
      <EstateDocumentList
        documents={mockDocuments}
        onDraft={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        onStatusChange={onStatusChange}
      />
    );

    const statusButton = screen.getByText("Mark Review");
    fireEvent.click(statusButton);

    expect(onStatusChange).toHaveBeenCalledWith("1", "review");
  });

  it("does not show next status button when status is 'filed'", () => {
    const filedDoc = {
      ...mockDocuments[0],
      status: "filed",
    };
    render(
      <EstateDocumentList
        documents={[filedDoc]}
        onDraft={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        onStatusChange={vi.fn()}
      />
    );

    expect(screen.queryByText(/Mark /)).not.toBeInTheDocument();
  });

  it("calls onEdit when edit button is clicked", () => {
    const onEdit = vi.fn();
    render(
      <EstateDocumentList
        documents={mockDocuments}
        onDraft={vi.fn()}
        onEdit={onEdit}
        onRemove={vi.fn()}
        onStatusChange={vi.fn()}
      />
    );

    const editButton = screen.getByRole("button", { name: "Edit document" });
    fireEvent.click(editButton);

    expect(onEdit).toHaveBeenCalledWith("1");
  });

  it("calls onRemove when remove button is clicked", () => {
    const onRemove = vi.fn();
    render(
      <EstateDocumentList
        documents={mockDocuments}
        onDraft={vi.fn()}
        onEdit={vi.fn()}
        onRemove={onRemove}
        onStatusChange={vi.fn()}
      />
    );

    const removeButton = screen.getByRole("button", { name: "Remove document" });
    fireEvent.click(removeButton);

    expect(onRemove).toHaveBeenCalledWith("1");
  });
});
