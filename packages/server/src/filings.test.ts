import { describe, it, expect } from "vitest";
import { setupTestServer, api } from "./test-helpers";

const ctx = setupTestServer();

describe("Filings API", () => {
  it("lists empty", async () => {
    const res = await api.get("/api/filings", ctx.baseUrl);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("creates a filing", async () => {
    const res = await api.post(
      "/api/filings",
      { title: "Complaint", date: "2025-01-01", type: "motion" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe("Complaint");
  });

  it("gets by id", async () => {
    const f = await (
      await api.post(
        "/api/filings",
        { title: "F1", date: "2025-01-01" },
        ctx.baseUrl,
      )
    ).json();
    const res = await api.get(`/api/filings/${f.id}`, ctx.baseUrl);
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe("F1");
  });

  it("returns 404 for missing", async () => {
    const res = await api.get("/api/filings/nope", ctx.baseUrl);
    expect(res.status).toBe(404);
  });

  it("updates a filing", async () => {
    const f = await (
      await api.post(
        "/api/filings",
        { title: "Old", date: "2025-01-01" },
        ctx.baseUrl,
      )
    ).json();
    const res = await api.patch(
      `/api/filings/${f.id}`,
      { title: "New" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe("New");
  });

  it("returns 404 updating missing", async () => {
    const res = await api.patch(
      "/api/filings/nope",
      { title: "X" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(404);
  });

  it("deletes a filing", async () => {
    const f = await (
      await api.post(
        "/api/filings",
        { title: "Del", date: "2025-01-01" },
        ctx.baseUrl,
      )
    ).json();
    const res = await api.delete(`/api/filings/${f.id}`, ctx.baseUrl);
    expect(res.status).toBe(204);
  });

  it("returns 404 deleting missing", async () => {
    const res = await api.delete("/api/filings/nope", ctx.baseUrl);
    expect(res.status).toBe(404);
  });
});
