import { describe, it, expect } from "vitest";
import { setupTestServer, api } from "./test-helpers";

const ctx = setupTestServer();

describe("Fax Jobs API", () => {
  it("lists empty", async () => {
    const res = await api.get("/api/fax-jobs", ctx.baseUrl);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("creates a fax job", async () => {
    const res = await api.post(
      "/api/fax-jobs",
      {
        filingId: "filing-1",
        recipientFax: "555-1234",
        recipientName: "Test Court",
        caseId: "case-1",
      },
      ctx.baseUrl,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.filingId).toBe("filing-1");
    expect(body.recipientFax).toBe("555-1234");
    expect(body.recipientName).toBe("Test Court");
    // Status may be "pending" or "sending" depending on async timing
    expect(["pending", "sending", "sent"]).toContain(body.status);
  });

  it("returns 400 when filingId is missing", async () => {
    const res = await api.post(
      "/api/fax-jobs",
      { recipientFax: "555-1234" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when recipientFax is missing", async () => {
    const res = await api.post(
      "/api/fax-jobs",
      { filingId: "filing-1" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(400);
  });

  it("gets a fax job by id", async () => {
    const created = await (
      await api.post(
        "/api/fax-jobs",
        {
          filingId: "filing-2",
          recipientFax: "555-5678",
        },
        ctx.baseUrl,
      )
    ).json();

    const res = await api.get(`/api/fax-jobs/${created.id}`, ctx.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(created.id);
    expect(body.filingId).toBe("filing-2");
  });

  it("returns 404 for missing fax job", async () => {
    const res = await api.get("/api/fax-jobs/nonexistent", ctx.baseUrl);
    expect(res.status).toBe(404);
  });

  it("deletes a fax job", async () => {
    const created = await (
      await api.post(
        "/api/fax-jobs",
        {
          filingId: "filing-3",
          recipientFax: "555-9999",
        },
        ctx.baseUrl,
      )
    ).json();

    const res = await api.delete(`/api/fax-jobs/${created.id}`, ctx.baseUrl);
    expect(res.status).toBe(204);

    const getRes = await api.get(`/api/fax-jobs/${created.id}`, ctx.baseUrl);
    expect(getRes.status).toBe(404);
  });

  it("returns 404 when deleting missing", async () => {
    const res = await api.delete("/api/fax-jobs/nonexistent", ctx.baseUrl);
    expect(res.status).toBe(404);
  });

  it("lists jobs sorted newest first", async () => {
    await api.post(
      "/api/fax-jobs",
      { filingId: "f-a", recipientFax: "111" },
      ctx.baseUrl,
    );
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 10));
    await api.post(
      "/api/fax-jobs",
      { filingId: "f-b", recipientFax: "222" },
      ctx.baseUrl,
    );

    const res = await api.get("/api/fax-jobs", ctx.baseUrl);
    const jobs = await res.json();
    expect(jobs.length).toBe(2);
    expect(jobs[0].filingId).toBe("f-b");
    expect(jobs[1].filingId).toBe("f-a");
  });

  it("returns fax status", async () => {
    const res = await api.get("/api/fax/status", ctx.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(true);
    expect(body.provider).toBe("stub");
  });
});
