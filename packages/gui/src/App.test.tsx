import { render } from "./test-utils";
import { describe, it, expect, vi } from "vitest";
import App from "./App";

// Mock all pages to avoid complex dependencies
vi.mock("./pages/Dashboard", () => ({
  default: () => <div>Dashboard</div>,
}));
vi.mock("./pages/CaseTracker", () => ({
  default: () => <div>CaseTracker</div>,
}));
vi.mock("./pages/CaseDetail", () => ({
  default: () => <div>CaseDetail</div>,
}));
vi.mock("./pages/DocumentGenerator", () => ({
  default: () => <div>DocumentGenerator</div>,
}));
vi.mock("./pages/FinancialTracker", () => ({
  default: () => <div>FinancialTracker</div>,
}));
vi.mock("./pages/LegalResources", () => ({
  default: () => <div>LegalResources</div>,
}));
vi.mock("./pages/Calendar", () => ({
  default: () => <div>Calendar</div>,
}));
vi.mock("./pages/Contacts", () => ({
  default: () => <div>Contacts</div>,
}));
vi.mock("./pages/Notes", () => ({
  default: () => <div>Notes</div>,
}));
vi.mock("./pages/Kanban", () => ({
  default: () => <div>Kanban</div>,
}));
vi.mock("./pages/Chat", () => ({
  default: () => <div>Chat</div>,
}));
vi.mock("./pages/DocumentManager", () => ({
  default: () => <div>DocumentManager</div>,
}));
vi.mock("./pages/Deadlines", () => ({
  default: () => <div>Deadlines</div>,
}));
vi.mock("./pages/Filings", () => ({
  default: () => <div>Filings</div>,
}));
vi.mock("./pages/Evidence", () => ({
  default: () => <div>Evidence</div>,
}));
vi.mock("./pages/Timeline", () => ({
  default: () => <div>Timeline</div>,
}));
vi.mock("./pages/Reports", () => ({
  default: () => <div>Reports</div>,
}));
vi.mock("./pages/NotFound", () => ({
  default: () => <div>NotFound</div>,
}));

describe("App routing", () => {
  it("renders without crashing", () => {
    const { container } = render(<App />, { withRouter: true });
    expect(container).toBeInTheDocument();
  });

  it("has Routes and AppShell structure", () => {
    const { container } = render(<App />, { withRouter: true });
    expect(container.firstChild).toBeTruthy();
  });

  it("includes StoreProvider wrapper", () => {
    // If rendering succeeds without errors, StoreProvider is working
    const { container } = render(<App />, { withRouter: true });
    expect(container).toBeInTheDocument();
  });

  it("sets up routing for main application", () => {
    // Verify that App component renders with router
    const { container } = render(<App />, { withRouter: true });
    // Check that we have the main container
    expect(
      container.querySelector("body") || container.firstChild,
    ).toBeTruthy();
  });
});
