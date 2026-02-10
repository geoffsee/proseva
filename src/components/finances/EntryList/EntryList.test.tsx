import { render, screen } from "../../../test-utils";
import { describe, it, expect, vi } from "vitest";
import { EntryList } from "./index";

describe("EntryList", () => {
  it("renders entries", () => {
    const entries = [
      {
        id: "1",
        category: "income" as const,
        subcategory: "Employment",
        amount: 5000,
        frequency: "monthly" as const,
        date: "2024-06-01",
      },
    ];
    render(<EntryList entries={entries} onDelete={vi.fn()} />);
    expect(screen.getByText("Employment")).toBeInTheDocument();
    expect(screen.getByText(/5,000/)).toBeInTheDocument();
  });
});
