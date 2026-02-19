import { describe, it, expect } from "vitest";
import { setupTestServer, api } from "./test-helpers";

const ctx = setupTestServer();

describe("Contacts API", () => {
  it("lists empty", async () => {
    const res = await api.get("/api/contacts", ctx.baseUrl);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("creates a contact", async () => {
    const res = await api.post(
      "/api/contacts",
      { name: "Jane", role: "attorney" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Jane");
    expect(body.id).toBeDefined();
  });

  it("gets by id", async () => {
    const c = await (
      await api.post(
        "/api/contacts",
        { name: "J", role: "witness" },
        ctx.baseUrl,
      )
    ).json();
    const res = await api.get(`/api/contacts/${c.id}`, ctx.baseUrl);
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe("J");
  });

  it("returns 404 for missing", async () => {
    const res = await api.get("/api/contacts/nope", ctx.baseUrl);
    expect(res.status).toBe(404);
  });

  it("updates a contact", async () => {
    const c = await (
      await api.post("/api/contacts", { name: "Old", role: "x" }, ctx.baseUrl)
    ).json();
    const res = await api.patch(
      `/api/contacts/${c.id}`,
      { name: "New" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe("New");
  });

  it("returns 404 updating missing", async () => {
    const res = await api.patch(
      "/api/contacts/nope",
      { name: "X" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(404);
  });

  it("deletes a contact", async () => {
    const c = await (
      await api.post("/api/contacts", { name: "Del", role: "x" }, ctx.baseUrl)
    ).json();
    const res = await api.delete(`/api/contacts/${c.id}`, ctx.baseUrl);
    expect(res.status).toBe(204);
  });

  it("returns 404 deleting missing", async () => {
    const res = await api.delete("/api/contacts/nope", ctx.baseUrl);
    expect(res.status).toBe(404);
  });
});
