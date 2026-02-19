import { render, screen } from "../../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  useColorMode,
  ColorModeIcon,
  ColorModeButton,
  LightMode,
  DarkMode,
} from "./color-mode";

// Mock next-themes
vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: vi.fn(),
}));

import { useTheme } from "next-themes";

// Helper component to test hooks
function TestColorModeComponent() {
  const { colorMode, toggleColorMode, setColorMode } = useColorMode();
  return (
    <div>
      <div data-testid="color-mode">{colorMode}</div>
      <button onClick={toggleColorMode} data-testid="toggle-btn">
        Toggle
      </button>
      <button onClick={() => setColorMode("dark")} data-testid="set-dark-btn">
        Set Dark
      </button>
      <button onClick={() => setColorMode("light")} data-testid="set-light-btn">
        Set Light
      </button>
    </div>
  );
}

describe("color-mode utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useColorMode hook", () => {
    it("returns light mode when resolvedTheme is light", () => {
      vi.mocked(useTheme).mockReturnValue({
        resolvedTheme: "light",
        setTheme: vi.fn(),
        forcedTheme: undefined,
        theme: "light",
        themes: ["light", "dark"],
        systemTheme: "light",
      } as any);

      render(<TestColorModeComponent />);
      expect(screen.getByTestId("color-mode")).toHaveTextContent("light");
    });

    it("returns dark mode when resolvedTheme is dark", () => {
      vi.mocked(useTheme).mockReturnValue({
        resolvedTheme: "dark",
        setTheme: vi.fn(),
        forcedTheme: undefined,
        theme: "dark",
        themes: ["light", "dark"],
        systemTheme: "dark",
      } as any);

      render(<TestColorModeComponent />);
      expect(screen.getByTestId("color-mode")).toHaveTextContent("dark");
    });

    it("toggleColorMode calls setTheme with opposite theme", () => {
      const setTheme = vi.fn();
      vi.mocked(useTheme).mockReturnValue({
        resolvedTheme: "light",
        setTheme,
        forcedTheme: undefined,
        theme: "light",
        themes: ["light", "dark"],
        systemTheme: "light",
      } as any);

      render(<TestColorModeComponent />);
      screen.getByTestId("toggle-btn").click();
      expect(setTheme).toHaveBeenCalledWith("dark");
    });

    it("setColorMode delegates to setTheme", () => {
      const setTheme = vi.fn();
      vi.mocked(useTheme).mockReturnValue({
        resolvedTheme: "light",
        setTheme,
        forcedTheme: undefined,
        theme: "light",
        themes: ["light", "dark"],
        systemTheme: "light",
      } as any);

      render(<TestColorModeComponent />);
      screen.getByTestId("set-dark-btn").click();
      expect(setTheme).toHaveBeenCalledWith("dark");
    });

    it("uses forcedTheme when available", () => {
      vi.mocked(useTheme).mockReturnValue({
        resolvedTheme: "light",
        setTheme: vi.fn(),
        forcedTheme: "dark",
        theme: "dark",
        themes: ["light", "dark"],
        systemTheme: "light",
      } as any);

      render(<TestColorModeComponent />);
      expect(screen.getByTestId("color-mode")).toHaveTextContent("dark");
    });
  });

  describe("ColorModeIcon component", () => {
    it("renders sun icon in light mode", () => {
      vi.mocked(useTheme).mockReturnValue({
        resolvedTheme: "light",
        setTheme: vi.fn(),
        forcedTheme: undefined,
        theme: "light",
        themes: ["light", "dark"],
        systemTheme: "light",
      } as any);

      const { container } = render(<ColorModeIcon />);
      // Sun icon from react-icons/lu
      expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("renders moon icon in dark mode", () => {
      vi.mocked(useTheme).mockReturnValue({
        resolvedTheme: "dark",
        setTheme: vi.fn(),
        forcedTheme: undefined,
        theme: "dark",
        themes: ["light", "dark"],
        systemTheme: "dark",
      } as any);

      const { container } = render(<ColorModeIcon />);
      // Moon icon from react-icons/lu
      expect(container.querySelector("svg")).toBeInTheDocument();
    });
  });

  describe("ColorModeButton component", () => {
    it("renders button with correct aria-label", () => {
      vi.mocked(useTheme).mockReturnValue({
        resolvedTheme: "light",
        setTheme: vi.fn(),
        forcedTheme: undefined,
        theme: "light",
        themes: ["light", "dark"],
        systemTheme: "light",
      } as any);

      render(<ColorModeButton />);
      expect(
        screen.getByRole("button", { name: "Toggle color mode" }),
      ).toBeInTheDocument();
    });

    it("calls toggleColorMode when clicked", async () => {
      const setTheme = vi.fn();
      vi.mocked(useTheme).mockReturnValue({
        resolvedTheme: "light",
        setTheme,
        forcedTheme: undefined,
        theme: "light",
        themes: ["light", "dark"],
        systemTheme: "light",
      } as any);

      render(<ColorModeButton />);
      const button = screen.getByRole("button", { name: "Toggle color mode" });
      button.click();
      expect(setTheme).toHaveBeenCalledWith("dark");
    });
  });

  describe("LightMode component", () => {
    it("renders children with light mode class", () => {
      const { container } = render(
        <LightMode data-testid="light-mode">
          <div>Light Content</div>
        </LightMode>,
      );

      const lightModeElement = container.querySelector(
        '[data-testid="light-mode"]',
      );
      expect(lightModeElement).toHaveClass("chakra-theme", "light");
    });
  });

  describe("DarkMode component", () => {
    it("renders children with dark mode class", () => {
      const { container } = render(
        <DarkMode data-testid="dark-mode">
          <div>Dark Content</div>
        </DarkMode>,
      );

      const darkModeElement = container.querySelector(
        '[data-testid="dark-mode"]',
      );
      expect(darkModeElement).toHaveClass("chakra-theme", "dark");
    });
  });
});
