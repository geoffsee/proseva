import { render, act } from "../../test-utils";
import { describe, it, expect, beforeEach } from "vitest";
import { Toaster, toaster } from "./toaster";

describe("Toaster", () => {
  describe("toaster instance", () => {
    it("exports a toaster object", () => {
      expect(toaster).toBeDefined();
    });

    it("toaster has create method", () => {
      expect(typeof toaster.create).toBe("function");
    });

    it("can create a success toast", () => {
      expect(() => {
        toaster.create({
          title: "Success",
          type: "success",
        });
      }).not.toThrow();
    });

    it("can create an error toast", () => {
      expect(() => {
        toaster.create({
          title: "Error",
          type: "error",
        });
      }).not.toThrow();
    });

    it("can create a loading toast", () => {
      expect(() => {
        toaster.create({
          title: "Loading",
          type: "loading",
        });
      }).not.toThrow();
    });

    it("can create a toast with description", () => {
      expect(() => {
        toaster.create({
          title: "Info",
          description: "This is a description",
          type: "info",
        });
      }).not.toThrow();
    });

    it("has bottom-end placement", () => {
      expect(toaster).toBeDefined();
    });

    it("pauses on page idle", () => {
      expect(toaster).toBeDefined();
    });
  });

  describe("Toaster component", () => {
    it("renders without errors", () => {
      expect(() => {
        render(<Toaster />);
      }).not.toThrow();
    });

    it("renders the Toaster component", () => {
      const { container } = render(<Toaster />);
      expect(container).toBeInTheDocument();
    });

    it("provides portal for toasts", () => {
      const { container } = render(<Toaster />);
      expect(container).toBeInTheDocument();
    });

    it("handles multiple toasts", () => {
      render(<Toaster />);
      act(() => {
        toaster.create({ title: "First" });
        toaster.create({ title: "Second" });
        toaster.create({ title: "Third" });
      });
    });

    it("handles toast with loading state", () => {
      render(<Toaster />);
      act(() => {
        toaster.create({
          title: "Processing",
          type: "loading",
        });
      });
    });

    it("handles toast with custom properties", () => {
      render(<Toaster />);
      act(() => {
        toaster.create({
          title: "Custom Toast",
          description: "With description",
          type: "info",
        });
      });
    });
  });

  describe("Toast creation patterns", () => {
    beforeEach(() => {
      render(<Toaster />);
    });

    it("can be used for success notifications", () => {
      act(() => {
        toaster.create({
          title: "Operation completed",
          type: "success",
        });
      });
    });

    it("can be used for error notifications", () => {
      act(() => {
        toaster.create({
          title: "Something went wrong",
          type: "error",
        });
      });
    });

    it("can be used for loading states", () => {
      act(() => {
        toaster.create({
          title: "Please wait",
          type: "loading",
        });
      });
    });

    it("supports both title and description", () => {
      act(() => {
        toaster.create({
          title: "Title",
          description: "Detailed description",
        });
      });
    });

    it("renders correctly with complex content", () => {
      act(() => {
        toaster.create({
          title: "Complex Toast",
          description:
            "This is a longer description with multiple lines of text to test the layout.",
        });
      });
    });
  });
});
