import { render, screen, fireEvent } from "../../../test-utils";
import { describe, it, expect, vi } from "vitest";
import { AddDeadlineDialog } from "./index";
import type { Deadline } from "../../../types";

const defaultForm: Omit<Deadline, "id"> = {
  title: "",
  date: "",
  type: "filing",
  completed: false,
};

const renderDialog = (overrides: Record<string, unknown> = {}) => {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    form: { ...defaultForm },
    onFormChange: vi.fn(),
    onAdd: vi.fn(),
    cases: [] as { id: string; name: string }[],
    ...overrides,
  };
  render(<AddDeadlineDialog {...(props as any)} />);
  return props;
};

describe("AddDeadlineDialog", () => {
  it("renders dialog content when open", () => {
    renderDialog();
    expect(screen.getByText("Add Deadline")).toBeInTheDocument();
  });

  it("calls onFormChange when title is typed", () => {
    const props = renderDialog();
    fireEvent.change(screen.getByPlaceholderText("Title"), {
      target: { value: "New deadline" },
    });
    expect(props.onFormChange).toHaveBeenCalledWith({
      ...defaultForm,
      title: "New deadline",
    });
  });

  it("calls onFormChange when date is changed", () => {
    const props = renderDialog({ form: { ...defaultForm, title: "Test" } });
    const dateInput = screen.getByDisplayValue("");
    fireEvent.change(dateInput, { target: { value: "2025-06-01" } });
    expect(props.onFormChange).toHaveBeenCalledWith({
      ...defaultForm,
      title: "Test",
      date: "2025-06-01",
    });
  });

  it("calls onFormChange when type is changed", () => {
    const props = renderDialog();
    fireEvent.change(screen.getByDisplayValue("Filing"), {
      target: { value: "hearing" },
    });
    expect(props.onFormChange).toHaveBeenCalledWith({
      ...defaultForm,
      type: "hearing",
    });
  });

  it("renders case selector when cases are provided", () => {
    renderDialog({ cases: [{ id: "c1", name: "Smith v. Jones" }] });
    expect(screen.getByText("Case (optional)")).toBeInTheDocument();
    expect(screen.getByText("Smith v. Jones")).toBeInTheDocument();
  });

  it("does not render case selector when cases is empty", () => {
    renderDialog();
    expect(screen.queryByText("Case (optional)")).not.toBeInTheDocument();
  });

  it("calls onFormChange when case is selected", () => {
    const props = renderDialog({
      cases: [{ id: "c1", name: "Smith v. Jones" }],
    });
    fireEvent.change(screen.getByDisplayValue("No case"), {
      target: { value: "c1" },
    });
    expect(props.onFormChange).toHaveBeenCalledWith({
      ...defaultForm,
      caseId: "c1",
    });
  });

  it("clears caseId when 'No case' is selected", () => {
    const props = renderDialog({
      form: { ...defaultForm, caseId: "c1" },
      cases: [{ id: "c1", name: "Smith v. Jones" }],
    });
    fireEvent.change(screen.getByDisplayValue("Smith v. Jones"), {
      target: { value: "" },
    });
    expect(props.onFormChange).toHaveBeenCalledWith({
      ...defaultForm,
      caseId: undefined,
    });
  });

  it("disables Add button when title is empty", () => {
    renderDialog({ form: { ...defaultForm, date: "2025-06-01" } });
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("disables Add button when date is empty", () => {
    renderDialog({ form: { ...defaultForm, title: "Test" } });
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("enables Add button when title and date are set", () => {
    renderDialog({
      form: { ...defaultForm, title: "Test", date: "2025-06-01" },
    });
    expect(screen.getByRole("button", { name: "Add" })).not.toBeDisabled();
  });

  it("calls onAdd when Add button is clicked", () => {
    const props = renderDialog({
      form: { ...defaultForm, title: "Test", date: "2025-06-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(props.onAdd).toHaveBeenCalled();
  });

  it("calls onOpenChange(false) when Cancel is clicked", () => {
    const props = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });
});
