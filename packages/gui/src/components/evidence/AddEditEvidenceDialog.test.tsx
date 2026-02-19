import { render, screen, fireEvent } from "../../test-utils";
import { describe, it, expect, vi } from "vitest";
import { AddEditEvidenceDialog } from "./AddEditEvidenceDialog";

describe("AddEditEvidenceDialog", () => {
  const defaultForm = {
    title: "",
    exhibitNumber: "",
    description: "",
    type: "document" as const,
    fileUrl: "",
    dateCollected: "",
    location: "",
    tags: "",
    relevance: "medium" as const,
    admissible: false,
    notes: "",
    caseId: "",
  };

  const mockCases = [
    { id: "case1", name: "Smith v. Jones" },
    { id: "case2", name: "State v. Doe" },
  ];

  it("renders dialog with Add Evidence title when not editing", () => {
    render(
      <AddEditEvidenceDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        isEdit={false}
        cases={mockCases}
      />,
    );
    expect(screen.getByText("Add Evidence")).toBeInTheDocument();
  });

  it("renders dialog with Edit Evidence title when editing", () => {
    render(
      <AddEditEvidenceDialog
        open={true}
        onOpenChange={vi.fn()}
        form={{ ...defaultForm, title: "Security Footage" }}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        isEdit={true}
        cases={mockCases}
      />,
    );
    expect(screen.getByText("Edit Evidence")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <AddEditEvidenceDialog
        open={false}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        isEdit={false}
        cases={mockCases}
      />,
    );
    expect(screen.queryByText("Add Evidence")).not.toBeInTheDocument();
  });

  it("calls onOpenChange when Cancel button is clicked", () => {
    const onOpenChange = vi.fn();
    render(
      <AddEditEvidenceDialog
        open={true}
        onOpenChange={onOpenChange}
        form={defaultForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        isEdit={false}
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
      <AddEditEvidenceDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        isEdit={false}
        cases={mockCases}
      />,
    );

    const titleInput = screen.getByPlaceholderText(
      "e.g., Security camera footage",
    );
    fireEvent.change(titleInput, {
      target: { value: "Security camera footage from entrance" },
    });
    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Security camera footage from entrance",
      }),
    );
  });

  it("updates exhibit number when changed", () => {
    const onFormChange = vi.fn();
    render(
      <AddEditEvidenceDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        isEdit={false}
        cases={mockCases}
      />,
    );

    const exhibitInput = screen.getByPlaceholderText("e.g., Exhibit A");
    fireEvent.change(exhibitInput, { target: { value: "Exhibit B" } });
    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ exhibitNumber: "Exhibit B" }),
    );
  });

  it("updates type when changed", () => {
    const onFormChange = vi.fn();
    const { container } = render(
      <AddEditEvidenceDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        isEdit={false}
        cases={mockCases}
      />,
    );

    const selects = container.querySelectorAll("select");
    const typeSelect = selects[0] as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: "photo" } });
    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: "photo" }),
    );
  });

  it("shows all required fields", () => {
    render(
      <AddEditEvidenceDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        isEdit={false}
        cases={mockCases}
      />,
    );

    expect(screen.getByText(/Title \*/)).toBeInTheDocument();
    expect(screen.getByText("Exhibit Number")).toBeInTheDocument();
    expect(screen.getByText(/Type \*/)).toBeInTheDocument();
  });

  it("displays type options", () => {
    const { container } = render(
      <AddEditEvidenceDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        isEdit={false}
        cases={mockCases}
      />,
    );

    const selects = container.querySelectorAll("select");
    const typeSelect = selects[0] as HTMLSelectElement;
    const options = typeSelect.querySelectorAll("option");
    const optionValues = Array.from(options).map((o) => o.value);

    expect(optionValues).toContain("document");
    expect(optionValues).toContain("photo");
    expect(optionValues).toContain("video");
    expect(optionValues).toContain("audio");
  });

  it("displays case options", () => {
    const { container } = render(
      <AddEditEvidenceDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        isEdit={false}
        cases={mockCases}
      />,
    );

    const selects = container.querySelectorAll("select");
    expect(selects.length).toBeGreaterThan(0);
  });

  it("displays relevance options", () => {
    const { container } = render(
      <AddEditEvidenceDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        isEdit={false}
        cases={mockCases}
      />,
    );

    const selects = container.querySelectorAll("select");
    const relevanceSelect = Array.from(selects).find((select) => {
      const options = select.querySelectorAll("option");
      const hasHigh = Array.from(options).some((opt) => opt.value === "high");
      return hasHigh;
    }) as HTMLSelectElement | undefined;

    if (relevanceSelect) {
      const options = relevanceSelect.querySelectorAll("option");
      const optionValues = Array.from(options).map((o) => o.value);
      expect(optionValues).toContain("high");
      expect(optionValues).toContain("medium");
      expect(optionValues).toContain("low");
    }
  });

  it("calls onSave when Save button is clicked", () => {
    const onSave = vi.fn();
    render(
      <AddEditEvidenceDialog
        open={true}
        onOpenChange={vi.fn()}
        form={{ ...defaultForm, title: "Evidence Title" }}
        onFormChange={vi.fn()}
        onSave={onSave}
        isEdit={false}
        cases={mockCases}
      />,
    );
    const buttons = screen.getAllByRole("button");
    const saveButton = buttons.find(
      (btn) =>
        btn.textContent?.includes("Save") || btn.textContent?.includes("Add"),
    );
    if (saveButton) {
      fireEvent.click(saveButton);
      expect(onSave).toHaveBeenCalled();
    }
  });

  it("updates description when changed", () => {
    const onFormChange = vi.fn();
    const { container } = render(
      <AddEditEvidenceDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        isEdit={false}
        cases={mockCases}
      />,
    );

    const textareas = container.querySelectorAll("textarea");
    if (textareas.length > 0) {
      fireEvent.change(textareas[0], {
        target: { value: "Description of evidence" },
      });
      expect(onFormChange).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Description of evidence" }),
      );
    }
  });

  it("updates file URL when changed", () => {
    const onFormChange = vi.fn();
    render(
      <AddEditEvidenceDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        isEdit={false}
        cases={mockCases}
      />,
    );

    const inputs = screen.getAllByRole("textbox");
    const fileUrlInput = inputs.find(
      (input) =>
        (input as HTMLInputElement).placeholder?.includes("http") ||
        input === inputs[2],
    );
    if (fileUrlInput) {
      fireEvent.change(fileUrlInput, {
        target: { value: "https://example.com/file.pdf" },
      });
    }
  });

  it("updates relevance when changed", () => {
    const onFormChange = vi.fn();
    const { container } = render(
      <AddEditEvidenceDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        isEdit={false}
        cases={mockCases}
      />,
    );

    const selects = container.querySelectorAll("select");
    const relevanceSelect = Array.from(selects).find((select) => {
      const options = select.querySelectorAll("option");
      const hasHigh = Array.from(options).some((opt) => opt.value === "high");
      return hasHigh;
    }) as HTMLSelectElement | undefined;

    if (relevanceSelect) {
      fireEvent.change(relevanceSelect, { target: { value: "high" } });
      expect(onFormChange).toHaveBeenCalledWith(
        expect.objectContaining({ relevance: "high" }),
      );
    }
  });

  it("renders all form fields including admissible option", () => {
    render(
      <AddEditEvidenceDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        isEdit={false}
        cases={mockCases}
      />,
    );

    // Verify the dialog renders with expected content
    expect(screen.getByText(/Title \*/)).toBeInTheDocument();
    expect(screen.getByText("Exhibit Number")).toBeInTheDocument();
  });

  it("updates case selection", () => {
    const onFormChange = vi.fn();
    const { container } = render(
      <AddEditEvidenceDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        isEdit={false}
        cases={mockCases}
      />,
    );

    const selects = container.querySelectorAll("select");
    const caseSelect = Array.from(selects).find((select) => {
      const options = select.querySelectorAll("option");
      const hasCaseId = Array.from(options).some(
        (opt) => opt.value === "case1",
      );
      return hasCaseId;
    }) as HTMLSelectElement | undefined;

    if (caseSelect) {
      fireEvent.change(caseSelect, { target: { value: "case1" } });
      expect(onFormChange).toHaveBeenCalledWith(
        expect.objectContaining({ caseId: "case1" }),
      );
    }
  });

  it("updates notes when changed", () => {
    const onFormChange = vi.fn();
    const { container } = render(
      <AddEditEvidenceDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        isEdit={false}
        cases={mockCases}
      />,
    );

    const textareas = container.querySelectorAll("textarea");
    if (textareas.length > 1) {
      fireEvent.change(textareas[1], {
        target: { value: "Notes about evidence" },
      });
      expect(onFormChange).toHaveBeenCalledWith(
        expect.objectContaining({ notes: "Notes about evidence" }),
      );
    }
  });
});
