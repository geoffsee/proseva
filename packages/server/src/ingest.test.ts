import { describe, it, expect, vi } from "vitest";
import {
  extractDates,
  deriveCategory,
  cleanTitle,
  generateId,
  extractTextFromPdf,
} from "./ingest";

describe("extractDates", () => {
  it("extracts MM/DD/YYYY dates", () => {
    expect(extractDates("Filed on 01/15/2024")).toContain("01/15/2024");
  });

  it("extracts MM-DD-YYYY dates", () => {
    expect(extractDates("Date: 03-22-2023")).toContain("03-22-2023");
  });

  it("extracts long-form dates", () => {
    expect(extractDates("Hearing on January 5, 2024")).toContain(
      "January 5, 2024",
    );
  });

  it("extracts ISO dates", () => {
    expect(extractDates("2024-01-15 event")).toContain("2024-01-15");
  });

  it("deduplicates dates", () => {
    const result = extractDates("01/15/2024 and 01/15/2024");
    expect(result.filter((d) => d === "01/15/2024")).toHaveLength(1);
  });

  it("returns empty array when no dates found", () => {
    expect(extractDates("no dates here")).toEqual([]);
  });
});

describe("deriveCategory", () => {
  it("returns first directory segment relative to base", () => {
    expect(deriveCategory("/base/motions/file.pdf", "/base")).toBe("motions");
  });
});

describe("cleanTitle", () => {
  it("removes .pdf extension and replaces underscores/dashes", () => {
    expect(cleanTitle("my_legal-document.pdf")).toBe("my legal document");
  });

  it("collapses multiple spaces", () => {
    expect(cleanTitle("a__b--c.pdf")).toBe("a b c");
  });
});

describe("generateId", () => {
  it("returns a 12-char hex string", () => {
    const id = generateId("some/path.pdf");
    expect(id).toMatch(/^[0-9a-f]{12}$/);
  });

  it("is deterministic", () => {
    expect(generateId("same")).toBe(generateId("same"));
  });
});

import OpenAI from "openai";

describe("extractTextFromPdf", () => {
  it("extracts text and page count from OpenAI response", async () => {
    const mockOpenai = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: { content: "Extracted text content\nPAGE_COUNT:3" },
              },
            ],
          }),
        },
      },
    } as unknown as OpenAI;

    const result = await extractTextFromPdf(
      Buffer.from("fake-pdf"),
      mockOpenai,
    );
    expect(result.text).toBe("Extracted text content");
    expect(result.pageCount).toBe(3);
  });

  it("defaults to page count 1 when not found", async () => {
    const mockOpenai = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "Just text" } }],
          }),
        },
      },
    } as unknown as OpenAI;

    const result = await extractTextFromPdf(Buffer.from("fake"), mockOpenai);
    expect(result.pageCount).toBe(1);
    expect(result.text).toBe("Just text");
  });

  it("handles null content", async () => {
    const mockOpenai = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: null } }],
          }),
        },
      },
    } as unknown as OpenAI;

    const result = await extractTextFromPdf(Buffer.from("fake"), mockOpenai);
    expect(result.text).toBe("");
    expect(result.pageCount).toBe(1);
  });
});
