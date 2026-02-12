import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch before any module loads (openapi-fetch captures globalThis.fetch at import time)
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock kv module
vi.mock("./kv", () => ({
  saveAuthToken: vi.fn().mockResolvedValue(undefined),
  loadAuthToken: vi.fn().mockResolvedValue("mock-token"),
  clearAuthToken: vi.fn().mockResolvedValue(undefined),
}));

// Now import api (openapi-fetch will capture our mock)
const { api } = await import("./api");

function mockResponse(status: number, body?: any, ok?: boolean) {
  const headers = new Headers();
  if (body !== undefined) headers.set("content-type", "application/json");
  return {
    ok: ok ?? (status >= 200 && status < 300),
    status,
    statusText:
      status === 200
        ? "OK"
        : status === 204
          ? "No Content"
          : status === 404
            ? "Not Found"
            : status === 500
              ? "Internal Server Error"
              : "",
    headers,
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone: function () {
      return this;
    },
  } as unknown as Response;
}

describe("api stub layer", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("cases", () => {
    it("list returns empty array", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(200, []));
      expect(await api.cases.list()).toEqual([]);
    });

    it("get returns null", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(404, undefined, false));
      expect(await api.cases.get("1")).toBeNull();
    });

    it("create returns null", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(204));
      expect(await api.cases.create({ name: "Test" })).toBeNull();
    });

    it("update returns null", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(204));
      expect(await api.cases.update("1", {})).toBeNull();
    });

    it("delete returns undefined", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(204));
      expect(await api.cases.delete("1")).toBeNull();
    });

    it("addParty returns null", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(204));
      expect(
        await api.cases.addParty("1", { name: "A", role: "B" }),
      ).toBeNull();
    });

    it("removeParty returns undefined", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(204));
      expect(await api.cases.removeParty("1", "2")).toBeNull();
    });

    it("addFiling returns null", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(204));
      expect(
        await api.cases.addFiling("1", { title: "T", date: "2025-01-01" }),
      ).toBeNull();
    });

    it("removeFiling returns undefined", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(204));
      expect(await api.cases.removeFiling("1", "2")).toBeNull();
    });
  });

  describe("contacts", () => {
    it("list returns empty array", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(200, []));
      expect(await api.contacts.list()).toEqual([]);
    });

    it("get returns null", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(404, undefined, false));
      expect(await api.contacts.get("1")).toBeNull();
    });

    it("create returns null", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(204));
      expect(
        await api.contacts.create({ name: "A", role: "attorney" }),
      ).toBeNull();
    });

    it("update returns null", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(204));
      expect(await api.contacts.update("1", {})).toBeNull();
    });

    it("delete returns undefined", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(204));
      expect(await api.contacts.delete("1")).toBeNull();
    });
  });

  describe("deadlines", () => {
    it("list returns empty array", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(200, []));
      expect(await api.deadlines.list()).toEqual([]);
    });

    it("get returns null", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(404, undefined, false));
      expect(await api.deadlines.get("1")).toBeNull();
    });

    it("create returns null", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(204));
      expect(
        await api.deadlines.create({ title: "T", date: "2025-01-01" }),
      ).toBeNull();
    });

    it("update returns null", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(204));
      expect(await api.deadlines.update("1", {})).toBeNull();
    });

    it("delete returns undefined", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(204));
      expect(await api.deadlines.delete("1")).toBeNull();
    });

    it("toggleComplete returns null", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(204));
      expect(await api.deadlines.toggleComplete("1")).toBeNull();
    });
  });

  describe("finances", () => {
    it("list returns empty array", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(200, []));
      expect(await api.finances.list()).toEqual([]);
    });

    it("get returns null", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(404, undefined, false));
      expect(await api.finances.get("1")).toBeNull();
    });

    it("create returns null", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(204));
      expect(
        await api.finances.create({
          category: "income",
          subcategory: "s",
          amount: 100,
          date: "2025-01-01",
        }),
      ).toBeNull();
    });

    it("update returns null", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(204));
      expect(await api.finances.update("1", {})).toBeNull();
    });

    it("delete returns undefined", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(204));
      expect(await api.finances.delete("1")).toBeNull();
    });
  });

  describe("notes", () => {
    it("list returns empty array", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(200, []));
      expect(await api.notes.list()).toEqual([]);
    });

    it("get returns null", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(404, undefined, false));
      expect(await api.notes.get("1")).toBeNull();
    });

    it("create returns null", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(204));
      expect(await api.notes.create({ title: "T", content: "C" })).toBeNull();
    });
  });

  describe("evidences", () => {
    it("list returns empty array", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(200, []));
      expect(await api.evidences.list()).toEqual([]);
    });
  });

  describe("search", () => {
    it("calls search endpoint", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(200, { results: [] }));
      const results = await api.search.search("test");
      expect(results).toEqual({ results: [] });
    });
  });

  describe("config", () => {
    it("get returns config", async () => {
      const mockConfig = { ai: { vlmModel: "gpt-4" } };
      mockFetch.mockResolvedValueOnce(mockResponse(200, mockConfig));
      expect(await api.config.get()).toEqual(mockConfig);
    });
  });

  describe("auth", () => {
    it("login returns token", async () => {
      const mockResult = { success: true, token: "abc", expiresIn: 3600 };
      mockFetch.mockResolvedValueOnce(mockResponse(200, mockResult));
      expect(await api.auth.login("pass")).toEqual(mockResult);
    });
  });

  describe("deviceTokens", () => {
    it("list returns tokens", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(200, []));
      expect(await api.deviceTokens.list()).toEqual([]);
    });
  });

  describe("smsRecipients", () => {
    it("list returns recipients", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(200, []));
      expect(await api.smsRecipients.list()).toEqual([]);
    });
  });

  describe("evaluations", () => {
    it("list returns evaluations", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(200, []));
      expect(await api.evaluations.list()).toEqual([]);
    });
  });

  it("handles API errors properly", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(500, undefined, false));
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(api.cases.list()).rejects.toThrow(
      "API error: 500 Internal Server Error",
    );

    consoleErrorSpy.mockRestore();
  });
});
