import { describe, it, expect } from "vitest";
import { setupTestServer, api } from "./test-helpers";

const ctx = setupTestServer();

describe("Cases API", () => {
  const url = (p = "") => `${ctx.baseUrl}/api/cases${p}`;

  it("lists empty", async () => {
    const res = await fetch(url());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("creates a case", async () => {
    const res = await api.post(
      "/api/cases",
      { name: "Test Case", court: "Circuit" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Test Case");
    expect(body.court).toBe("Circuit");
    expect(body.id).toBeDefined();
  });

  it("gets a case by id", async () => {
    const created = await (
      await api.post("/api/cases", { name: "C1" }, ctx.baseUrl)
    ).json();
    const res = await fetch(url(`/${created.id}`));
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe("C1");
  });

  it("returns 404 for missing case", async () => {
    const res = await fetch(url("/nonexistent"));
    expect(res.status).toBe(404);
  });

  it("updates a case", async () => {
    const created = await (
      await api.post("/api/cases", { name: "Old" }, ctx.baseUrl)
    ).json();
    const res = await api.patch(
      `/api/cases/${created.id}`,
      { name: "New" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe("New");
  });

  it("returns 404 updating missing case", async () => {
    const res = await api.patch("/api/cases/nope", { name: "X" }, ctx.baseUrl);
    expect(res.status).toBe(404);
  });

  it("deletes a case", async () => {
    const created = await (
      await api.post("/api/cases", { name: "Del" }, ctx.baseUrl)
    ).json();
    const res = await api.delete(`/api/cases/${created.id}`, ctx.baseUrl);
    expect(res.status).toBe(204);
  });

  it("returns 404 deleting missing case", async () => {
    const res = await api.delete("/api/cases/nope", ctx.baseUrl);
    expect(res.status).toBe(404);
  });

  it("adds a party to a case", async () => {
    const c = await (
      await api.post("/api/cases", { name: "P" }, ctx.baseUrl)
    ).json();
    const res = await api.post(
      `/api/cases/${c.id}/parties`,
      { name: "Alice", role: "plaintiff" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(201);
    expect((await res.json()).name).toBe("Alice");
  });

  it("deletes a party from a case", async () => {
    const c = await (
      await api.post("/api/cases", { name: "P" }, ctx.baseUrl)
    ).json();
    const party = await (
      await api.post(
        `/api/cases/${c.id}/parties`,
        { name: "Bob", role: "defendant" },
        ctx.baseUrl,
      )
    ).json();
    const res = await api.delete(
      `/api/cases/${c.id}/parties/${party.id}`,
      ctx.baseUrl,
    );
    expect(res.status).toBe(204);
  });

  it("adds a filing to a case", async () => {
    const c = await (
      await api.post("/api/cases", { name: "F" }, ctx.baseUrl)
    ).json();
    const res = await api.post(
      `/api/cases/${c.id}/filings`,
      { title: "Motion", date: "2025-01-01" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(201);
  });

  it("deletes a filing from a case", async () => {
    const c = await (
      await api.post("/api/cases", { name: "F" }, ctx.baseUrl)
    ).json();
    const f = await (
      await api.post(
        `/api/cases/${c.id}/filings`,
        { title: "Motion", date: "2025-01-01" },
        ctx.baseUrl,
      )
    ).json();
    const res = await api.delete(
      `/api/cases/${c.id}/filings/${f.id}`,
      ctx.baseUrl,
    );
    expect(res.status).toBe(204);
  });
});
