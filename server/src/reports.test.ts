import { describe, it, expect } from "vitest";
import { setupTestServer, api } from "./test-helpers";

const ctx = setupTestServer();

describe("Reports API", () => {
  it("returns 400 for invalid report type", async () => {
    const res = await api.post(
      "/api/reports",
      { type: "bogus", options: {} },
      ctx.baseUrl,
    );
    expect(res.status).toBe(400);
  });

  describe("case-summary", () => {
    it("returns 400 without caseId", async () => {
      const res = await api.post(
        "/api/reports",
        { type: "case-summary", options: { includeAI: false } },
        ctx.baseUrl,
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 for missing case", async () => {
      const res = await api.post(
        "/api/reports",
        { type: "case-summary", caseId: "nope", options: { includeAI: false } },
        ctx.baseUrl,
      );
      expect(res.status).toBe(404);
    });

    it("generates a case summary", async () => {
      const c = await (
        await api.post(
          "/api/cases",
          { name: "Summary Case", court: "Circuit" },
          ctx.baseUrl,
        )
      ).json();
      await api.post(
        "/api/deadlines",
        { title: "Brief due", date: "2025-06-01", caseId: c.id },
        ctx.baseUrl,
      );
      await api.post(
        "/api/evidences",
        { title: "Exhibit A", caseId: c.id },
        ctx.baseUrl,
      );
      await api.post(
        "/api/filings",
        { title: "Complaint", date: "2025-01-01", caseId: c.id },
        ctx.baseUrl,
      );
      await api.post(
        "/api/contacts",
        { name: "Lawyer", role: "attorney", caseId: c.id },
        ctx.baseUrl,
      );

      const res = await api.post(
        "/api/reports",
        { type: "case-summary", caseId: c.id, options: { includeAI: false } },
        ctx.baseUrl,
      );
      expect(res.status).toBe(200);
      const report = await res.json();
      expect(report.title).toContain("Summary Case");
      expect(report.sections.length).toBeGreaterThanOrEqual(5);
      expect(report.sections.map((s: any) => s.heading)).toContain("Deadlines");
      expect(report.sections.map((s: any) => s.heading)).toContain("Evidence");
    });
  });

  describe("evidence-analysis", () => {
    it("returns 400 without caseId", async () => {
      const res = await api.post(
        "/api/reports",
        { type: "evidence-analysis", options: { includeAI: false } },
        ctx.baseUrl,
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 for missing case", async () => {
      const res = await api.post(
        "/api/reports",
        {
          type: "evidence-analysis",
          caseId: "nope",
          options: { includeAI: false },
        },
        ctx.baseUrl,
      );
      expect(res.status).toBe(404);
    });

    it("generates an evidence analysis", async () => {
      const c = await (
        await api.post("/api/cases", { name: "Evidence Case" }, ctx.baseUrl)
      ).json();
      await api.post(
        "/api/evidences",
        { title: "Photo", caseId: c.id, relevance: "high", admissible: true },
        ctx.baseUrl,
      );
      await api.post(
        "/api/evidences",
        { title: "Note", caseId: c.id, relevance: "low", admissible: false },
        ctx.baseUrl,
      );

      const res = await api.post(
        "/api/reports",
        {
          type: "evidence-analysis",
          caseId: c.id,
          options: { includeAI: false },
        },
        ctx.baseUrl,
      );
      expect(res.status).toBe(200);
      const report = await res.json();
      expect(report.title).toContain("Evidence Analysis");
      expect(report.sections[0].content).toContain("Total Evidence Items: 2");
    });
  });

  describe("financial", () => {
    it("generates a financial report", async () => {
      await api.post(
        "/api/finances",
        {
          category: "income",
          subcategory: "salary",
          amount: 5000,
          date: "2025-03-01",
        },
        ctx.baseUrl,
      );
      await api.post(
        "/api/finances",
        {
          category: "expense",
          subcategory: "legal fees",
          amount: 2000,
          date: "2025-03-15",
        },
        ctx.baseUrl,
      );

      const res = await api.post(
        "/api/reports",
        { type: "financial", options: { includeAI: false } },
        ctx.baseUrl,
      );
      expect(res.status).toBe(200);
      const report = await res.json();
      expect(report.title).toBe("Financial Summary");
      expect(report.sections[0].content).toContain("$5000.00");
      expect(report.sections[0].content).toContain("$2000.00");
    });

    it("filters by date range", async () => {
      await api.post(
        "/api/finances",
        {
          category: "income",
          subcategory: "salary",
          amount: 1000,
          date: "2025-01-01",
        },
        ctx.baseUrl,
      );
      await api.post(
        "/api/finances",
        {
          category: "income",
          subcategory: "bonus",
          amount: 500,
          date: "2025-06-01",
        },
        ctx.baseUrl,
      );

      const res = await api.post(
        "/api/reports",
        {
          type: "financial",
          dateRange: { from: "2025-05-01", to: "2025-07-01" },
          options: { includeAI: false },
        },
        ctx.baseUrl,
      );
      expect(res.status).toBe(200);
      const report = await res.json();
      expect(report.sections[0].content).toContain("$500.00");
      expect(report.sections[0].content).not.toContain("$1000.00");
    });
  });

  describe("chronology", () => {
    it("generates a chronology report", async () => {
      await api.post(
        "/api/deadlines",
        { title: "Hearing", date: "2025-04-01", type: "hearing" },
        ctx.baseUrl,
      );
      await api.post(
        "/api/filings",
        { title: "Motion", date: "2025-03-01" },
        ctx.baseUrl,
      );
      await api.post(
        "/api/evidences",
        { title: "Doc", dateCollected: "2025-02-01" },
        ctx.baseUrl,
      );

      const res = await api.post(
        "/api/reports",
        { type: "chronology", options: { includeAI: false } },
        ctx.baseUrl,
      );
      expect(res.status).toBe(200);
      const report = await res.json();
      expect(report.title).toBe("Case Chronology");
      expect(report.sections[0].content).toContain("Hearing");
      expect(report.sections[0].content).toContain("Motion");
    });

    it("returns empty message when no events", async () => {
      const res = await api.post(
        "/api/reports",
        { type: "chronology", options: { includeAI: false } },
        ctx.baseUrl,
      );
      expect(res.status).toBe(200);
      const report = await res.json();
      expect(report.sections[0].content).toContain("No events found");
    });
  });
});
