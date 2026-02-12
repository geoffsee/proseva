import { render, screen, fireEvent } from "../../../test-utils";
import { AddEditAssetDialog, type AssetFormData } from "./index";
import { vi, describe, it, expect } from "vitest";

const mockForm: AssetFormData = {
  name: "",
  category: "real-property",
  estimatedValue: "",
  ownershipType: "",
  accountNumber: "",
  institution: "",
  notes: "",
};

describe("AddEditAssetDialog", () => {
  it("renders correctly when open", () => {
    const onOpenChange = vi.fn();
    const onFormChange = vi.fn();
    const onSave = vi.fn();

    render(
      <AddEditAssetDialog
        open={true}
        onOpenChange={onOpenChange}
        form={mockForm}
        onFormChange={onFormChange}
        onSave={onSave}
      />
    );

    expect(screen.getByRole("heading", { name: "Add Asset" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Primary Residence, Savings Account")).toBeInTheDocument();
  });

  it("calls onFormChange when name changes", () => {
    const onFormChange = vi.fn();
    render(
      <AddEditAssetDialog
        open={true}
        onOpenChange={vi.fn()}
        form={mockForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("e.g. Primary Residence, Savings Account");
    fireEvent.change(input, { target: { value: "My House" } });

    expect(onFormChange).toHaveBeenCalledWith({
      ...mockForm,
      name: "My House",
    });
  });

  it("calls onFormChange when category changes", () => {
    const onFormChange = vi.fn();
    render(
      <AddEditAssetDialog
        open={true}
        onOpenChange={vi.fn()}
        form={mockForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
      />
    );

    const select = screen.getByDisplayValue("Real Property");
    fireEvent.change(select, { target: { value: "bank-account" } });

    expect(onFormChange).toHaveBeenCalledWith({
      ...mockForm,
      category: "bank-account",
    });
  });

  it("calls onFormChange when estimatedValue changes", () => {
    const onFormChange = vi.fn();
    render(
      <AddEditAssetDialog
        open={true}
        onOpenChange={vi.fn()}
        form={mockForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("0");
    fireEvent.change(input, { target: { value: "1000" } });

    expect(onFormChange).toHaveBeenCalledWith({
      ...mockForm,
      estimatedValue: "1000",
    });
  });

  it("calls onFormChange when other fields change", () => {
    const onFormChange = vi.fn();
    render(
      <AddEditAssetDialog
        open={true}
        onOpenChange={vi.fn()}
        form={mockForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("e.g. Sole, Joint, Community"), { target: { value: "Joint" } });
    expect(onFormChange).toHaveBeenCalledWith(expect.objectContaining({ ownershipType: "Joint" }));

    fireEvent.change(screen.getByPlaceholderText("e.g. Bank of America, Fidelity"), { target: { value: "Fidelity" } });
    expect(onFormChange).toHaveBeenCalledWith(expect.objectContaining({ institution: "Fidelity" }));

    // Find Account Number input - it doesn't have a placeholder, but it's the 5th input (index 4)
    // 0: name, 1: ownershipType, 2: accountNumber, 3: institution, 4: notes
    // Wait, let's check order in code.
    // name, (select category), estimatedValue (number), ownershipType, accountNumber, institution, notes
    // Input roles:
    // name: textbox
    // estimatedValue: spinbutton (type=number)
    // ownershipType: textbox
    // accountNumber: textbox
    // institution: textbox
    // notes: textbox
    
    const textboxes = screen.getAllByRole("textbox");
    fireEvent.change(textboxes[2], { target: { value: "12345" } }); // accountNumber
    expect(onFormChange).toHaveBeenCalledWith(expect.objectContaining({ accountNumber: "12345" }));

    fireEvent.change(textboxes[4], { target: { value: "Some notes" } }); // notes
    expect(onFormChange).toHaveBeenCalledWith(expect.objectContaining({ notes: "Some notes" }));
  });

  it("calls onSave when save button is clicked and name is provided", () => {
    const onSave = vi.fn();
    render(
      <AddEditAssetDialog
        open={true}
        onOpenChange={vi.fn()}
        form={{ ...mockForm, name: "My House" }}
        onFormChange={vi.fn()}
        onSave={onSave}
      />
    );

    const saveButton = screen.getByRole("button", { name: "Add Asset" });
    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalled();
  });

  it("disables save button if name is empty", () => {
    render(
      <AddEditAssetDialog
        open={true}
        onOpenChange={vi.fn()}
        form={mockForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
      />
    );

    const saveButton = screen.getByRole("button", { name: "Add Asset" });
    expect(saveButton).toBeDisabled();
  });

  it("calls onOpenChange(false) when cancel button is clicked", () => {
    const onOpenChange = vi.fn();
    render(
      <AddEditAssetDialog
        open={true}
        onOpenChange={onOpenChange}
        form={mockForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
      />
    );

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
