import { render, screen, fireEvent, waitFor } from "../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import FinancialTracker from "./FinancialTracker";
import { useStore } from "../store/StoreContext";

vi.mock("../store/StoreContext", () => ({
  useStore: vi.fn(() => ({
    financeStore: {
      entries: [
        {
          id: "1",
          category: "income",
          subcategory: "Case Settlement",
          amount: 5000,
          frequency: "one-time",
          date: "2024-01-15",
          description: "Settlement payment",
        },
        {
          id: "2",
          category: "expense",
          subcategory: "Court Fees",
          amount: 500,
          frequency: "monthly",
          date: "2024-01-10",
          description: "Filing fees",
        },
      ],
      addEntry: vi.fn(),
      deleteEntry: vi.fn(),
    },
  })),
}));

const defaultStore = {
  financeStore: {
    entries: [
      {
        id: "1",
        category: "income",
        subcategory: "Case Settlement",
        amount: 5000,
        frequency: "one-time",
        date: "2024-01-15",
        description: "Settlement payment",
      },
      {
        id: "2",
        category: "expense",
        subcategory: "Court Fees",
        amount: 500,
        frequency: "monthly",
        date: "2024-01-10",
        description: "Filing fees",
      },
    ],
    addEntry: vi.fn(),
    deleteEntry: vi.fn(),
  },
};

describe("FinancialTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useStore).mockReturnValue(defaultStore as any);
  });

  it("renders finances heading and add button", () => {
    render(<FinancialTracker />);
    expect(
      screen.getByRole("heading", { name: "Finances" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add Entry/i }),
    ).toBeInTheDocument();
  });

  it("displays stat cards with financial information", () => {
    render(<FinancialTracker />);
    expect(screen.getByText("Total Income")).toBeInTheDocument();
    expect(screen.getByText("Total Expenses")).toBeInTheDocument();
    expect(screen.getByText("Net")).toBeInTheDocument();
  });

  it("displays income and expense totals", () => {
    render(<FinancialTracker />);
    // $5,000 appears in both stat card and entry row, use getAllByText
    expect(screen.getAllByText(/\$5,000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$500/).length).toBeGreaterThan(0);
  });

  it("displays list of financial entries", () => {
    render(<FinancialTracker />);
    expect(screen.getByText("Case Settlement")).toBeInTheDocument();
    expect(screen.getByText("Court Fees")).toBeInTheDocument();
  });

  it("opens dialog when Add Entry button is clicked", async () => {
    render(<FinancialTracker />);
    fireEvent.click(screen.getByRole("button", { name: /Add Entry/i }));

    await waitFor(() => {
      expect(screen.getByText(/Add Entry|Edit/i)).toBeInTheDocument();
    });
  });

  it("shows empty state when no entries exist", () => {
    vi.mocked(useStore).mockReturnValue({
      financeStore: {
        entries: [],
        addEntry: vi.fn(),
        deleteEntry: vi.fn(),
      },
    } as any);
    render(<FinancialTracker />);
    expect(screen.getByText("No entries yet")).toBeInTheDocument();
  });

  it("calculates and displays net balance", () => {
    render(<FinancialTracker />);
    // Net value is in the stat card
    const netStat = screen.getByText("Net").parentElement;
    expect(netStat?.textContent).toMatch(/4,500/);
  });

  it("displays correct currency format", () => {
    render(<FinancialTracker />);
    const incomeText = screen.getByText("Total Income").parentElement;
    expect(incomeText?.textContent).toMatch(/\$/);
  });

  it("calls deleteEntry when delete button is clicked", () => {
    const deleteEntry = vi.fn();
    vi.mocked(useStore).mockReturnValue({
      financeStore: {
        entries: [
          {
            id: "1",
            category: "income",
            subcategory: "Case Settlement",
            amount: 5000,
            frequency: "one-time",
            date: "2024-01-15",
            description: "Settlement payment",
          },
        ],
        addEntry: vi.fn(),
        deleteEntry,
      },
    } as any);

    render(<FinancialTracker />);
    fireEvent.click(screen.getAllByLabelText("Delete")[0]);
    expect(deleteEntry).toHaveBeenCalledWith("1");
  });

  it("closes dialog when Cancel is clicked", async () => {
    render(<FinancialTracker />);
    fireEvent.click(screen.getByRole("button", { name: /Add Entry/i }));
    await waitFor(() => {
      expect(screen.getByText("Add Entry")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Cancel" }),
      ).not.toBeInTheDocument();
    });
  });
});
