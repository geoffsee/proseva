import { render, screen, fireEvent } from "../../../test-utils";
import { describe, it, expect, vi } from "vitest";
import { CalendarGrid } from "./index";

describe("CalendarGrid", () => {
  it("renders day headers", () => {
    render(
      <CalendarGrid
        currentMonth={new Date(2024, 5, 1)}
        deadlines={[]}
        onSelectDate={vi.fn()}
      />,
    );
    expect(screen.getByText("Sun")).toBeInTheDocument();
    expect(screen.getByText("Sat")).toBeInTheDocument();
  });

  it("renders days of the month", () => {
    render(
      <CalendarGrid
        currentMonth={new Date(2024, 5, 1)}
        deadlines={[]}
        onSelectDate={vi.fn()}
      />,
    );
    expect(screen.getAllByText("1")[0]).toBeInTheDocument();
    expect(screen.getAllByText("30")[0]).toBeInTheDocument();
  });

  it("calls onSelectDate when a day is clicked", () => {
    const onSelect = vi.fn();
    render(
      <CalendarGrid
        currentMonth={new Date(2024, 5, 1)}
        deadlines={[]}
        onSelectDate={onSelect}
      />,
    );
    fireEvent.click(screen.getAllByText("15")[0]);
    expect(onSelect).toHaveBeenCalledWith("2024-06-15");
  });
});
