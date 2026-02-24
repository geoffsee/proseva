import { describe, it, expect } from "vitest";
import { setupTestServer, api } from "./test-helpers";

const ctx = setupTestServer();

describe("GraphQL API", () => {
  it("responds to a courts query", async () => {
    const res = await api.post(
      "/api/graphql",
      { query: "{ courts { name type locality } }" },
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
            name locality type district clerk
            phone phones fax email address
            city state zip hours website judges
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

    // If the DB has courts, verify the shape
    if (courts.length > 0) {
      const court = courts[0];
      expect(typeof court.name).toBe("string");
      expect(Array.isArray(court.judges)).toBe(true);
    }
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
