import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Clear any electronAPI that might leak from other tests
const windowAny = window as any;
let savedElectronAPI: any;

beforeEach(() => {
  mockFetch.mockReset();
  savedElectronAPI = windowAny.electronAPI;
});

afterEach(() => {
  // Restore original state
  if (savedElectronAPI !== undefined) {
    windowAny.electronAPI = savedElectronAPI;
  } else {
    delete windowAny.electronAPI;
  }
});

describe("explorerQuery", () => {
  describe("without electronAPI (browser mode)", () => {
    beforeEach(() => {
      delete windowAny.electronAPI;
    });

    it("sends POST to direct explorer URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { stats: { nodeCount: 42 } } }),
      });

      // Re-import to pick up the missing electronAPI
      const { explorerQuery } = await import("./explorer-api");
      await explorerQuery("{ stats { nodeCount } }");

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/graphql");
      expect(opts.method).toBe("POST");
      expect(opts.headers["Content-Type"]).toBe("application/json");
      const body = JSON.parse(opts.body);
      expect(body.query).toBe("{ stats { nodeCount } }");
    });

    it("passes variables in request body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { node: { id: 1 } } }),
      });

      const { explorerQuery } = await import("./explorer-api");
      await explorerQuery("query ($id: Int!) { node(id: $id) { id } }", { id: 1 });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.variables).toEqual({ id: 1 });
    });

    it("returns data from successful response", async () => {
      const expectedData = { stats: { nodeCount: 10, edgeCount: 5 } };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: expectedData }),
      });

      const { explorerQuery } = await import("./explorer-api");
      const result = await explorerQuery("{ stats { nodeCount edgeCount } }");
      expect(result).toEqual(expectedData);
    });
  });

  describe("with electronAPI (Electron mode)", () => {
    beforeEach(() => {
      windowAny.electronAPI = { explorerUrl: "http://localhost:3002" };
    });

    it("sends POST to /explorer/graphql IPC path", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { stats: { nodeCount: 1 } } }),
      });

      // Need fresh import to re-evaluate the electronAPI check
      vi.resetModules();
      const { explorerQuery } = await import("./explorer-api");
      await explorerQuery("{ stats { nodeCount } }");

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("/explorer/graphql");
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      delete windowAny.electronAPI;
    });

    it("throws on non-ok HTTP response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const { explorerQuery } = await import("./explorer-api");
      await expect(explorerQuery("{ stats { nodeCount } }")).rejects.toThrow(
        "Explorer query failed: 500 Internal Server Error",
      );
    });

    it("throws on GraphQL errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          errors: [{ message: "Cannot query field \"bogus\"" }],
        }),
      });

      const { explorerQuery } = await import("./explorer-api");
      await expect(explorerQuery("{ bogus }")).rejects.toThrow(
        'Explorer GraphQL error: Cannot query field "bogus"',
      );
    });

    it("does not throw when errors array is empty", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { ok: true }, errors: [] }),
      });

      const { explorerQuery } = await import("./explorer-api");
      const result = await explorerQuery("{ ok }");
      expect(result).toEqual({ ok: true });
    });
  });
});
