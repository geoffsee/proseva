import { render, screen, fireEvent } from "../../../test-utils";
import { EstateDocumentWizard } from "./index";
import { vi, describe, it, expect } from "vitest";

describe("EstateDocumentWizard", () => {
  it("renders step 0 correctly", () => {
    render(<EstateDocumentWizard onSave={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText("Select Template")).toBeInTheDocument();
    expect(screen.getByText("Last Will and Testament")).toBeInTheDocument();
  });

  it("moves to step 1 when a template is selected", () => {
    render(<EstateDocumentWizard onSave={vi.fn()} onCancel={vi.fn()} />);

    const template = screen.getByText("Last Will and Testament");
    fireEvent.click(template);

    expect(screen.getByText("Fill Fields")).toBeInTheDocument();
    expect(screen.getByText(/Testator/)).toBeInTheDocument();
  });

  it("moves to step 2 when required fields are filled", () => {
    render(<EstateDocumentWizard onSave={vi.fn()} onCancel={vi.fn()} />);

    const template = screen.getByText("Last Will and Testament");
    fireEvent.click(template);

    // Step 1: Fill fields
    const inputs = screen.getAllByRole("textbox");
    
    // testatorName
    fireEvent.change(inputs[0], { target: { value: "John Doe" } });
    // county
    fireEvent.change(inputs[1], { target: { value: "Fairfax" } });
    // executorName
    fireEvent.change(inputs[2], { target: { value: "Jane Doe" } });
    // residuaryBeneficiary is index 6
    fireEvent.change(inputs[6], { target: { value: "Jane Doe" } });

    const previewButton = screen.getByRole("button", { name: /Preview/i });
    expect(previewButton).not.toBeDisabled();
    fireEvent.click(previewButton);

    // Step 2: Preview
    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.getByText(/LAST WILL AND TESTAMENT OF John Doe/)).toBeInTheDocument();
  });

  it("handles empty fields in preview by showing placeholders", () => {
    render(<EstateDocumentWizard onSave={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByText("Last Will and Testament"));

    // Fill only testatorName
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "John Doe" } });
    
    // We can't click preview because other fields are required.
    // Let's find a template with fewer required fields or just check the code.
    // Actually, I can mock the template or just fill required but leave optional empty.
    // county is required.
    fireEvent.change(inputs[1], { target: { value: "Fairfax" } });
    // executorName is required.
    fireEvent.change(inputs[2], { target: { value: "Jane Doe" } });
    // residuaryBeneficiary is required.
    fireEvent.change(inputs[6], { target: { value: "Jane Doe" } });

    // alternateExecutor (index 3) is optional.
    // alternateResiduaryBeneficiary (index 7) is optional.

    fireEvent.click(screen.getByRole("button", { name: /Preview/i }));

    // Should show placeholder for alternateExecutor
    expect(screen.getByText(/If Jane Doe is unable or unwilling to serve, I appoint \[alternateExecutor\] as alternate Executor/)).toBeInTheDocument();
  });

  it("calls onSave when save button is clicked in step 2", () => {
    const onSave = vi.fn();
    render(<EstateDocumentWizard onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByText("Last Will and Testament"));

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "John Doe" } });
    fireEvent.change(inputs[1], { target: { value: "Fairfax" } });
    fireEvent.change(inputs[2], { target: { value: "Jane Doe" } });
    fireEvent.change(inputs[6], { target: { value: "Jane Doe" } });

    fireEvent.click(screen.getByRole("button", { name: /Preview/i }));

    const saveButton = screen.getByRole("button", { name: /Save Document/i });
    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      type: "last-will",
      title: "Last Will and Testament",
      templateId: "last-will",
    }));
  });

  it("calls onCancel when cancel button is clicked in step 0", () => {
    const onCancel = vi.fn();
    render(<EstateDocumentWizard onSave={vi.fn()} onCancel={onCancel} />);

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });

  it("goes back to step 0 when back button is clicked in step 1", () => {
    render(<EstateDocumentWizard onSave={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByText("Last Will and Testament"));
    expect(screen.getByText("Fill Fields")).toBeInTheDocument();

    const backButton = screen.getByRole("button", { name: /Back/i });
    fireEvent.click(backButton);

    expect(screen.getByText("Select Template")).toBeInTheDocument();
  });

  it("handles select fields correctly", () => {
    render(<EstateDocumentWizard onSave={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByText("Advance Medical Directive"));

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "I wish to donate any needed organs/tissues" } });

    expect(select).toHaveValue("I wish to donate any needed organs/tissues");
  });
});
