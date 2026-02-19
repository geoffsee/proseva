import { render, screen } from "../../../test-utils";
import { describe, it, expect, vi } from "vitest";
import { DayDetail } from "./index";

describe("DayDetail", () => {
  it("shows no deadlines message when empty", () => {
    render(
      <DayDetail
        selectedDate="2024-06-15"
        deadlines={[]}
        onAdd={vi.fn()}
        onToggleComplete={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("No deadlines on this date.")).toBeInTheDocument();
  });

  it("renders deadlines for the selected date", () => {
    const deadlines = [
      {
        id: "1",
        title: "File motion",
        date: "2024-06-15",
        type: "filing" as const,
        completed: false,
      },
    ];
    render(
      <DayDetail
        selectedDate="2024-06-15"
        deadlines={deadlines}
        onAdd={vi.fn()}
        onToggleComplete={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("File motion")).toBeInTheDocument();
  });
});
