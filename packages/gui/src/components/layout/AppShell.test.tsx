import { render, screen } from "../../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppShell } from "./AppShell";
import { BrowserRouter } from "react-router-dom";

vi.mock("./Sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar</div>,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet">Outlet Content</div>,
  };
});

describe("AppShell layout component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders sidebar", () => {
    render(
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>,
    );
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });

  it("renders outlet for page content", () => {
    render(
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>,
    );
    expect(screen.getByTestId("outlet")).toBeInTheDocument();
  });

  it("creates layout structure with sidebar and content", () => {
    render(
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>,
    );
    // Verify both sidebar and outlet are rendered
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("outlet")).toBeInTheDocument();
  });

  it("creates responsive layout with main content area", () => {
    const { container } = render(
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>,
    );

    // Find the content box (second child after sidebar)
    const contentBox = container.querySelector(
      "[role='main'], [data-testid=\"outlet\"]",
    )?.parentElement;
    expect(contentBox).toBeInTheDocument();
  });

  it("renders properly without errors", () => {
    const { container } = render(
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>,
    );
    // Verify the component renders without errors
    expect(container.firstChild).toBeTruthy();
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("outlet")).toBeInTheDocument();
  });
});
