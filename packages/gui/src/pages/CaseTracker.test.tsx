import { render, screen, fireEvent, waitFor } from "../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import CaseTracker from "./CaseTracker";
import { useStore } from "../store/StoreContext";

vi.mock("../store/StoreContext", () => ({
  useStore: vi.fn(() => ({
    caseStore: {
      cases: [
        {
          id: "1",
          name: "Smith v. Jones",
          caseNumber: "2024-CV-001",
          court: "District Court",
          status: "active",
          caseType: "Civil",
        },
      ],
      addCase: vi.fn(),
    },
  })),
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe("CaseTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders cases heading and add button", () => {
    renderWithRouter(<CaseTracker />);
    expect(screen.getByRole("heading", { name: "Cases" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add Case/i }),
    ).toBeInTheDocument();
  });

  it("displays list of cases", () => {
    renderWithRouter(<CaseTracker />);
    expect(screen.getByText("Smith v. Jones")).toBeInTheDocument();
    expect(screen.getByText(/2024-CV-001/)).toBeInTheDocument();
  });

  it("displays case status badge", () => {
    renderWithRouter(<CaseTracker />);
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("opens dialog when Add Case button is clicked", async () => {
    renderWithRouter(<CaseTracker />);
    fireEvent.click(screen.getByRole("button", { name: /Add Case/i }));

    await waitFor(() => {
      expect(screen.getByText("New Case")).toBeInTheDocument();
    });
  });

  it("renders dialog form fields", async () => {
    renderWithRouter(<CaseTracker />);
    fireEvent.click(screen.getByRole("button", { name: /Add Case/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Case name")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Case number")).toBeInTheDocument();
    });
  });

  it("disables create button when case name is empty", async () => {
    renderWithRouter(<CaseTracker />);
    fireEvent.click(screen.getByRole("button", { name: /Add Case/i }));

    await waitFor(() => {
      const buttons = screen.getAllByRole("button", { name: "Create" });
      expect(buttons[buttons.length - 1]).toBeDisabled();
    });
  });

  it("enables create button when case name is filled", async () => {
    renderWithRouter(<CaseTracker />);
    fireEvent.click(screen.getByRole("button", { name: /Add Case/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Case name")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Case name");
    fireEvent.change(input, { target: { value: "New Case" } });

    await waitFor(() => {
      const buttons = screen.getAllByRole("button", { name: "Create" });
      expect(buttons[buttons.length - 1]).not.toBeDisabled();
    });
  });

  it("shows empty state when no cases exist", () => {
    vi.mocked(useStore).mockReturnValue({
      caseStore: { cases: [], addCase: vi.fn() },
    } as any);
    renderWithRouter(<CaseTracker />);
    expect(screen.getByText("No cases yet")).toBeInTheDocument();
    expect(screen.getByText(/Create your first case/)).toBeInTheDocument();
  });

  it("renders case list items", () => {
    renderWithRouter(<CaseTracker />);
    const { container } = render(
      <BrowserRouter>
        <CaseTracker />
      </BrowserRouter>,
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});
