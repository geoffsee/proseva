import { render, screen, fireEvent } from "../../../test-utils";
import { describe, it, expect, vi } from "vitest";
import { PartiesTab } from "./index";
import type { Party } from "../../../types";

describe("PartiesTab", () => {
  const mockParties: Party[] = [
    {
      id: "1",
      name: "John Smith",
      role: "Plaintiff",
      contact: "john@example.com",
    },
    {
      id: "2",
      name: "Jane Jones",
      role: "Defendant",
      contact: "jane@example.com",
    },
  ];

  it("renders all parties with correct information", () => {
    render(
      <PartiesTab
        parties={mockParties}
        onAddParty={vi.fn()}
        onRemoveParty={vi.fn()}
      />,
    );

    expect(screen.getByText("John Smith")).toBeInTheDocument();
    expect(screen.getByText("Jane Jones")).toBeInTheDocument();
    expect(screen.getByText(/Plaintiff.*john@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/Defendant.*jane@example.com/)).toBeInTheDocument();
  });

  it("displays empty list when no parties exist", () => {
    render(
      <PartiesTab parties={[]} onAddParty={vi.fn()} onRemoveParty={vi.fn()} />,
    );

    expect(screen.getByText("Add Party")).toBeInTheDocument();
  });

  it("calls onRemoveParty when delete button is clicked", () => {
    const onRemoveParty = vi.fn();
    render(
      <PartiesTab
        parties={mockParties}
        onAddParty={vi.fn()}
        onRemoveParty={onRemoveParty}
      />,
    );

    const deleteButtons = screen
      .getAllByRole("button")
      .filter((btn) => btn.querySelector("svg"));
    fireEvent.click(deleteButtons[0]);
    expect(onRemoveParty).toHaveBeenCalledWith("1");
  });

  it("updates party name input", () => {
    render(
      <PartiesTab parties={[]} onAddParty={vi.fn()} onRemoveParty={vi.fn()} />,
    );

    const inputs = screen.getAllByRole("textbox");
    const nameInput = inputs[0];
    fireEvent.change(nameInput, { target: { value: "Robert Brown" } });
    expect((nameInput as HTMLInputElement).value).toBe("Robert Brown");
  });

  it("updates party role input", () => {
    render(
      <PartiesTab parties={[]} onAddParty={vi.fn()} onRemoveParty={vi.fn()} />,
    );

    const inputs = screen.getAllByRole("textbox");
    const roleInput = inputs.find(
      (input) => (input as HTMLInputElement).placeholder === "Role",
    );
    if (roleInput) {
      fireEvent.change(roleInput, { target: { value: "Defendant" } });
      expect((roleInput as HTMLInputElement).value).toBe("Defendant");
    }
  });

  it("updates party contact input", () => {
    render(
      <PartiesTab parties={[]} onAddParty={vi.fn()} onRemoveParty={vi.fn()} />,
    );

    const inputs = screen.getAllByRole("textbox");
    const contactInput = inputs.find(
      (input) =>
        (input as HTMLInputElement).placeholder === "Contact (optional)",
    );
    if (contactInput) {
      fireEvent.change(contactInput, {
        target: { value: "robert@example.com" },
      });
      expect((contactInput as HTMLInputElement).value).toBe(
        "robert@example.com",
      );
    }
  });

  it("disables Add button when name or role is missing", () => {
    render(
      <PartiesTab parties={[]} onAddParty={vi.fn()} onRemoveParty={vi.fn()} />,
    );

    const addButton = screen.getByRole("button", { name: /Add/ });
    expect(addButton).toBeDisabled();
  });

  it("enables Add button when name and role are provided", () => {
    render(
      <PartiesTab parties={[]} onAddParty={vi.fn()} onRemoveParty={vi.fn()} />,
    );

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "Robert Brown" } });

    const roleInput = inputs.find(
      (input) => (input as HTMLInputElement).placeholder === "Role",
    );
    if (roleInput) {
      fireEvent.change(roleInput, { target: { value: "Defendant" } });
    }

    const addButton = screen.getByRole("button", { name: /Add/ });
    expect(addButton).not.toBeDisabled();
  });

  it("calls onAddParty with correct data", () => {
    const onAddParty = vi.fn();
    render(
      <PartiesTab
        parties={[]}
        onAddParty={onAddParty}
        onRemoveParty={vi.fn()}
      />,
    );

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "Michael Davis" } });

    const roleInput = inputs.find(
      (input) => (input as HTMLInputElement).placeholder === "Role",
    );
    if (roleInput) {
      fireEvent.change(roleInput, { target: { value: "Witness" } });
    }

    const contactInput = inputs.find(
      (input) =>
        (input as HTMLInputElement).placeholder === "Contact (optional)",
    );
    if (contactInput) {
      fireEvent.change(contactInput, {
        target: { value: "michael@example.com" },
      });
    }

    const addButton = screen.getByRole("button", { name: /Add/ });
    fireEvent.click(addButton);

    expect(onAddParty).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Michael Davis",
        role: "Witness",
        contact: "michael@example.com",
      }),
    );
  });

  it("clears form after adding party", () => {
    render(
      <PartiesTab parties={[]} onAddParty={vi.fn()} onRemoveParty={vi.fn()} />,
    );

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "Michael Davis" } });

    const roleInput = inputs.find(
      (input) => (input as HTMLInputElement).placeholder === "Role",
    );
    if (roleInput) {
      fireEvent.change(roleInput, { target: { value: "Witness" } });
    }

    const addButton = screen.getByRole("button", { name: /Add/ });
    fireEvent.click(addButton);

    expect((inputs[0] as HTMLInputElement).value).toBe("");
  });

  it("displays party without contact information", () => {
    const partyWithoutContact: Party = {
      id: "3",
      name: "Sarah Wilson",
      role: "Judge",
      contact: "",
    };
    render(
      <PartiesTab
        parties={[partyWithoutContact]}
        onAddParty={vi.fn()}
        onRemoveParty={vi.fn()}
      />,
    );

    expect(screen.getByText("Sarah Wilson")).toBeInTheDocument();
    expect(screen.getByText(/Judge$/)).toBeInTheDocument();
  });

  it("renders Add Party section", () => {
    render(
      <PartiesTab parties={[]} onAddParty={vi.fn()} onRemoveParty={vi.fn()} />,
    );

    expect(screen.getByText("Add Party")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Role")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Contact (optional)"),
    ).toBeInTheDocument();
  });

  it("handles multiple parties correctly", () => {
    const manyParties: Party[] = [
      { id: "1", name: "Party 1", role: "Role 1", contact: "contact1" },
      { id: "2", name: "Party 2", role: "Role 2", contact: "contact2" },
      { id: "3", name: "Party 3", role: "Role 3", contact: "contact3" },
    ];
    render(
      <PartiesTab
        parties={manyParties}
        onAddParty={vi.fn()}
        onRemoveParty={vi.fn()}
      />,
    );

    expect(screen.getByText("Party 1")).toBeInTheDocument();
    expect(screen.getByText("Party 2")).toBeInTheDocument();
    expect(screen.getByText("Party 3")).toBeInTheDocument();
  });

  it("removes specific party when delete is clicked", () => {
    const onRemoveParty = vi.fn();
    render(
      <PartiesTab
        parties={mockParties}
        onAddParty={vi.fn()}
        onRemoveParty={onRemoveParty}
      />,
    );

    const deleteButtons = screen
      .getAllByRole("button")
      .filter((btn) => btn.querySelector("svg"));
    fireEvent.click(deleteButtons[1]);
    expect(onRemoveParty).toHaveBeenCalledWith("2");
  });

  it("displays correct aria labels on delete buttons", () => {
    render(
      <PartiesTab
        parties={mockParties}
        onAddParty={vi.fn()}
        onRemoveParty={vi.fn()}
      />,
    );

    const deleteButtons = screen.getAllByLabelText("Remove party");
    expect(deleteButtons.length).toBe(2);
  });
});
