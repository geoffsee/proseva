import { render, screen, fireEvent } from "../../../test-utils";
import { AddEditPlanDialog, PlanFormData } from "./index";
import { vi, describe, it, expect } from "vitest";

const mockForm: PlanFormData = {
  title: "",
  testatorName: "",
  testatorDateOfBirth: "",
  testatorAddress: "",
  executorName: "",
  executorPhone: "",
  executorEmail: "",
  guardianName: "",
  guardianPhone: "",
  notes: "",
};

describe("AddEditPlanDialog", () => {
  it("renders correctly when open for new plan", () => {
    render(
      <AddEditPlanDialog
        open={true}
        onOpenChange={vi.fn()}
        form={mockForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "New Estate Plan" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. My Estate Plan 2025")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Plan" })).toBeInTheDocument();
  });

  it("renders correctly when open for edit", () => {
    render(
      <AddEditPlanDialog
        open={true}
        onOpenChange={vi.fn()}
        form={mockForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        isEdit={true}
      />
    );

    expect(screen.getByRole("heading", { name: "Edit Estate Plan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
  });

  it("calls onFormChange when fields change", () => {
    const onFormChange = vi.fn();
    render(
      <AddEditPlanDialog
        open={true}
        onOpenChange={vi.fn()}
        form={mockForm}
        onFormChange={onFormChange}
        onSave={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("e.g. My Estate Plan 2025"), { target: { value: "Plan 2026" } });
    expect(onFormChange).toHaveBeenCalledWith(expect.objectContaining({ title: "Plan 2026" }));

    const inputs = screen.getAllByRole("textbox");
    // title=inputs[0], testatorName=inputs[1], testatorAddress=inputs[2], executorName=inputs[3], executorPhone=inputs[4], executorEmail=inputs[5], guardianName=inputs[6], guardianPhone=inputs[7], notes=inputs[8]
    
    const dateInput = document.querySelector('input[type="date"]');
    if (dateInput) {
      fireEvent.change(dateInput, { target: { value: "1980-01-01" } });
      expect(onFormChange).toHaveBeenCalledWith(expect.objectContaining({ testatorDateOfBirth: "1980-01-01" }));
    }

    fireEvent.change(inputs[1], { target: { value: "John Doe" } });
    expect(onFormChange).toHaveBeenCalledWith(expect.objectContaining({ testatorName: "John Doe" }));

    fireEvent.change(inputs[2], { target: { value: "123 Main St" } });
    expect(onFormChange).toHaveBeenCalledWith(expect.objectContaining({ testatorAddress: "123 Main St" }));

    fireEvent.change(inputs[3], { target: { value: "Jane Doe" } });
    expect(onFormChange).toHaveBeenCalledWith(expect.objectContaining({ executorName: "Jane Doe" }));

    fireEvent.change(inputs[4], { target: { value: "555-0101" } });
    expect(onFormChange).toHaveBeenCalledWith(expect.objectContaining({ executorPhone: "555-0101" }));

    fireEvent.change(inputs[5], { target: { value: "jane@example.com" } });
    expect(onFormChange).toHaveBeenCalledWith(expect.objectContaining({ executorEmail: "jane@example.com" }));

    fireEvent.change(inputs[6], { target: { value: "Bob Smith" } });
    expect(onFormChange).toHaveBeenCalledWith(expect.objectContaining({ guardianName: "Bob Smith" }));

    fireEvent.change(inputs[7], { target: { value: "555-0202" } });
    expect(onFormChange).toHaveBeenCalledWith(expect.objectContaining({ guardianPhone: "555-0202" }));

    fireEvent.change(inputs[8], { target: { value: "Some notes" } });
    expect(onFormChange).toHaveBeenCalledWith(expect.objectContaining({ notes: "Some notes" }));
  });

  it("disables save button if title is empty", () => {
    render(
      <AddEditPlanDialog
        open={true}
        onOpenChange={vi.fn()}
        form={mockForm}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
      />
    );

    const saveButton = screen.getByRole("button", { name: "Create Plan" });
    expect(saveButton).toBeDisabled();
  });
});
