import { render, screen, fireEvent } from "../../../test-utils";
import { BeneficiaryList } from "./index";
import { vi, describe, it, expect } from "vitest";

const mockBeneficiaries = [
  {
    id: "1",
    name: "Jane Doe",
    relationship: "Spouse",
    phone: "555-0101",
    email: "jane@example.com",
  },
];

describe("BeneficiaryList", () => {
  it("renders empty state when no beneficiaries", () => {
    render(<BeneficiaryList beneficiaries={[]} onAdd={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByText("No beneficiaries yet")).toBeInTheDocument();
  });

  it("renders beneficiaries correctly", () => {
    render(<BeneficiaryList beneficiaries={mockBeneficiaries} onAdd={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Spouse")).toBeInTheDocument();
  });

  it("calls onAdd when Add button is clicked", () => {
    const onAdd = vi.fn();
    render(<BeneficiaryList beneficiaries={[]} onAdd={onAdd} onRemove={vi.fn()} />);

    const addButton = screen.getByRole("button", { name: "Add" });
    fireEvent.click(addButton);

    expect(onAdd).toHaveBeenCalled();
  });

  it("calls onRemove when remove button is clicked", () => {
    const onRemove = vi.fn();
    render(<BeneficiaryList beneficiaries={mockBeneficiaries} onAdd={vi.fn()} onRemove={onRemove} />);

    const removeButton = screen.getByRole("button", { name: "Remove beneficiary" });
    fireEvent.click(removeButton);

    expect(onRemove).toHaveBeenCalledWith("1");
  });
});
