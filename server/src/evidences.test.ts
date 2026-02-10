import { describe, it, expect } from "vitest";
import { setupTestServer, api } from "./test-helpers";

const ctx = setupTestServer();

describe("Evidences API", () => {
  it("lists empty", async () => {
    const res = await api.get("/api/evidences", ctx.baseUrl);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("creates evidence", async () => {
    const res = await api.post(
      "/api/evidences",
      { title: "Photo A", type: "photo" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe("Photo A");
    expect(body.id).toBeDefined();
  });

  it("gets by id", async () => {
    const e = await (
      await api.post("/api/evidences", { title: "Doc B" }, ctx.baseUrl)
    ).json();
    const res = await api.get(`/api/evidences/${e.id}`, ctx.baseUrl);
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe("Doc B");
  });

  it("returns 404 for missing", async () => {
    const res = await api.get("/api/evidences/nope", ctx.baseUrl);
    expect(res.status).toBe(404);
  });

  it("updates evidence", async () => {
    const e = await (
      await api.post("/api/evidences", { title: "Old" }, ctx.baseUrl)
    ).json();
    const res = await api.patch(
      `/api/evidences/${e.id}`,
      { title: "New" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe("New");
  });

  it("returns 404 updating missing", async () => {
    const res = await api.patch(
      "/api/evidences/nope",
      { title: "X" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(404);
  });

  it("deletes evidence", async () => {
    const e = await (
      await api.post("/api/evidences", { title: "Del" }, ctx.baseUrl)
    ).json();
    const res = await api.delete(`/api/evidences/${e.id}`, ctx.baseUrl);
    expect(res.status).toBe(204);
  });

  it("returns 404 deleting missing", async () => {
    const res = await api.delete("/api/evidences/nope", ctx.baseUrl);
    expect(res.status).toBe(404);
  });
});
