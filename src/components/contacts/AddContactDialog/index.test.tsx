import { render, screen, fireEvent } from "../../../test-utils";
import { describe, it, expect, vi } from "vitest";
import { AddContactDialog } from "./index";

describe("AddContactDialog", () => {
  const defaultForm = {
    name: "",
    role: "attorney" as const,
    organization: "",
    phone: "",
    email: "",
    address: "",
    caseId: "",
    notes: "",
  };

  const mockCases = [
    { id: "case1", name: "Smith v. Jones" },
    { id: "case2", name: "State v. Doe" },
  ];

  it("renders dialog with Add Contact title when not editing", () => {
    render(
      <AddContactDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        isEdit={false}
        cases={mockCases}
      />,
    );
    expect(screen.getByText("Add Contact")).toBeInTheDocument();
  });

  it("renders dialog with Edit Contact title when editing", () => {
    render(
      <AddContactDialog
        open={true}
        onOpenChange={vi.fn()}
        form={{ ...defaultForm, name: "John Doe" }}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        isEdit={true}
        cases={mockCases}
      />,
    );
    expect(screen.getByText("Edit Contact")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <AddContactDialog
        open={false}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );
    expect(screen.queryByText("Add Contact")).not.toBeInTheDocument();
  });

  it("calls onOpenChange when Cancel button is clicked", () => {
    const onOpenChange = vi.fn();
    render(
      <AddContactDialog
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

  it("disables Add button when name is empty", () => {
    render(
      <AddContactDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );
    const addButton = screen.getByRole("button", { name: "Add" });
    expect(addButton).toBeDisabled();
  });

  it("enables Add button when name is provided", () => {
    render(
      <AddContactDialog
        open={true}
        onOpenChange={vi.fn()}
        form={{ ...defaultForm, name: "Jane Smith" }}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );
    const addButton = screen.getByRole("button", { name: "Add" });
    expect(addButton).not.toBeDisabled();
  });

  it("disables Save button when name is whitespace only", () => {
    render(
      <AddContactDialog
        open={true}
        onOpenChange={vi.fn()}
        form={{ ...defaultForm, name: "   " }}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        isEdit={true}
        cases={mockCases}
      />,
    );
    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeDisabled();
  });

  it("calls onSave when Add button is clicked", () => {
    const onSave = vi.fn();
    render(
      <AddContactDialog
        open={true}
        onOpenChange={vi.fn()}
        form={{ ...defaultForm, name: "Jane Smith" }}
        onFormChange={vi.fn()}
        onSave={onSave}
        cases={mockCases}
      />,
    );
    const addButton = screen.getByRole("button", { name: "Add" });
    fireEvent.click(addButton);
    expect(onSave).toHaveBeenCalled();
  });

  it("calls onSave when Save button is clicked in edit mode", () => {
    const onSave = vi.fn();
    render(
      <AddContactDialog
        open={true}
        onOpenChange={vi.fn()}
        form={{ ...defaultForm, name: "Jane Smith" }}
        onFormChange={vi.fn()}
        onSave={onSave}
        isEdit={true}
        cases={mockCases}
      />,
    );
    const saveButton = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveButton);
    expect(onSave).toHaveBeenCalled();
  });

  it("updates name when changed", () => {
    const onFormChange = vi.fn();
    render(
      <AddContactDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    const nameInput = screen.getByPlaceholderText("Full name");
    fireEvent.change(nameInput, { target: { value: "Jane Smith" } });
    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Jane Smith" }),
    );
  });

  it("updates role when changed", () => {
    const onFormChange = vi.fn();
    const { container } = render(
      <AddContactDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    const selects = container.querySelectorAll("select");
    const roleSelect = selects[0] as HTMLSelectElement;
    fireEvent.change(roleSelect, { target: { value: "judge" } });
    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ role: "judge" }),
    );
  });

  it("updates organization when changed", () => {
    const onFormChange = vi.fn();
    render(
      <AddContactDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    const organizationInput = screen.getByPlaceholderText(
      "Firm, court, or company",
    );
    fireEvent.change(organizationInput, { target: { value: "Supreme Court" } });
    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ organization: "Supreme Court" }),
    );
  });

  it("updates phone when changed", () => {
    const onFormChange = vi.fn();
    render(
      <AddContactDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    const phoneInputs = screen.getAllByPlaceholderText("(555) 123-4567");
    fireEvent.change(phoneInputs[0], { target: { value: "(555) 999-1234" } });
    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "(555) 999-1234" }),
    );
  });

  it("updates email when changed", () => {
    const onFormChange = vi.fn();
    render(
      <AddContactDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    const emailInput = screen.getByPlaceholderText("email@example.com");
    fireEvent.change(emailInput, { target: { value: "jane@example.com" } });
    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ email: "jane@example.com" }),
    );
  });

  it("updates address when changed", () => {
    const onFormChange = vi.fn();
    render(
      <AddContactDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    const addressInput = screen.getByPlaceholderText(
      "Street address, city, state",
    );
    fireEvent.change(addressInput, {
      target: { value: "123 Main St, Boston, MA" },
    });
    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ address: "123 Main St, Boston, MA" }),
    );
  });

  it("updates case selection when changed", () => {
    const onFormChange = vi.fn();
    const { container } = render(
      <AddContactDialog
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

  it("updates notes when changed", () => {
    const onFormChange = vi.fn();
    render(
      <AddContactDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    const notesInput = screen.getByPlaceholderText("Additional details");
    fireEvent.change(notesInput, {
      target: { value: "Expert witness in forensics" },
    });
    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ notes: "Expert witness in forensics" }),
    );
  });

  it("shows all form fields", () => {
    render(
      <AddContactDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    expect(screen.getByText("Name *")).toBeInTheDocument();
    expect(screen.getByText("Role *")).toBeInTheDocument();
    expect(screen.getByText("Organization")).toBeInTheDocument();
    expect(screen.getByText("Phone")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Address")).toBeInTheDocument();
    expect(screen.getByText("Case")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
  });

  it("displays case options when provided", () => {
    const { container } = render(
      <AddContactDialog
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

  it("handles empty cases array", () => {
    render(
      <AddContactDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        cases={[]}
      />,
    );

    expect(screen.getByText("Case")).toBeInTheDocument();
  });

  it("displays all role options", () => {
    const { container } = render(
      <AddContactDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        cases={mockCases}
      />,
    );

    const selects = container.querySelectorAll("select");
    const roleSelect = selects[0] as HTMLSelectElement;
    const options = roleSelect.querySelectorAll("option");
    const optionValues = Array.from(options).map((o) => o.textContent);

    expect(optionValues).toContain("Attorney");
    expect(optionValues).toContain("Judge");
    expect(optionValues).toContain("Witness");
    expect(optionValues).toContain("Expert Witness");
  });
});
