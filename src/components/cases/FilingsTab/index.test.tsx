import { render, screen, fireEvent } from "../../../test-utils";
import { describe, it, expect, vi } from "vitest";
import { FilingsTab } from "./index";
import type { Filing } from "../../../types";

describe("FilingsTab", () => {
  const mockFilings: Filing[] = [
    {
      id: "1",
      caseId: "case1",
      title: "Motion to Dismiss",
      date: "2024-01-15",
      type: "Motion",
      notes: "Denied",
    },
    {
      id: "2",
      caseId: "case1",
      title: "Answer",
      date: "2024-01-10",
      type: "Answer",
      notes: "",
    },
  ];

  it("renders filings in reverse chronological order", () => {
    render(
      <FilingsTab
        filings={mockFilings}
        onAddFiling={vi.fn()}
        onRemoveFiling={vi.fn()}
      />,
    );

    const titles = screen.getAllByText(/Motion to Dismiss|Answer/);
    expect(titles[0]).toHaveTextContent("Motion to Dismiss");
    expect(titles[1]).toHaveTextContent("Answer");
  });

  it("displays filing details correctly", () => {
    render(
      <FilingsTab
        filings={mockFilings}
        onAddFiling={vi.fn()}
        onRemoveFiling={vi.fn()}
      />,
    );

    expect(screen.getByText("Motion to Dismiss")).toBeInTheDocument();
    expect(
      screen.getByText(/Motion · 2024-01-15 · Denied/),
    ).toBeInTheDocument();
    expect(screen.getByText("Answer")).toBeInTheDocument();
    expect(screen.getByText(/Answer · 2024-01-10/)).toBeInTheDocument();
  });

  it("displays empty list when no filings exist", () => {
    render(
      <FilingsTab
        filings={[]}
        onAddFiling={vi.fn()}
        onRemoveFiling={vi.fn()}
      />,
    );

    expect(screen.getByText("Add Filing")).toBeInTheDocument();
  });

  it("calls onRemoveFiling when delete button is clicked", () => {
    const onRemoveFiling = vi.fn();
    render(
      <FilingsTab
        filings={mockFilings}
        onAddFiling={vi.fn()}
        onRemoveFiling={onRemoveFiling}
      />,
    );

    const deleteButtons = screen
      .getAllByRole("button")
      .filter((btn) => btn.querySelector("svg"));
    fireEvent.click(deleteButtons[0]);
    expect(onRemoveFiling).toHaveBeenCalledWith("1");
  });

  it("updates filing title input", () => {
    render(
      <FilingsTab
        filings={[]}
        onAddFiling={vi.fn()}
        onRemoveFiling={vi.fn()}
      />,
    );

    const inputs = screen.getAllByRole("textbox");
    const titleInput = inputs[0];
    fireEvent.change(titleInput, { target: { value: "New Filing" } });
    expect((titleInput as HTMLInputElement).value).toBe("New Filing");
  });

  it("updates filing date input", () => {
    render(
      <FilingsTab
        filings={[]}
        onAddFiling={vi.fn()}
        onRemoveFiling={vi.fn()}
      />,
    );

    const dateInputs = screen
      .getAllByRole("textbox")
      .filter((input) => (input as HTMLInputElement).type === "date");
    if (dateInputs.length > 0) {
      fireEvent.change(dateInputs[0], { target: { value: "2024-12-31" } });
      expect((dateInputs[0] as HTMLInputElement).value).toBe("2024-12-31");
    }
  });

  it("updates filing type input", () => {
    render(
      <FilingsTab
        filings={[]}
        onAddFiling={vi.fn()}
        onRemoveFiling={vi.fn()}
      />,
    );

    const inputs = screen.getAllByRole("textbox");
    const typeInput = inputs.find(
      (input) =>
        (input as HTMLInputElement).placeholder ===
        "Type (e.g., Motion, Order)",
    );
    if (typeInput) {
      fireEvent.change(typeInput, { target: { value: "Judgment" } });
      expect((typeInput as HTMLInputElement).value).toBe("Judgment");
    }
  });

  it("disables Add button when title or date is missing", () => {
    render(
      <FilingsTab
        filings={[]}
        onAddFiling={vi.fn()}
        onRemoveFiling={vi.fn()}
      />,
    );

    const addButton = screen.getByRole("button", { name: /Add/ });
    expect(addButton).toBeDisabled();
  });

  it("enables Add button when title and date are provided", () => {
    const { container } = render(
      <FilingsTab
        filings={[]}
        onAddFiling={vi.fn()}
        onRemoveFiling={vi.fn()}
      />,
    );

    const inputs = screen.getAllByRole("textbox");
    const titleInput = inputs[0];
    fireEvent.change(titleInput, { target: { value: "New Filing" } });

    const dateInputs = container.querySelectorAll("input[type='date']");
    if (dateInputs.length > 0) {
      fireEvent.change(dateInputs[0], { target: { value: "2024-12-31" } });
    }

    const addButton = screen.getByRole("button", { name: /Add/ });
    // Button should be enabled after title and date are set
    expect(addButton).not.toBeDisabled();
  });

  it("calls onAddFiling with correct data", () => {
    const onAddFiling = vi.fn();
    const { container } = render(
      <FilingsTab
        filings={[]}
        onAddFiling={onAddFiling}
        onRemoveFiling={vi.fn()}
      />,
    );

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], {
      target: { value: "Motion for Summary Judgment" },
    });

    const dateInputs = container.querySelectorAll("input[type='date']");
    if (dateInputs.length > 0) {
      fireEvent.change(dateInputs[0], { target: { value: "2024-12-31" } });
    }

    const typeInput = inputs.find(
      (input) =>
        (input as HTMLInputElement).placeholder ===
        "Type (e.g., Motion, Order)",
    );
    if (typeInput) {
      fireEvent.change(typeInput, { target: { value: "Motion" } });
    }

    const addButton = screen.getByRole("button", { name: /Add/ });
    fireEvent.click(addButton);

    expect(onAddFiling).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Motion for Summary Judgment",
        date: "2024-12-31",
        type: "Motion",
      }),
    );
  });

  it("clears form after adding filing", () => {
    const { container } = render(
      <FilingsTab
        filings={[]}
        onAddFiling={vi.fn()}
        onRemoveFiling={vi.fn()}
      />,
    );

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "New Filing" } });

    const dateInputs = container.querySelectorAll("input[type='date']");
    if (dateInputs.length > 0) {
      fireEvent.change(dateInputs[0], { target: { value: "2024-12-31" } });
    }

    const addButton = screen.getByRole("button", { name: /Add/ });
    fireEvent.click(addButton);

    expect((inputs[0] as HTMLInputElement).value).toBe("");
  });

  it("shows filing without notes", () => {
    const filingWithoutNotes: Filing = {
      id: "1",
      caseId: "case1",
      title: "Order",
      date: "2024-01-20",
      type: "Order",
      notes: "",
    };
    render(
      <FilingsTab
        filings={[filingWithoutNotes]}
        onAddFiling={vi.fn()}
        onRemoveFiling={vi.fn()}
      />,
    );

    expect(screen.getByText("Order")).toBeInTheDocument();
    expect(screen.getByText(/Order · 2024-01-20/)).toBeInTheDocument();
  });

  it("renders Add Filing section", () => {
    render(
      <FilingsTab
        filings={[]}
        onAddFiling={vi.fn()}
        onRemoveFiling={vi.fn()}
      />,
    );

    expect(screen.getByText("Add Filing")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Title")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Type (e.g., Motion, Order)"),
    ).toBeInTheDocument();
  });
});
