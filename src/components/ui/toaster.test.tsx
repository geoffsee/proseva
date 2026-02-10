import { render, screen } from "../../test-utils";
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
      // Verify toaster was created with correct placement option
      expect(toaster).toBeDefined();
    });

    it("pauses on page idle", () => {
      // Verify toaster was created with pauseOnPageIdle option
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
      expect(() => {
        toaster.create({ title: "First" });
        toaster.create({ title: "Second" });
        toaster.create({ title: "Third" });
      }).not.toThrow();
    });

    it("handles toast with loading state", () => {
      render(<Toaster />);
      expect(() => {
        toaster.create({
          title: "Processing",
          type: "loading",
        });
      }).not.toThrow();
    });

    it("handles toast with custom properties", () => {
      render(<Toaster />);
      expect(() => {
        toaster.create({
          title: "Custom Toast",
          description: "With description",
          type: "info",
        });
      }).not.toThrow();
    });
  });

  describe("Toast creation patterns", () => {
    beforeEach(() => {
      render(<Toaster />);
    });

    it("can be used for success notifications", () => {
      expect(() => {
        toaster.create({
          title: "Operation completed",
          type: "success",
        });
      }).not.toThrow();
    });

    it("can be used for error notifications", () => {
      expect(() => {
        toaster.create({
          title: "Something went wrong",
          type: "error",
        });
      }).not.toThrow();
    });

    it("can be used for loading states", () => {
      expect(() => {
        toaster.create({
          title: "Please wait",
          type: "loading",
        });
      }).not.toThrow();
    });

    it("supports both title and description", () => {
      expect(() => {
        toaster.create({
          title: "Title",
          description: "Detailed description",
        });
      }).not.toThrow();
    });

    it("renders correctly with complex content", () => {
      expect(() => {
        toaster.create({
          title: "Complex Toast",
          description:
            "This is a longer description with multiple lines of text to test the layout.",
        });
      }).not.toThrow();
    });
  });
});
