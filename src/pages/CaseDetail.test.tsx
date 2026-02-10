import { render, screen, fireEvent } from "../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import CaseDetail from "./CaseDetail";
import { useStore } from "../store/StoreContext";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ id: "case-1" }),
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../store/StoreContext", () => ({
  useStore: vi.fn(() => ({
    caseStore: {
      cases: [
        {
          id: "case-1",
          name: "Smith v. Jones",
          caseNumber: "2024-CV-001",
          court: "District Court",
          caseType: "Civil",
          status: "active",
          parties: [{ id: "p1", name: "John Smith", role: "plaintiff" }],
          filings: [
            { id: "f1", title: "Motion to Dismiss", date: "2024-01-15" },
          ],
          notes: "Test case",
        },
      ],
      updateCase: vi.fn(),
      deleteCase: vi.fn(),
      addParty: vi.fn(),
      removeParty: vi.fn(),
      addFiling: vi.fn(),
      removeFiling: vi.fn(),
    },
  })),
}));

describe("CaseDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  it("renders case name as heading", () => {
    renderWithRouter(<CaseDetail />);
    expect(
      screen.getByRole("heading", { name: "Smith v. Jones" }),
    ).toBeInTheDocument();
  });

  it("displays case status badge", () => {
    renderWithRouter(<CaseDetail />);
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("shows case information", () => {
    renderWithRouter(<CaseDetail />);
    expect(screen.getByText(/Case #:/)).toBeInTheDocument();
    expect(screen.getByText(/2024-CV-001/)).toBeInTheDocument();
  });

  it("renders buttons", () => {
    renderWithRouter(<CaseDetail />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("displays tab navigation", () => {
    renderWithRouter(<CaseDetail />);
    expect(screen.getByText(/Details/i)).toBeInTheDocument();
    expect(screen.getByText(/Parties/i)).toBeInTheDocument();
    expect(screen.getByText(/Filings/i)).toBeInTheDocument();
  });

  it("shows parties count in tab", () => {
    renderWithRouter(<CaseDetail />);
    expect(screen.getByText(/Parties \(1\)/)).toBeInTheDocument();
  });

  it("shows filings count in tab", () => {
    renderWithRouter(<CaseDetail />);
    expect(screen.getByText(/Filings \(1\)/)).toBeInTheDocument();
  });

  it("shows case not found message when case does not exist", () => {
    vi.mocked(useStore).mockReturnValue({
      caseStore: {
        cases: [],
        updateCase: vi.fn(),
        deleteCase: vi.fn(),
        addParty: vi.fn(),
        removeParty: vi.fn(),
        addFiling: vi.fn(),
        removeFiling: vi.fn(),
      },
    } as any);
    renderWithRouter(<CaseDetail />);
    expect(screen.getByText("Case not found.")).toBeInTheDocument();
  });

  it("back button on not found page navigates to cases", () => {
    vi.mocked(useStore).mockReturnValue({
      caseStore: {
        cases: [],
        updateCase: vi.fn(),
        deleteCase: vi.fn(),
        addParty: vi.fn(),
        removeParty: vi.fn(),
        addFiling: vi.fn(),
        removeFiling: vi.fn(),
      },
    } as any);
    renderWithRouter(<CaseDetail />);
    fireEvent.click(screen.getByRole("button", { name: /Back to Cases/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/cases");
  });
});
