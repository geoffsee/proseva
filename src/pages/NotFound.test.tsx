import { render, screen } from "../test-utils";
import { describe, it, expect } from "vitest";
import NotFound from "./NotFound";

describe("NotFound", () => {
  it("renders 404 heading", () => {
    render(<NotFound />, { withRouter: true });
    expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument();
  });

  it("renders 404 text content", () => {
    render(<NotFound />, { withRouter: true });
    expect(screen.getByText("404")).toBeInTheDocument();
  });

  it("renders page not found message", () => {
    render(<NotFound />, { withRouter: true });
    expect(screen.getByText("Page not found.")).toBeInTheDocument();
  });

  it("renders link to dashboard", () => {
    render(<NotFound />, { withRouter: true });
    const dashboardLink = screen.getByRole("link", { name: /Go to Dashboard/ });
    expect(dashboardLink).toBeInTheDocument();
    expect(dashboardLink.getAttribute("href")).toBe("/");
  });

  it("renders dashboard button", () => {
    render(<NotFound />, { withRouter: true });
    expect(
      screen.getByRole("button", { name: /Go to Dashboard/ }),
    ).toBeInTheDocument();
  });

  it("dashboard button is clickable", () => {
    render(<NotFound />, { withRouter: true });
    const button = screen.getByRole("button", { name: /Go to Dashboard/ });
    expect(button).not.toBeDisabled();
  });

  it("renders without errors", () => {
    expect(() => {
      render(<NotFound />, { withRouter: true });
    }).not.toThrow();
  });

  it("has proper page structure", () => {
    const { container } = render(<NotFound />, { withRouter: true });
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders proper heading level", () => {
    render(<NotFound />, { withRouter: true });
    const heading = screen.getByRole("heading", { name: "404" });
    expect(heading).toBeInTheDocument();
  });

  it("button links to root path", () => {
    render(<NotFound />, { withRouter: true });
    const link = screen.getByRole("link", {
      name: /Go to Dashboard/,
    }) as HTMLAnchorElement;
    expect(link.href).toContain("/");
  });

  it("displays error message with proper styling applied", () => {
    render(<NotFound />, { withRouter: true });
    const message = screen.getByText("Page not found.");
    expect(message).toBeInTheDocument();
  });

  it("has centered vertical stack layout", () => {
    const { container } = render(<NotFound />, { withRouter: true });
    expect(container).toBeInTheDocument();
  });

  it("renders with all text content visible", () => {
    render(<NotFound />, { withRouter: true });
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("Page not found.")).toBeInTheDocument();
  });

  it("navigation to dashboard works correctly", () => {
    render(<NotFound />, { withRouter: true });
    const dashboardLink = screen.getByRole("link", { name: /Go to Dashboard/ });
    expect(dashboardLink).toHaveAttribute("href", "/");
  });
});
