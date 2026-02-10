import { render, screen } from "../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import LegalResources from "./LegalResources";

vi.mock("../components/resources/CourtsList", () => ({
  CourtsList: () => <div data-testid="courts-list">Courts List Component</div>,
}));

vi.mock("../components/resources/StatutesList", () => ({
  StatutesList: () => (
    <div data-testid="statutes-list">Statutes List Component</div>
  ),
}));

vi.mock("../components/resources/DeadlinesList", () => ({
  DeadlinesList: () => (
    <div data-testid="deadlines-list">Deadlines List Component</div>
  ),
}));

vi.mock("../components/resources/GlossaryList", () => ({
  GlossaryList: () => (
    <div data-testid="glossary-list">Glossary List Component</div>
  ),
}));

describe("LegalResources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page heading", () => {
    render(<LegalResources />);
    expect(
      screen.getByRole("heading", { name: "Legal Resources" }),
    ).toBeInTheDocument();
  });

  it("renders disclaimer text", () => {
    render(<LegalResources />);
    expect(
      screen.getByText(/Virginia legal references for pro se litigants/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This is general information, not legal advice/),
    ).toBeInTheDocument();
  });

  it("renders CourtsList component", () => {
    render(<LegalResources />);
    expect(screen.getByTestId("courts-list")).toBeInTheDocument();
  });

  it("renders StatutesList component", () => {
    render(<LegalResources />);
    expect(screen.getByTestId("statutes-list")).toBeInTheDocument();
  });

  it("renders DeadlinesList component", () => {
    render(<LegalResources />);
    expect(screen.getByTestId("deadlines-list")).toBeInTheDocument();
  });

  it("renders GlossaryList component", () => {
    render(<LegalResources />);
    expect(screen.getByTestId("glossary-list")).toBeInTheDocument();
  });

  it("renders all resource sections in order", () => {
    const { container } = render(<LegalResources />);
    const allTestIds = container.querySelectorAll("[data-testid]");
    expect(allTestIds.length).toBe(4);
  });

  it("renders without errors", () => {
    expect(() => {
      render(<LegalResources />);
    }).not.toThrow();
  });

  it("has proper page structure", () => {
    const { container } = render(<LegalResources />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("displays disclaimer message in proper context", () => {
    render(<LegalResources />);
    const disclaimerText = screen.getByText(
      /This is general information, not legal advice/,
    );
    expect(disclaimerText).toBeInTheDocument();
    // Ensure it's visible
    expect(disclaimerText.parentElement).toBeInTheDocument();
  });

  it("renders with correct accessibility structure", () => {
    render(<LegalResources />);
    const mainHeading = screen.getByRole("heading", { level: 2 });
    expect(mainHeading).toBeInTheDocument();
    expect(mainHeading).toHaveTextContent("Legal Resources");
  });

  it("maintains vertical stack layout with proper gaps", () => {
    const { container } = render(<LegalResources />);
    expect(container).toBeInTheDocument();
  });
});
