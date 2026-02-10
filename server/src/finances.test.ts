import { describe, it, expect } from "vitest";
import { setupTestServer, api } from "./test-helpers";

const ctx = setupTestServer();

describe("Finances API", () => {
  it("lists empty", async () => {
    const res = await api.get("/api/finances", ctx.baseUrl);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("creates an entry", async () => {
    const res = await api.post(
      "/api/finances",
      {
        category: "income",
        subcategory: "salary",
        amount: 5000,
        date: "2025-01-01",
      },
      ctx.baseUrl,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.amount).toBe(5000);
  });

  it("gets by id", async () => {
    const e = await (
      await api.post(
        "/api/finances",
        {
          category: "expense",
          subcategory: "rent",
          amount: 1200,
          date: "2025-01-01",
        },
        ctx.baseUrl,
      )
    ).json();
    const res = await api.get(`/api/finances/${e.id}`, ctx.baseUrl);
    expect(res.status).toBe(200);
    expect((await res.json()).subcategory).toBe("rent");
  });

  it("returns 404 for missing", async () => {
    const res = await api.get("/api/finances/nope", ctx.baseUrl);
    expect(res.status).toBe(404);
  });

  it("updates an entry", async () => {
    const e = await (
      await api.post(
        "/api/finances",
        {
          category: "income",
          subcategory: "old",
          amount: 100,
          date: "2025-01-01",
        },
        ctx.baseUrl,
      )
    ).json();
    const res = await api.patch(
      `/api/finances/${e.id}`,
      { subcategory: "new" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).subcategory).toBe("new");
  });

  it("returns 404 updating missing", async () => {
    const res = await api.patch(
      "/api/finances/nope",
      { amount: 1 },
      ctx.baseUrl,
    );
    expect(res.status).toBe(404);
  });

  it("deletes an entry", async () => {
    const e = await (
      await api.post(
        "/api/finances",
        { category: "income", subcategory: "x", amount: 1, date: "2025-01-01" },
        ctx.baseUrl,
      )
    ).json();
    const res = await api.delete(`/api/finances/${e.id}`, ctx.baseUrl);
    expect(res.status).toBe(204);
  });

  it("returns 404 deleting missing", async () => {
    const res = await api.delete("/api/finances/nope", ctx.baseUrl);
    expect(res.status).toBe(404);
  });
});
