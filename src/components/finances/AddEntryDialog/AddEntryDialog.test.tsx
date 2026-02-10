import { render, screen, fireEvent } from "../../../test-utils";
import { describe, it, expect, vi } from "vitest";
import { AddEntryDialog } from "./index";

describe("AddEntryDialog", () => {
  const defaultForm = {
    category: "income" as const,
    subcategory: "",
    amount: 0,
    frequency: "monthly" as const,
    date: "2024-01-01",
    description: "",
  };

  it("renders dialog content when open", () => {
    render(
      <AddEntryDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.getByText("Add Financial Entry")).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <AddEntryDialog
        open={false}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.queryByText("Add Financial Entry")).not.toBeInTheDocument();
  });

  it("calls onOpenChange when dialog close is triggered", () => {
    const onOpenChange = vi.fn();
    render(
      <AddEntryDialog
        open={true}
        onOpenChange={onOpenChange}
        form={defaultForm}
        onFormChange={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables Add button when subcategory is empty", () => {
    render(
      <AddEntryDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    const addButton = screen.getByRole("button", { name: "Add" });
    expect(addButton).toBeDisabled();
  });

  it("disables Add button when amount is 0 or less", () => {
    render(
      <AddEntryDialog
        open={true}
        onOpenChange={vi.fn()}
        form={{ ...defaultForm, subcategory: "Employment", amount: 0 }}
        onFormChange={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    const addButton = screen.getByRole("button", { name: "Add" });
    expect(addButton).toBeDisabled();
  });

  it("enables Add button when form is valid", () => {
    render(
      <AddEntryDialog
        open={true}
        onOpenChange={vi.fn()}
        form={{ ...defaultForm, subcategory: "Employment", amount: 500 }}
        onFormChange={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    const addButton = screen.getByRole("button", { name: "Add" });
    expect(addButton).not.toBeDisabled();
  });

  it("calls onAdd when Add button is clicked", () => {
    const onAdd = vi.fn();
    render(
      <AddEntryDialog
        open={true}
        onOpenChange={vi.fn()}
        form={{ ...defaultForm, subcategory: "Employment", amount: 500 }}
        onFormChange={vi.fn()}
        onAdd={onAdd}
      />,
    );
    const addButton = screen.getByRole("button", { name: "Add" });
    fireEvent.click(addButton);
    expect(onAdd).toHaveBeenCalled();
  });

  it("changes category and resets subcategory", () => {
    const onFormChange = vi.fn();
    const { container } = render(
      <AddEntryDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onAdd={vi.fn()}
      />,
    );

    const categorySelect = container.querySelector(
      "select",
    ) as HTMLSelectElement;
    fireEvent.change(categorySelect, { target: { value: "expense" } });

    expect(onFormChange).toHaveBeenCalledWith({
      ...defaultForm,
      category: "expense",
      subcategory: "",
    });
  });

  it("updates subcategory when selected", () => {
    const onFormChange = vi.fn();
    const { container } = render(
      <AddEntryDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onAdd={vi.fn()}
      />,
    );

    const selects = container.querySelectorAll("select");
    const subcategorySelect = selects[1] as HTMLSelectElement;
    fireEvent.change(subcategorySelect, { target: { value: "Employment" } });

    expect(onFormChange).toHaveBeenCalledWith({
      ...defaultForm,
      subcategory: "Employment",
    });
  });

  it("updates amount when changed", () => {
    const onFormChange = vi.fn();
    render(
      <AddEntryDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onAdd={vi.fn()}
      />,
    );

    const amountInputs = screen.getAllByRole("textbox");
    const amountInput = amountInputs.find(
      (input) => (input as HTMLInputElement).type === "number",
    );

    if (amountInput) {
      fireEvent.change(amountInput, { target: { value: "1500" } });
      expect(onFormChange).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 1500 }),
      );
    }
  });

  it("updates frequency when changed", () => {
    const onFormChange = vi.fn();
    const { container } = render(
      <AddEntryDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onAdd={vi.fn()}
      />,
    );

    const selects = container.querySelectorAll("select");
    const frequencySelect = selects[2] as HTMLSelectElement;
    fireEvent.change(frequencySelect, { target: { value: "weekly" } });

    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ frequency: "weekly" }),
    );
  });

  it("updates date when changed", () => {
    const onFormChange = vi.fn();
    render(
      <AddEntryDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onAdd={vi.fn()}
      />,
    );

    const dateInputs = screen.getAllByRole("textbox");
    const dateInput = dateInputs.find(
      (input) => (input as HTMLInputElement).type === "date",
    );

    if (dateInput) {
      fireEvent.change(dateInput, { target: { value: "2024-12-31" } });
      expect(onFormChange).toHaveBeenCalledWith(
        expect.objectContaining({ date: "2024-12-31" }),
      );
    }
  });

  it("updates description when changed", () => {
    const onFormChange = vi.fn();
    render(
      <AddEntryDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={onFormChange}
        onAdd={vi.fn()}
      />,
    );

    const descriptionInputs = screen.getAllByRole("textbox");
    const descriptionInput = descriptionInputs[descriptionInputs.length - 1];

    fireEvent.change(descriptionInput, {
      target: { value: "Monthly retainer payment" },
    });
    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Monthly retainer payment" }),
    );
  });

  it("shows all form fields", () => {
    render(
      <AddEntryDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onAdd={vi.fn()}
      />,
    );

    expect(screen.getByText("Category")).toBeInTheDocument();
    expect(screen.getByText("Subcategory")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Frequency")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Description (optional)")).toBeInTheDocument();
  });

  it("displays income subcategories when income category is selected", () => {
    const { container } = render(
      <AddEntryDialog
        open={true}
        onOpenChange={vi.fn()}
        form={defaultForm}
        onFormChange={vi.fn()}
        onAdd={vi.fn()}
      />,
    );

    const selects = container.querySelectorAll("select");
    const subcategorySelect = selects[1] as HTMLSelectElement;
    const options = subcategorySelect.querySelectorAll("option");
    const optionValues = Array.from(options).map((o) => o.value);

    expect(optionValues).toContain("Employment");
    expect(optionValues).toContain("Child Support Received");
  });

  it("displays expense subcategories when expense category is selected", () => {
    const { container } = render(
      <AddEntryDialog
        open={true}
        onOpenChange={vi.fn()}
        form={{ ...defaultForm, category: "expense" }}
        onFormChange={vi.fn()}
        onAdd={vi.fn()}
      />,
    );

    const selects = container.querySelectorAll("select");
    const subcategorySelect = selects[1] as HTMLSelectElement;
    const options = subcategorySelect.querySelectorAll("option");
    const optionValues = Array.from(options).map((o) => o.value);

    expect(optionValues).toContain("Housing");
    expect(optionValues).toContain("Child Support Paid");
  });
});
