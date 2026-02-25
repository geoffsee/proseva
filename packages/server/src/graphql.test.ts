import { describe, it, expect } from "vitest";
import { setupTestServer, api } from "./test-helpers";

const ctx = setupTestServer();

describe("GraphQL API", () => {
  it("responds to a courts query", async () => {
    const res = await api.post(
      "/api/graphql",
      { query: "{ courts { id name type locality } }" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data.courts)).toBe(true);
  });

  it("returns court fields in correct shape", async () => {
    const res = await api.post(
      "/api/graphql",
      {
        query: `{
          courts {
            id name locality type district clerk
            phone fax email address
            city state zip hours homepage judges
          }
        }`,
      },
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.errors).toBeUndefined();
    const courts = body.data.courts;
    expect(Array.isArray(courts)).toBe(true);

    if (courts.length > 0) {
      const court = courts[0];
      expect(typeof court.name).toBe("string");
      expect(Array.isArray(court.judges)).toBe(true);
    }
  });

  it("supports court lookup by id", async () => {
    const res = await api.post(
      "/api/graphql",
      { query: "{ court(id: 1) { id name } }" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.errors).toBeUndefined();
    // court may be null if DB has no row with id=1 in tests
  });

  it("supports virginia code queries", async () => {
    const res = await api.post(
      "/api/graphql",
      { query: '{ virginiaCodes(limit: 3) { id section title } }' },
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.errors).toBeUndefined();
    expect(Array.isArray(body.data.virginiaCodes)).toBe(true);
  });

  it("supports constitution section queries", async () => {
    const res = await api.post(
      "/api/graphql",
      { query: "{ constitutionSections(limit: 3) { id articleName sectionName } }" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.errors).toBeUndefined();
    expect(Array.isArray(body.data.constitutionSections)).toBe(true);
  });

  it("supports authorities queries", async () => {
    const res = await api.post(
      "/api/graphql",
      { query: "{ authorities(limit: 3) { id name shortName } }" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.errors).toBeUndefined();
    expect(Array.isArray(body.data.authorities)).toBe(true);
  });

  it("supports documents queries", async () => {
    const res = await api.post(
      "/api/graphql",
      { query: '{ documents(limit: 3) { id dataset title } }' },
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.errors).toBeUndefined();
    expect(Array.isArray(body.data.documents)).toBe(true);
  });

  it("supports popular names queries", async () => {
    const res = await api.post(
      "/api/graphql",
      { query: "{ popularNames(limit: 3) { id name section } }" },
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.errors).toBeUndefined();
    expect(Array.isArray(body.data.popularNames)).toBe(true);
  });

  it("returns errors for invalid queries", async () => {
    const res = await api.post(
      "/api/graphql",
      { query: "{ nonExistentField }" },
      ctx.baseUrl,
    );
    const body = await res.json();
    expect(body.errors).toBeDefined();
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it("handles introspection query", async () => {
    const res = await api.post(
      "/api/graphql",
      {
        query: `{
          __schema {
            queryType { name }
          }
        }`,
      },
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.__schema.queryType.name).toBe("Query");
  });
});
