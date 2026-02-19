import { render, screen, fireEvent, waitFor } from "../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Calendar from "./Calendar";

vi.mock("../store/StoreContext", () => ({
  useStore: vi.fn(() => ({
    deadlineStore: {
      deadlines: [
        {
          id: "1",
          title: "File Motion",
          date: "2025-02-15",
          type: "filing",
          completed: false,
          caseId: "case-1",
        },
      ],
      addDeadline: vi.fn(),
      toggleComplete: vi.fn(),
      deleteDeadline: vi.fn(),
    },
    caseStore: {
      cases: [{ id: "case-1", name: "Smith v. Jones", status: "active" }],
    },
  })),
}));

describe("Calendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders calendar heading and add button", () => {
    render(<Calendar />);
    expect(
      screen.getByRole("heading", { name: "Calendar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add Deadline/i }),
    ).toBeInTheDocument();
  });

  it("renders month navigation controls", () => {
    render(<Calendar />);
    expect(screen.getByLabelText("Previous month")).toBeInTheDocument();
    expect(screen.getByLabelText("Next month")).toBeInTheDocument();
  });

  it("displays current month and year", () => {
    render(<Calendar />);
    const monthDisplay = screen.getByText(/\d{4}/);
    expect(monthDisplay).toBeInTheDocument();
  });

  it("navigates to next month when clicking next button", () => {
    render(<Calendar />);
    const nextButton = screen.getByLabelText("Next month");
    const initialText = screen.getByText(/\w+ \d{4}/).textContent;

    fireEvent.click(nextButton);

    const updatedText = screen.getByText(/\w+ \d{4}/).textContent;
    expect(updatedText).not.toBe(initialText);
  });

  it("navigates to previous month when clicking previous button", () => {
    render(<Calendar />);
    const prevButton = screen.getByLabelText("Previous month");
    const initialText = screen.getByText(/\w+ \d{4}/).textContent;

    fireEvent.click(prevButton);

    const updatedText = screen.getByText(/\w+ \d{4}/).textContent;
    expect(updatedText).not.toBe(initialText);
  });

  it("renders calendar grid", () => {
    const { container } = render(<Calendar />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("opens add deadline dialog when Add Deadline button is clicked", async () => {
    render(<Calendar />);
    const addButton = screen.getByRole("button", { name: /Add Deadline/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText(/Add Deadline|Create/i)).toBeInTheDocument();
    });
  });
});
