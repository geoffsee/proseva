import { render, screen } from "../../../test-utils";
import { describe, it, expect, vi } from "vitest";
import { PartiesTab } from "./index";

const parties = [
  { id: "1", name: "John Doe", role: "Plaintiff", contact: "john@test.com" },
];

describe("PartiesTab", () => {
  it("renders existing parties", () => {
    render(
      <PartiesTab
        parties={parties}
        onAddParty={vi.fn()}
        onRemoveParty={vi.fn()}
      />,
    );
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText(/Plaintiff/)).toBeInTheDocument();
  });

  it("renders add party form", () => {
    render(
      <PartiesTab parties={[]} onAddParty={vi.fn()} onRemoveParty={vi.fn()} />,
    );
    expect(screen.getAllByText("Add Party")[0]).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
  });
});
