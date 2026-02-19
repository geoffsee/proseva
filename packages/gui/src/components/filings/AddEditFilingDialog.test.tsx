import { render, screen, fireEvent } from "../../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AddEditFilingDialog } from "./AddEditFilingDialog";

describe("AddEditFilingDialog component", () => {
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
      type: "",
      notes: "",
      caseId: "",
    };
    defaultCases = [{ id: "case-1", name: "Smith v. Jones" }];
  });

  it("renders dialog when open is true", () => {
    render(
      <AddEditFilingDialog
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
      screen.getByRole("heading", { name: "Add Filing" }),
    ).toBeInTheDocument();
  });

  it("shows 'Edit Filing' title when isEdit is true", () => {
    render(
      <AddEditFilingDialog
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
      screen.getByRole("heading", { name: "Edit Filing" }),
    ).toBeInTheDocument();
  });

  it("shows 'Add' button when not editing", () => {
    render(
      <AddEditFilingDialog
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
      <AddEditFilingDialog
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

  it("renders form title and date inputs", () => {
    render(
      <AddEditFilingDialog
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
      screen.getByPlaceholderText("e.g., Motion to Modify Support"),
    ).toBeInTheDocument();
  });

  it("disables Save/Add button when title is empty", () => {
    render(
      <AddEditFilingDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={{ ...defaultForm, title: "", date: "2025-01-15" }}
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
      <AddEditFilingDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={{ ...defaultForm, title: "Motion to Dismiss", date: "" }}
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
      <AddEditFilingDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={{
          ...defaultForm,
          title: "Motion to Dismiss",
          date: "2025-01-15",
        }}
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
      <AddEditFilingDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={{
          ...defaultForm,
          title: "Motion to Dismiss",
          date: "2025-01-15",
        }}
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
      <AddEditFilingDialog
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
      <AddEditFilingDialog
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
      "e.g., Motion to Modify Support",
    );
    fireEvent.change(titleInput, { target: { value: "New Filing" } });
    expect(mockOnFormChange).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "New Filing",
      }),
    );
  });

  it("renders all filing type options", () => {
    render(
      <AddEditFilingDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={defaultForm}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={false}
        cases={defaultCases}
      />,
    );

    // Check for some of the filing types
    expect(screen.getByText("Motion")).toBeInTheDocument();
    expect(screen.getByText("Order")).toBeInTheDocument();
    expect(screen.getByText("Brief")).toBeInTheDocument();
  });

  it("renders case options", () => {
    render(
      <AddEditFilingDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={defaultForm}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={false}
        cases={defaultCases}
      />,
    );

    expect(screen.getByText("Smith v. Jones")).toBeInTheDocument();
  });

  it("updates form when notes change", () => {
    render(
      <AddEditFilingDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={defaultForm}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={false}
        cases={defaultCases}
      />,
    );

    const notesInput = screen.getByPlaceholderText(
      "Additional notes or description",
    );
    fireEvent.change(notesInput, { target: { value: "Important filing" } });
    expect(mockOnFormChange).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: "Important filing",
      }),
    );
  });

  it("updates form when filing type changes", () => {
    const { container } = render(
      <AddEditFilingDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={defaultForm}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={false}
        cases={defaultCases}
      />,
    );

    const selects = container.querySelectorAll("select");
    // First select is for filing type
    fireEvent.change(selects[0], { target: { value: "Motion" } });
    expect(mockOnFormChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "Motion",
      }),
    );
  });

  it("updates form when case changes", () => {
    const { container } = render(
      <AddEditFilingDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={defaultForm}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={false}
        cases={defaultCases}
      />,
    );

    const selects = container.querySelectorAll("select");
    // Second select is for case
    fireEvent.change(selects[1], { target: { value: "case-1" } });
    expect(mockOnFormChange).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: "case-1",
      }),
    );
  });

  it("populates form with existing filing data when editing", () => {
    const editForm = {
      title: "Existing Filing",
      date: "2025-01-15",
      type: "Motion",
      notes: "Existing notes",
      caseId: "case-1",
    };

    render(
      <AddEditFilingDialog
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
      "e.g., Motion to Modify Support",
    ) as HTMLInputElement;
    expect(titleInput.value).toBe("Existing Filing");
  });

  it("trims whitespace from title when validating", () => {
    render(
      <AddEditFilingDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={{ ...defaultForm, title: "   ", date: "2025-01-15" }}
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
      <AddEditFilingDialog
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

  it("allows optional filing type (None selected)", () => {
    render(
      <AddEditFilingDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        form={{ ...defaultForm, title: "Filing", date: "2025-01-15", type: "" }}
        onFormChange={mockOnFormChange}
        onSave={mockOnSave}
        isEdit={false}
        cases={defaultCases}
      />,
    );
    // Should still enable button even without type
    expect(screen.getByRole("button", { name: "Add" })).not.toBeDisabled();
  });
});
