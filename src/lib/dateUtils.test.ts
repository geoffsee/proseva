import { describe, it, expect } from "vitest";
import { parseLocalDate, formatDate, parseTimestamp } from "./dateUtils";

describe("dateUtils", () => {
  describe("parseLocalDate", () => {
    it("parses ISO date string as local date", () => {
      const result = parseLocalDate("2025-03-15");

      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(2); // March is month 2 (0-indexed)
      expect(result.getDate()).toBe(15);
    });

    it("handles different dates", () => {
      const result = parseLocalDate("2024-12-31");

      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(11); // December is month 11
      expect(result.getDate()).toBe(31);
    });

    it("handles January dates", () => {
      const result = parseLocalDate("2025-01-01");

      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0); // January is month 0
      expect(result.getDate()).toBe(1);
    });
  });

  describe("formatDate", () => {
    it("formats date with default options", () => {
      const result = formatDate("2025-03-15");

      // Format should be "Mar 15, 2025" in en-US locale
      expect(result).toContain("Mar");
      expect(result).toContain("15");
      expect(result).toContain("2025");
    });

    it("formats date with custom options", () => {
      const result = formatDate("2025-03-15", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      expect(result).toContain("March");
      expect(result).toContain("15");
      expect(result).toContain("2025");
    });

    it("formats different dates correctly", () => {
      const result = formatDate("2024-12-31");

      expect(result).toContain("Dec");
      expect(result).toContain("31");
      expect(result).toContain("2024");
    });
  });

  describe("parseTimestamp", () => {
    it("parses ISO timestamp string", () => {
      const timestamp = "2025-03-15T14:30:00.000Z";
      const result = parseTimestamp(timestamp);

      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe(timestamp);
    });

    it("parses different timestamp formats", () => {
      const timestamp = "2024-12-31T23:59:59.999Z";
      const result = parseTimestamp(timestamp);

      expect(result).toBeInstanceOf(Date);
      expect(result.getUTCFullYear()).toBe(2024);
      expect(result.getUTCMonth()).toBe(11);
      expect(result.getUTCDate()).toBe(31);
      expect(result.getUTCHours()).toBe(23);
      expect(result.getUTCMinutes()).toBe(59);
    });
  });
});
