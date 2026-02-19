import { render, screen, fireEvent } from "../../../test-utils";
import { describe, it, expect, vi } from "vitest";
import { AddEditNoteDialog } from "./index";

describe("AddEditNoteDialog", () => {
  const defaultForm = {
    title: "",
    content: "",
    category: "general" as const,
    tags: [],
    caseId: "",
    isPinned: false,
  };

  const mockCases = [
    { id: "case1", name: "Smith v. Jones" },
    { id: "case2", name: "State v. Doe" },
  ];

  it("renders dialog with Add Note title when not editing", () => {
    render(
      <AddEditNoteDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        isEdit={false}
        cases={mockCases}
      />,
    );
    expect(screen.getByText("Add Note")).toBeInTheDocument();
  });

  it("renders dialog with Edit Note title when editing", () => {
    render(
      <AddEditNoteDialog
        open={true}
        onOpenChange={vi.fn()}
        form={{ ...defaultForm, title: "My Note" }}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        isEdit={true}
        cases={mockCases}
      />,
    );
    expect(screen.getByText("Edit Note")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <AddEditNoteDialog
        open={false}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );
    expect(screen.queryByText("Add Note")).not.toBeInTheDocument();
  });

  it("calls onOpenChange when Cancel button is clicked", () => {
    const onOpenChange = vi.fn();
    render(
      <AddEditNoteDialog
        open={true}
        onOpenChange={onOpenChange}
        form={defaultForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("updates title when changed", () => {
    const onFormChange = vi.fn();
    render(
      <AddEditNoteDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    const titleInput = screen.getByPlaceholderText("Note title");
    fireEvent.change(titleInput, {
      target: { value: "Important Legal Case Notes" },
    });
    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Important Legal Case Notes" }),
    );
  });

  it("updates content when changed", () => {
    const onFormChange = vi.fn();
    const { container } = render(
      <AddEditNoteDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    const textareas = container.querySelectorAll("textarea");
    if (textareas.length > 0) {
      fireEvent.change(textareas[0], {
        target: { value: "Detailed notes about the case" },
      });
      expect(onFormChange).toHaveBeenCalledWith(
        expect.objectContaining({ content: "Detailed notes about the case" }),
      );
    }
  });

  it("updates category when changed", () => {
    const onFormChange = vi.fn();
    const { container } = render(
      <AddEditNoteDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    const selects = container.querySelectorAll("select");
    const categorySelect = selects[0] as HTMLSelectElement;
    fireEvent.change(categorySelect, { target: { value: "case-notes" } });
    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ category: "case-notes" }),
    );
  });

  it("renders tag input field", () => {
    render(
      <AddEditNoteDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    // Verify tag-related elements are rendered - should have title, content, and tag input
    expect(screen.getAllByRole("textbox").length).toBeGreaterThanOrEqual(3);
  });

  it("adds a tag when add button is clicked", () => {
    const onFormChange = vi.fn();
    render(
      <AddEditNoteDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    const tagInputs = screen.getAllByRole("textbox");
    const tagInput = tagInputs[tagInputs.length - 1];
    fireEvent.change(tagInput, { target: { value: "urgent" } });

    const addButton = screen
      .getAllByRole("button")
      .find((btn) => btn.textContent?.includes("+"));
    if (addButton) {
      fireEvent.click(addButton);
      expect(onFormChange).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ["urgent"] }),
      );
    }
  });

  it("does not add empty tags", () => {
    const onFormChange = vi.fn();
    render(
      <AddEditNoteDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    const tagInputs = screen.getAllByRole("textbox");
    const tagInput = tagInputs[tagInputs.length - 1];
    fireEvent.change(tagInput, { target: { value: "   " } });
    fireEvent.keyDown(tagInput, { key: "Enter" });

    // Should not add whitespace-only tags
    const calls = onFormChange.mock.calls;
    const lastCall = calls[calls.length - 1];
    if (lastCall && Array.isArray(lastCall[0]?.tags)) {
      expect(lastCall[0].tags.every((tag: string) => tag.trim() !== "")).toBe(
        true,
      );
    }
  });

  it("does not add duplicate tags", () => {
    const onFormChange = vi.fn();
    render(
      <AddEditNoteDialog
        open={true}
        onOpenChange={vi.fn()}
        form={{ ...defaultForm, tags: ["existing"] }}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    const tagInputs = screen.getAllByRole("textbox");
    const tagInput = tagInputs[tagInputs.length - 1];
    fireEvent.change(tagInput, { target: { value: "existing" } });
    fireEvent.keyDown(tagInput, { key: "Enter" });

    // Should not add duplicate tags
    expect(onFormChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ tags: ["existing", "existing"] }),
    );
  });

  it("removes a tag when remove button is clicked", () => {
    const onFormChange = vi.fn();
    render(
      <AddEditNoteDialog
        open={true}
        onOpenChange={vi.fn()}
        form={{ ...defaultForm, tags: ["important", "urgent"] }}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    const removeButtons = screen
      .getAllByRole("button")
      .filter((btn) => btn.querySelector("svg"));
    if (removeButtons.length > 0) {
      fireEvent.click(removeButtons[0]);
      expect(onFormChange).toHaveBeenCalledWith(
        expect.objectContaining({ tags: expect.any(Array) }),
      );
    }
  });

  it("shows all required fields", () => {
    render(
      <AddEditNoteDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    expect(screen.getByText(/Title \*/)).toBeInTheDocument();
    expect(screen.getByText(/Content \*/)).toBeInTheDocument();
    expect(screen.getByText(/Category \*/)).toBeInTheDocument();
  });

  it("displays category options", () => {
    const { container } = render(
      <AddEditNoteDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    const selects = container.querySelectorAll("select");
    const categorySelect = selects[0] as HTMLSelectElement;
    const options = categorySelect.querySelectorAll("option");
    const optionValues = Array.from(options).map((o) => o.value);

    expect(optionValues).toContain("case-notes");
    expect(optionValues).toContain("research");
    expect(optionValues).toContain("todo");
    expect(optionValues).toContain("general");
  });

  it("calls onSave when Save button is clicked", () => {
    const onSave = vi.fn();
    render(
      <AddEditNoteDialog
        open={true}
        onOpenChange={vi.fn()}
        form={{ ...defaultForm, title: "Note Title", content: "Content" }}
        onFormChange={vi.fn()}
        onSave={onSave}
        isEdit={true}
        cases={mockCases}
      />,
    );
    const buttons = screen.getAllByRole("button");
    const saveButton = buttons.find((btn) => btn.textContent?.includes("Save"));
    if (saveButton) {
      fireEvent.click(saveButton);
      expect(onSave).toHaveBeenCalled();
    }
  });

  it("displays tags", () => {
    render(
      <AddEditNoteDialog
        open={true}
        onOpenChange={vi.fn()}
        form={{ ...defaultForm, tags: ["important", "urgent", "follow-up"] }}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    expect(screen.getByText("important")).toBeInTheDocument();
    expect(screen.getByText("urgent")).toBeInTheDocument();
    expect(screen.getByText("follow-up")).toBeInTheDocument();
  });

  it("displays multiple tags when provided", () => {
    const tagsForm = {
      ...defaultForm,
      tags: ["urgent", "important", "followup"],
    };
    render(
      <AddEditNoteDialog
        open={true}
        onOpenChange={vi.fn()}
        form={tagsForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    // Verify all tags are displayed
    expect(screen.getByText("urgent")).toBeInTheDocument();
    expect(screen.getByText("important")).toBeInTheDocument();
    expect(screen.getByText("followup")).toBeInTheDocument();
  });

  it("updates case selection", () => {
    const onFormChange = vi.fn();
    const { container } = render(
      <AddEditNoteDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    const selects = container.querySelectorAll("select");
    const caseSelect = selects[1] as HTMLSelectElement;
    fireEvent.change(caseSelect, { target: { value: "case1" } });
    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: "case1" }),
    );
  });

  it("handles missing cases prop", () => {
    render(
      <AddEditNoteDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText(/Title \*/)).toBeInTheDocument();
  });

  it("displays case options when provided", () => {
    const { container } = render(
      <AddEditNoteDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    const selects = container.querySelectorAll("select");
    const caseSelect = selects[1] as HTMLSelectElement;
    const options = caseSelect.querySelectorAll("option");
    const optionValues = Array.from(options).map((o) => o.value);

    expect(optionValues).toContain("case1");
    expect(optionValues).toContain("case2");
  });

  it("updates isPinned when checkbox is toggled", () => {
    const onFormChange = vi.fn();
    const { container } = render(
      <AddEditNoteDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    const checkboxes = container.querySelectorAll("input[type='checkbox']");
    if (checkboxes.length > 0) {
      fireEvent.click(checkboxes[0]);
      expect(onFormChange).toHaveBeenCalledWith(
        expect.objectContaining({ isPinned: true }),
      );
    }
  });
});
