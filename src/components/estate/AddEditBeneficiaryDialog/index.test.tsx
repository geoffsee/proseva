import { render, screen, fireEvent } from "../../../test-utils";
import { AddEditBeneficiaryDialog, type BeneficiaryFormData } from "./index";
import { vi, describe, it, expect } from "vitest";

const mockForm: BeneficiaryFormData = {
  name: "",
  relationship: "",
  dateOfBirth: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

describe("AddEditBeneficiaryDialog", () => {
  it("renders correctly when open", () => {
    const onOpenChange = vi.fn();
    const onFormChange = vi.fn();
    const onSave = vi.fn();

    render(
      <AddEditBeneficiaryDialog
        open={true}
        onOpenChange={onOpenChange}
        form={mockForm}
        onFormChange={onFormChange}
        onSave={onSave}
      />
    );

    expect(screen.getByRole("heading", { name: "Add Beneficiary" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Full legal name")).toBeInTheDocument();
  });

  it("calls onFormChange when input changes", () => {
    const onFormChange = vi.fn();
    render(
      <AddEditBeneficiaryDialog
        open={true}
        onOpenChange={vi.fn()}
        form={mockForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Full legal name"), { target: { value: "John Doe" } });
    expect(onFormChange).toHaveBeenCalledWith(expect.objectContaining({ name: "John Doe" }));

    fireEvent.change(screen.getByPlaceholderText("e.g. Spouse, Child, Sibling"), { target: { value: "Child" } });
    expect(onFormChange).toHaveBeenCalledWith(expect.objectContaining({ relationship: "Child" }));

    const inputs = screen.getAllByRole("textbox");
    // dateOfBirth (type=date) is not always role=textbox.
    // name=inputs[0], relationship=inputs[1], phone=inputs[2], email=inputs[3], address=inputs[4], notes=inputs[5]
    
    const dateInput = document.querySelector('input[type="date"]');
    if (dateInput) {
      fireEvent.change(dateInput, { target: { value: "1990-01-01" } });
      expect(onFormChange).toHaveBeenCalledWith(expect.objectContaining({ dateOfBirth: "1990-01-01" }));
    }

    fireEvent.change(inputs[2], { target: { value: "555-0101" } }); // phone
    expect(onFormChange).toHaveBeenCalledWith(expect.objectContaining({ phone: "555-0101" }));

    fireEvent.change(inputs[3], { target: { value: "john@example.com" } }); // email
    expect(onFormChange).toHaveBeenCalledWith(expect.objectContaining({ email: "john@example.com" }));

    fireEvent.change(inputs[4], { target: { value: "123 Main St" } }); // address
    expect(onFormChange).toHaveBeenCalledWith(expect.objectContaining({ address: "123 Main St" }));

    fireEvent.change(inputs[5], { target: { value: "Some notes" } }); // notes
    expect(onFormChange).toHaveBeenCalledWith(expect.objectContaining({ notes: "Some notes" }));
  });

  it("calls onSave when save button is clicked and name is provided", () => {
    const onSave = vi.fn();
    render(
      <AddEditBeneficiaryDialog
        open={true}
        onOpenChange={vi.fn()}
        form={{ ...mockForm, name: "John Doe" }}
        onFormChange={vi.fn()}
        onSave={onSave}
      />
    );

    const saveButton = screen.getByRole("button", { name: "Add Beneficiary" });
    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalled();
  });

  it("disables save button if name is empty", () => {
    render(
      <AddEditBeneficiaryDialog
        open={true}
        onOpenChange={vi.fn()}
        form={mockForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
      />
    );

    const saveButton = screen.getByRole("button", { name: "Add Beneficiary" });
    expect(saveButton).toBeDisabled();
  });
});
