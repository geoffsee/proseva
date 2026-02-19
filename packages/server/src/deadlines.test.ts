import { describe, it, expect } from "vitest";
import { setupTestServer, api } from "./test-helpers";

const ctx = setupTestServer();

describe("Deadlines API", () => {
  it("lists empty", async () => {
    const res = await api.get("/api/deadlines", ctx.baseUrl);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("creates a deadline", async () => {
    const res = await api.post(
      "/api/deadlines",
      { title: "File brief", date: "2025-06-01" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe("File brief");
    expect(body.completed).toBe(false);
  });

  it("gets by id", async () => {
    const d = await (
      await api.post(
        "/api/deadlines",
        { title: "D", date: "2025-01-01" },
        ctx.baseUrl,
      )
    ).json();
    const res = await api.get(`/api/deadlines/${d.id}`, ctx.baseUrl);
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe("D");
  });

  it("returns 404 for missing", async () => {
    const res = await api.get("/api/deadlines/nope", ctx.baseUrl);
    expect(res.status).toBe(404);
  });

  it("updates a deadline", async () => {
    const d = await (
      await api.post(
        "/api/deadlines",
        { title: "Old", date: "2025-01-01" },
        ctx.baseUrl,
      )
    ).json();
    const res = await api.patch(
      `/api/deadlines/${d.id}`,
      { title: "New" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe("New");
  });

  it("returns 404 updating missing", async () => {
    const res = await api.patch(
      "/api/deadlines/nope",
      { title: "X" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(404);
  });

  it("deletes a deadline", async () => {
    const d = await (
      await api.post(
        "/api/deadlines",
        { title: "Del", date: "2025-01-01" },
        ctx.baseUrl,
      )
    ).json();
    const res = await api.delete(`/api/deadlines/${d.id}`, ctx.baseUrl);
    expect(res.status).toBe(204);
  });

  it("returns 404 deleting missing", async () => {
    const res = await api.delete("/api/deadlines/nope", ctx.baseUrl);
    expect(res.status).toBe(404);
  });

  it("toggles completion", async () => {
    const d = await (
      await api.post(
        "/api/deadlines",
        { title: "T", date: "2025-01-01" },
        ctx.baseUrl,
      )
    ).json();
    expect(d.completed).toBe(false);
    const res = await api.post(
      `/api/deadlines/${d.id}/toggle-complete`,
      {},
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).completed).toBe(true);
  });
});
