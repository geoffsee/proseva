import { render, screen } from "../../../test-utils";
import { describe, it, expect, vi } from "vitest";
import { FilingsTab } from "./index";

const filings = [
  {
    id: "1",
    title: "Motion to Dismiss",
    date: "2024-06-01",
    type: "Motion",
    notes: "",
  },
];

describe("FilingsTab", () => {
  it("renders existing filings", () => {
    render(
      <FilingsTab
        filings={filings}
        onAddFiling={vi.fn()}
        onRemoveFiling={vi.fn()}
      />,
    );
    expect(screen.getByText("Motion to Dismiss")).toBeInTheDocument();
  });

  it("renders add filing form", () => {
    render(
      <FilingsTab
        filings={[]}
        onAddFiling={vi.fn()}
        onRemoveFiling={vi.fn()}
      />,
    );
    expect(screen.getAllByText("Add Filing")[0]).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Title")).toBeInTheDocument();
  });
});
