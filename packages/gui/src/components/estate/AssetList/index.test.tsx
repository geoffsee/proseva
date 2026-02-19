import { render, screen, fireEvent } from "../../../test-utils";
import { AssetList } from "./index";
import { vi, describe, it, expect } from "vitest";

const mockAssets = [
  {
    id: "1",
    name: "Savings Account",
    category: "bank-account",
    estimatedValue: 10000,
    ownershipType: "Sole",
    institution: "Chase",
  },
  {
    id: "2",
    name: "Primary Residence",
    category: "real-property",
    estimatedValue: 500000,
    ownershipType: "Joint",
    institution: "N/A",
  },
];

describe("AssetList", () => {
  it("renders empty state when no assets", () => {
    render(<AssetList assets={[]} onAdd={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByText("No assets yet")).toBeInTheDocument();
  });

  it("renders assets correctly", () => {
    render(
      <AssetList assets={mockAssets} onAdd={vi.fn()} onRemove={vi.fn()} />,
    );

    expect(screen.getByText("Savings Account")).toBeInTheDocument();
    expect(screen.getByText("Primary Residence")).toBeInTheDocument();
    expect(screen.getByText("Total: $510,000.00")).toBeInTheDocument();
  });

  it("calls onAdd when Add button is clicked", () => {
    const onAdd = vi.fn();
    render(<AssetList assets={[]} onAdd={onAdd} onRemove={vi.fn()} />);

    const addButton = screen.getByRole("button", { name: "Add" });
    fireEvent.click(addButton);

    expect(onAdd).toHaveBeenCalled();
  });

  it("calls onRemove when remove button is clicked", () => {
    const onRemove = vi.fn();
    render(
      <AssetList assets={mockAssets} onAdd={vi.fn()} onRemove={onRemove} />,
    );

    const removeButtons = screen.getAllByRole("button", {
      name: "Remove asset",
    });
    fireEvent.click(removeButtons[0]);

    expect(onRemove).toHaveBeenCalledWith("1");
  });
});
