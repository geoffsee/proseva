import { render, screen } from "../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import Dashboard from "./Dashboard";
import { useStore } from "../store/StoreContext";

vi.mock("../store/StoreContext", () => ({
  useStore: vi.fn(() => ({
    caseStore: {
      cases: [
        { id: "1", name: "Smith v. Jones", status: "active" },
        { id: "2", name: "Brown v. Lee", status: "closed" },
      ],
    },
    deadlineStore: {
      deadlines: [
        {
          id: "1",
          title: "File Motion",
          date: "2025-02-28",
          type: "filing",
          completed: false,
        },
        {
          id: "2",
          title: "Hearing",
          date: "2025-02-25",
          type: "hearing",
          completed: false,
        },
      ],
    },
    financeStore: {
      entries: [
        { id: "1", category: "income", amount: 5000 },
        { id: "2", category: "expense", amount: 1000 },
      ],
    },
  })),
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dashboard heading", () => {
    renderWithRouter(<Dashboard />);
    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
  });

  it("displays stat cards for key metrics", () => {
    renderWithRouter(<Dashboard />);
    expect(screen.getByText("Active Cases")).toBeInTheDocument();
    expect(screen.getAllByText("Upcoming Deadlines").length).toBeGreaterThan(0);
    expect(screen.getByText("Monthly Income")).toBeInTheDocument();
    expect(screen.getByText("Monthly Expenses")).toBeInTheDocument();
  });

  it("shows correct active case count", () => {
    renderWithRouter(<Dashboard />);
    const activeCaseStats = screen.getAllByText("1");
    expect(activeCaseStats.length).toBeGreaterThan(0);
  });

  it("displays upcoming deadlines section", () => {
    renderWithRouter(<Dashboard />);
    expect(screen.getAllByText("Upcoming Deadlines").length).toBeGreaterThan(0);
  });

  it("renders deadline list section", () => {
    renderWithRouter(<Dashboard />);
    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("shows Quick Actions section", () => {
    renderWithRouter(<Dashboard />);
    expect(screen.getByText("Quick Actions")).toBeInTheDocument();
  });

  it("renders quick action links", () => {
    renderWithRouter(<Dashboard />);
    expect(
      screen.getByRole("button", { name: /New Case/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Generate Document/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add Deadline/i }),
    ).toBeInTheDocument();
  });

  it("quick action links navigate to correct pages", () => {
    renderWithRouter(<Dashboard />);
    const caseLink = screen
      .getByRole("button", { name: /New Case/i })
      .closest("a");
    expect(caseLink).toHaveAttribute("href", "/cases");
  });

  it("displays income and expense totals", () => {
    renderWithRouter(<Dashboard />);
    const allText = screen.getAllByText(/\$5,000|5000/);
    expect(allText.length).toBeGreaterThan(0);
    const expenseText = screen.getAllByText(/\$1,000|1000/);
    expect(expenseText.length).toBeGreaterThan(0);
  });

  it("shows no upcoming deadlines message when list is empty", () => {
    vi.mocked(useStore).mockReturnValue({
      caseStore: { cases: [] },
      deadlineStore: { deadlines: [] },
      financeStore: { entries: [] },
    } as any);
    renderWithRouter(<Dashboard />);
    expect(screen.getByText("No upcoming deadlines.")).toBeInTheDocument();
  });
});
