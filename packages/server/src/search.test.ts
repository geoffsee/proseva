import { describe, it, expect } from "vitest";
import { setupTestServer, api } from "./test-helpers";

const ctx = setupTestServer();

describe("Search API", () => {
  it("requires query parameter (400 if missing)", async () => {
    const res = await api.get("/api/search", ctx.baseUrl);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Query parameter 'q' is required");
  });

  it("requires non-empty query parameter", async () => {
    const res = await api.get("/api/search?q=   ", ctx.baseUrl);
    expect(res.status).toBe(400);
  });

  it("returns empty results for no matches", async () => {
    const res = await api.get("/api/search?q=nonexistent", ctx.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalResults).toBe(0);
    expect(body.results.cases.items).toEqual([]);
  });

  it("searches across all entity types", async () => {
    // Create entities with searchable text
    await api.post("/api/cases", { name: "Motion Case" }, ctx.baseUrl);
    await api.post(
      "/api/contacts",
      { name: "Motion Expert", role: "witness" },
      ctx.baseUrl,
    );
    await api.post(
      "/api/deadlines",
      { title: "Motion Deadline", date: "2025-01-01", type: "filing" },
      ctx.baseUrl,
    );
    await api.post(
      "/api/filings",
      { title: "Motion to Dismiss", date: "2025-01-01" },
      ctx.baseUrl,
    );
    await api.post(
      "/api/notes",
      { title: "Motion Notes", content: "Details", category: "general" },
      ctx.baseUrl,
    );

    const res = await api.get("/api/search?q=motion", ctx.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.query).toBe("motion");
    expect(body.totalResults).toBeGreaterThanOrEqual(5);
    expect(body.results.cases.items.length).toBe(1);
    expect(body.results.contacts.items.length).toBe(1);
    expect(body.results.deadlines.items.length).toBe(1);
    expect(body.results.filings.items.length).toBe(1);
    expect(body.results.notes.items.length).toBe(1);
  });

  it("filters by entity types parameter", async () => {
    await api.post("/api/cases", { name: "Test Case" }, ctx.baseUrl);
    await api.post(
      "/api/contacts",
      { name: "Test Contact", role: "witness" },
      ctx.baseUrl,
    );

    const res = await api.get("/api/search?q=test&types=cases", ctx.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.cases.items.length).toBe(1);
    expect(body.results.contacts.items.length).toBe(0);
  });

  it("filters by multiple entity types", async () => {
    await api.post("/api/cases", { name: "Smith Case" }, ctx.baseUrl);
    await api.post(
      "/api/contacts",
      { name: "Smith Attorney", role: "lawyer" },
      ctx.baseUrl,
    );
    await api.post(
      "/api/deadlines",
      { title: "Smith Deadline", date: "2025-01-01", type: "hearing" },
      ctx.baseUrl,
    );

    const res = await api.get(
      "/api/search?q=smith&types=cases,contacts",
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.cases.items.length).toBe(1);
    expect(body.results.contacts.items.length).toBe(1);
    expect(body.results.deadlines.items.length).toBe(0);
  });

  it("respects limit parameter", async () => {
    // Create multiple matching cases
    await api.post("/api/cases", { name: "Alpha Case" }, ctx.baseUrl);
    await api.post("/api/cases", { name: "Alpha Beta Case" }, ctx.baseUrl);
    await api.post("/api/cases", { name: "Alpha Gamma Case" }, ctx.baseUrl);

    const res = await api.get("/api/search?q=alpha&limit=2", ctx.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.cases.items.length).toBe(2);
    expect(body.results.cases.total).toBe(3);
    expect(body.results.cases.hasMore).toBe(true);
  });

  it("respects offset parameter", async () => {
    await api.post("/api/cases", { name: "Case One" }, ctx.baseUrl);
    await api.post("/api/cases", { name: "Case Two" }, ctx.baseUrl);
    await api.post("/api/cases", { name: "Case Three" }, ctx.baseUrl);

    const res = await api.get(
      "/api/search?q=case&offset=1&limit=2",
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.cases.items.length).toBe(2);
    expect(body.results.cases.total).toBe(3);
  });

  it("includes match highlights with <mark> tags", async () => {
    await api.post("/api/cases", { name: "Motion to Dismiss" }, ctx.baseUrl);

    const res = await api.get("/api/search?q=motion", ctx.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    const caseResult = body.results.cases.items[0];
    expect(caseResult.highlights).toBeDefined();
    expect(caseResult.highlights.length).toBeGreaterThan(0);
    expect(caseResult.highlights[0].snippet).toContain("<mark>");
    expect(caseResult.highlights[0].snippet).toContain("</mark>");
  });

  it("calculates relevance scores (sorted descending)", async () => {
    // Create cases where "motion" appears in different positions
    await api.post("/api/cases", { name: "Motion First" }, ctx.baseUrl);
    await api.post(
      "/api/cases",
      { name: "Something About Motion" },
      ctx.baseUrl,
    );

    const res = await api.get("/api/search?q=motion", ctx.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    const items = body.results.cases.items;
    expect(items.length).toBe(2);
    expect(items[0].score).toBeGreaterThanOrEqual(items[1].score);
    // First item should have "Motion First" since match is at beginning
    expect(items[0].data.name).toBe("Motion First");
  });

  it("performs case-insensitive search", async () => {
    await api.post("/api/cases", { name: "UPPERCASE MOTION" }, ctx.baseUrl);
    await api.post("/api/cases", { name: "lowercase motion" }, ctx.baseUrl);

    const res = await api.get("/api/search?q=MOTION", ctx.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.cases.items.length).toBe(2);
  });

  it("searches nested party names in cases", async () => {
    const caseRes = await api.post(
      "/api/cases",
      { name: "Family Case" },
      ctx.baseUrl,
    );
    const caseData = await caseRes.json();
    await api.post(
      `/api/cases/${caseData.id}/parties`,
      { name: "John Smith", role: "plaintiff" },
      ctx.baseUrl,
    );

    const res = await api.get("/api/search?q=smith", ctx.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.cases.items.length).toBe(1);
    expect(body.results.cases.items[0].matchedFields).toContain("parties.name");
  });

  it("searches array fields (tags) in evidence", async () => {
    await api.post(
      "/api/evidences",
      { title: "Photo Evidence", tags: ["photo", "family", "vacation"] },
      ctx.baseUrl,
    );

    const res = await api.get("/api/search?q=vacation", ctx.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.evidences.items.length).toBe(1);
    expect(body.results.evidences.items[0].matchedFields).toContain("tags");
  });

  it("searches array fields (tags) in notes", async () => {
    await api.post(
      "/api/notes",
      {
        title: "Research",
        content: "Some content",
        category: "research",
        tags: ["custody", "important"],
      },
      ctx.baseUrl,
    );

    const res = await api.get("/api/search?q=custody", ctx.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.notes.items.length).toBe(1);
  });

  it("filters by caseId", async () => {
    const case1 = await (
      await api.post("/api/cases", { name: "Case One" }, ctx.baseUrl)
    ).json();
    const case2 = await (
      await api.post("/api/cases", { name: "Case Two" }, ctx.baseUrl)
    ).json();

    await api.post(
      "/api/contacts",
      { name: "Contact A", role: "witness", caseId: case1.id },
      ctx.baseUrl,
    );
    await api.post(
      "/api/contacts",
      { name: "Contact B", role: "witness", caseId: case2.id },
      ctx.baseUrl,
    );

    const res = await api.get(
      `/api/search?q=contact&caseId=${case1.id}`,
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.contacts.items.length).toBe(1);
    expect(body.results.contacts.items[0].data.name).toBe("Contact A");
  });

  it("includes timing information", async () => {
    const res = await api.get("/api/search?q=test", ctx.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.timing).toBeDefined();
    expect(typeof body.timing.searchMs).toBe("number");
    expect(body.timing.searchMs).toBeGreaterThanOrEqual(0);
  });

  it("handles special regex characters in query", async () => {
    await api.post(
      "/api/cases",
      { name: "Case (Test) [Special]" },
      ctx.baseUrl,
    );

    const res = await api.get("/api/search?q=(Test)", ctx.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.cases.items.length).toBe(1);
  });

  it("clamps limit to valid range", async () => {
    await api.post("/api/cases", { name: "Test Case" }, ctx.baseUrl);

    // Limit too high
    const res1 = await api.get("/api/search?q=test&limit=1000", ctx.baseUrl);
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.results.cases.items.length).toBe(1);

    // Limit too low
    const res2 = await api.get("/api/search?q=test&limit=0", ctx.baseUrl);
    expect(res2.status).toBe(200);
  });

  it("handles negative offset gracefully", async () => {
    await api.post("/api/cases", { name: "Test Case" }, ctx.baseUrl);

    const res = await api.get("/api/search?q=test&offset=-5", ctx.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.cases.items.length).toBe(1);
  });

  it("ignores invalid types parameter", async () => {
    await api.post("/api/cases", { name: "Test Case" }, ctx.baseUrl);

    const res = await api.get(
      "/api/search?q=test&types=invalid,cases,alsobad",
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.cases.items.length).toBe(1);
  });

  it("returns all entity types in response even when empty", async () => {
    const res = await api.get("/api/search?q=test", ctx.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.cases).toBeDefined();
    expect(body.results.contacts).toBeDefined();
    expect(body.results.deadlines).toBeDefined();
    expect(body.results.finances).toBeDefined();
    expect(body.results.evidences).toBeDefined();
    expect(body.results.filings).toBeDefined();
    expect(body.results.notes).toBeDefined();
    expect(body.results.documents).toBeDefined();
  });

  it("includes matchedFields array in results", async () => {
    await api.post(
      "/api/cases",
      { name: "Test Name", notes: "Test notes content" },
      ctx.baseUrl,
    );

    const res = await api.get("/api/search?q=test", ctx.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    const item = body.results.cases.items[0];
    expect(Array.isArray(item.matchedFields)).toBe(true);
    expect(item.matchedFields.length).toBeGreaterThan(0);
  });

  it("searches description field in finances", async () => {
    await api.post(
      "/api/finances",
      {
        category: "expense",
        subcategory: "legal",
        amount: 500,
        date: "2025-01-01",
        description: "Attorney retainer",
      },
      ctx.baseUrl,
    );

    const res = await api.get("/api/search?q=retainer", ctx.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.finances.items.length).toBe(1);
  });

  it("searches subcategory field in finances", async () => {
    await api.post(
      "/api/finances",
      {
        category: "expense",
        subcategory: "filing fees",
        amount: 100,
        date: "2025-01-01",
        description: "Court costs",
      },
      ctx.baseUrl,
    );

    const res = await api.get("/api/search?q=filing", ctx.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.finances.items.length).toBe(1);
  });
});
