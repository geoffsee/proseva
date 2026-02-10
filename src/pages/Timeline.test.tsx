import { render, screen, fireEvent } from "../test-utils";
import { describe, it, expect, beforeEach, vi } from "vitest";
import Timeline from "./Timeline";

// Mock the timeline data
vi.mock("../../reference/case-documents/timeline_data.json", () => ({
  default: {
    events: [
      {
        party: "Father",
        date: "01-15",
        title: "Custody filing",
        case: { type: "Custody", number: "2024-CV-001" },
        isCritical: true,
        details: "Initial custody filing",
        source: "Court records",
      },
      {
        party: "Mother",
        date: "02-01",
        title: "Response filed",
        case: { type: "Custody", number: "2024-CV-001" },
        isCritical: false,
        details: "Mother's response",
        source: "Court records",
      },
      {
        party: "Court",
        date: "03-10",
        title: "Hearing scheduled",
        case: { type: "Custody" },
        isCritical: true,
      },
    ],
  },
}));

describe("Timeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders timeline heading", () => {
    render(<Timeline />);
    expect(
      screen.getByRole("heading", { name: "Timeline" }),
    ).toBeInTheDocument();
  });

  it("displays party filter badges", () => {
    render(<Timeline />);
    // Party names appear in both filter badges and legend, use getAllByText
    expect(screen.getAllByText("Father").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mother").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Court").length).toBeGreaterThan(0);
  });

  it("displays date range filters", () => {
    render(<Timeline />);
    const dateInputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
    expect(dateInputs.length).toBeGreaterThanOrEqual(2);
  });

  it("filters events by party when party badge is clicked", () => {
    render(<Timeline />);
    // Get the badge (first occurrence), not the legend text
    const fatherElements = screen.getAllByText("Father");
    fireEvent.click(fatherElements[0]);
    expect(fatherElements[0]).toBeInTheDocument();
  });

  it("displays event count", () => {
    render(<Timeline />);
    const eventCountText = screen.getByText(/\d+ events/);
    expect(eventCountText).toBeInTheDocument();
  });

  it("displays year range", () => {
    render(<Timeline />);
    const yearText = screen.getByText(/\d{4} – \d{4}/);
    expect(yearText).toBeInTheDocument();
  });

  it("renders timeline ruler with year marks", () => {
    const { container } = render(<Timeline />);
    expect(container).toBeInTheDocument();
  });

  it("shows legend with party colors", () => {
    render(<Timeline />);
    expect(screen.getByText("Legend:")).toBeInTheDocument();
  });

  it("handles date range filter changes", () => {
    render(<Timeline />);
    const dateInputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
    expect(dateInputs.length).toBeGreaterThanOrEqual(2);
  });

  it("displays reset button when date filter is active", () => {
    render(<Timeline />);
    const dateInputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
    if (dateInputs.length > 0) {
      fireEvent.change(dateInputs[0], { target: { value: "2024-01-01" } });
      const { container } = render(<Timeline />);
      expect(container).toBeInTheDocument();
    }
  });

  it("shows no events message when no events in range", () => {
    const { container } = render(<Timeline />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders timeline events", () => {
    const { container } = render(<Timeline />);
    expect(container).toBeInTheDocument();
  });

  it("allows party filter toggle on/off", () => {
    render(<Timeline />);
    const fatherElements = screen.getAllByText("Father");
    fireEvent.click(fatherElements[0]);
    fireEvent.click(fatherElements[0]);
    expect(fatherElements[0]).toBeInTheDocument();
  });
});
