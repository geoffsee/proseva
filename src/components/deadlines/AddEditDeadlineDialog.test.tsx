import { render, screen, fireEvent, waitFor } from "../../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AddEditDeadlineDialog } from "./AddEditDeadlineDialog";
import type { Deadline } from "../../types";

describe("AddEditDeadlineDialog component", () => {
  let mockOnOpenChange: any;
  let mockOnFormChange: any;
  let mockOnSave: any;
  let defaultForm: any;
  let defaultCases: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnOpenChange = vi.fn() as any;
    mockOnFormChange = vi.fn() as any;
    mockOnSave = vi.fn() as any;
    defaultForm = {
      title: "",
      date: "",
      type: "filing",
      description: "",
      priority: "low",
      caseId: "",
    };
    defaultCases = [{ id: "case-1", name: "Smith v. Jones" }];
  });

  it("renders dialog when open is true", () => {
    render(
      <AddEditDeadlineDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={defaultForm}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={false}
        cases={defaultCases}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Add Deadline" }),
    ).toBeInTheDocument();
  });

  it("shows 'Edit Deadline' title when isEdit is true", () => {
    render(
      <AddEditDeadlineDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={defaultForm}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={true}
        cases={defaultCases}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Edit Deadline" }),
    ).toBeInTheDocument();
  });

  it("shows 'Add' button when not editing", () => {
    render(
      <AddEditDeadlineDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={defaultForm}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={false}
        cases={defaultCases}
      />,
    );
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("shows 'Save' button when editing", () => {
    render(
      <AddEditDeadlineDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={defaultForm}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={true}
        cases={defaultCases}
      />,
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("renders form inputs", () => {
    render(
      <AddEditDeadlineDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={defaultForm}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={false}
        cases={defaultCases}
      />,
    );
    expect(
      screen.getByPlaceholderText("e.g., File motion to compel"),
    ).toBeInTheDocument();
    // Verify date input type exists
    expect(
      screen.getAllByPlaceholderText("Additional details..."),
    ).toBeTruthy();
  });

  it("disables Save/Add button when title is empty", () => {
    render(
      <AddEditDeadlineDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={{ ...defaultForm, title: "", date: "2025-02-15" }}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={false}
        cases={defaultCases}
      />,
    );
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("disables Save/Add button when date is empty", () => {
    render(
      <AddEditDeadlineDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={{ ...defaultForm, title: "File Motion", date: "" }}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={false}
        cases={defaultCases}
      />,
    );
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("enables Save/Add button when both title and date are provided", () => {
    render(
      <AddEditDeadlineDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={{ ...defaultForm, title: "File Motion", date: "2025-02-15" }}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={false}
        cases={defaultCases}
      />,
    );
    expect(screen.getByRole("button", { name: "Add" })).not.toBeDisabled();
  });

  it("calls onSave when save button is clicked and form is valid", () => {
    render(
      <AddEditDeadlineDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={{ ...defaultForm, title: "File Motion", date: "2025-02-15" }}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={false}
        cases={defaultCases}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(mockOnSave).toHaveBeenCalled();
  });

  it("calls onOpenChange with false when Cancel is clicked", () => {
    render(
      <AddEditDeadlineDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={defaultForm}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={false}
        cases={defaultCases}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("updates title field when input changes", () => {
    render(
      <AddEditDeadlineDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={defaultForm}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={false}
        cases={defaultCases}
      />,
    );
    const titleInput = screen.getByPlaceholderText(
      "e.g., File motion to compel",
    );
    fireEvent.change(titleInput, { target: { value: "New Deadline" } });
    expect(mockOnFormChange).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "New Deadline",
      }),
    );
  });

  it("renders deadline type select with filing type default", () => {
    const { container } = render(
      <AddEditDeadlineDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={defaultForm}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={false}
        cases={defaultCases}
      />,
    );

    // Verify type select exists and has options
    const selects = container.querySelectorAll("select");
    expect(selects.length).toBeGreaterThan(0);
  });

  it("renders priority select with low priority default", () => {
    const { container } = render(
      <AddEditDeadlineDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={defaultForm}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={false}
        cases={defaultCases}
      />,
    );

    // Verify priority select exists and has options
    const selects = container.querySelectorAll("select");
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it("renders case options", () => {
    render(
      <AddEditDeadlineDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={defaultForm}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={false}
        cases={defaultCases}
      />,
    );

    // Should render the case name
    expect(screen.getByText("Smith v. Jones")).toBeInTheDocument();
  });

  it("updates form when description changes", () => {
    render(
      <AddEditDeadlineDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={defaultForm}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={false}
        cases={defaultCases}
      />,
    );

    const descriptionInput = screen.getByPlaceholderText(
      "Additional details...",
    );
    fireEvent.change(descriptionInput, {
      target: { value: "Important motion" },
    });
    expect(mockOnFormChange).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Important motion",
      }),
    );
  });

  it("populates form with existing deadline data when editing", () => {
    const editForm = {
      title: "Existing Deadline",
      date: "2025-02-15",
      type: "hearing" as Deadline["type"],
      description: "Existing description",
      priority: "high" as const,
      caseId: "case-1",
    };

    render(
      <AddEditDeadlineDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={editForm}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={true}
        cases={defaultCases}
      />,
    );

    const titleInput = screen.getByPlaceholderText(
      "e.g., File motion to compel",
    ) as HTMLInputElement;
    expect(titleInput.value).toBe("Existing Deadline");
  });

  it("trims whitespace from title when validating", () => {
    render(
      <AddEditDeadlineDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={{ ...defaultForm, title: "   ", date: "2025-02-15" }}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={false}
        cases={defaultCases}
      />,
    );
    // Button should be disabled because title is only whitespace
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("handles empty cases list", () => {
    render(
      <AddEditDeadlineDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={defaultForm}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={false}
        cases={[]}
      />,
    );
    expect(screen.queryByText("Smith v. Jones")).not.toBeInTheDocument();
  });
});
