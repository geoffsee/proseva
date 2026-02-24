import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCreate = vi.fn();

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockCreate } };
  },
}));

vi.mock("./config", () => ({
  getConfig: vi.fn((key: string) => {
    if (key === "EXPLORER_URL") return "http://test-explorer:3002";
    if (key === "OPENAI_API_KEY") return "test-key";
    if (key === "TEXT_MODEL_SMALL") return "gpt-4o-mini";
    return undefined;
  }),
}));

import { getConfig } from "./config";
import {
  executeExplorerTool,
  isExplorerToolName,
  isExplorerAvailable,
  EXPLORER_TOOL_NAMES,
  explorerTools,
} from "./explorer-tools";

const mockGetConfig = vi.mocked(getConfig);
const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = mockFetch;
  mockFetch.mockReset();
  mockCreate.mockReset();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("explorer-tools", () => {
  describe("isExplorerToolName", () => {
    it("returns true for all valid explorer tool names", () => {
      for (const name of EXPLORER_TOOL_NAMES) {
        expect(isExplorerToolName(name)).toBe(true);
      }
    });

    it("returns false for non-explorer tool names", () => {
      expect(isExplorerToolName("GetCases")).toBe(false);
      expect(isExplorerToolName("search_opinions")).toBe(false);
      expect(isExplorerToolName("")).toBe(false);
      expect(isExplorerToolName("unknown")).toBe(false);
    });
  });

  describe("explorerTools", () => {
    it("exports 5 tool definitions in OpenAI format", () => {
      expect(explorerTools).toHaveLength(5);
      for (const tool of explorerTools) {
        expect(tool.type).toBe("function");
        expect(tool.function.name).toBeDefined();
        expect(tool.function.description).toBeDefined();
        expect(tool.function.parameters).toBeDefined();
      }
    });

    it("includes all expected tool names", () => {
      const names = explorerTools.map((t) => t.function.name);
      expect(names).toEqual([
        "get_stats",
        "search_nodes",
        "get_node",
        "get_neighbors",
        "find_similar",
      ]);
    });
  });

  describe("executeExplorerTool", () => {
    it("returns error for unknown tool name", async () => {
      const result = await executeExplorerTool("nonexistent", {});
      expect(JSON.parse(result)).toEqual({
        error: "Unknown explorer tool: nonexistent",
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("sends correct GraphQL query for get_stats", async () => {
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({
            data: { stats: { nodeCount: 100, edgeCount: 200 } },
          }),
      });

      const result = await executeExplorerTool("get_stats", {});
      const parsed = JSON.parse(result);
      expect(parsed.stats.nodeCount).toBe(100);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://test-explorer:3002/graphql",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.query).toContain("stats");
      expect(body.variables).toEqual({});
    });

    it("maps search_nodes variables correctly with defaults", async () => {
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({
            data: { nodes: { total: 1, nodes: [] } },
          }),
      });

      await executeExplorerTool("search_nodes", {
        search: "FOIA",
        type: "section",
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.variables).toEqual({
        search: "FOIA",
        type: "section",
        limit: 20,
        offset: 0,
      });
    });

    it("maps search_nodes with custom limit and offset", async () => {
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({
            data: { nodes: { total: 0, nodes: [] } },
          }),
      });

      await executeExplorerTool("search_nodes", {
        search: "court",
        limit: 5,
        offset: 10,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.variables.limit).toBe(5);
      expect(body.variables.offset).toBe(10);
    });

    it("maps get_node variables correctly", async () => {
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({
            data: { node: { id: 42, sourceText: "full text" } },
          }),
      });

      await executeExplorerTool("get_node", { id: 42 });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.variables).toEqual({ id: 42 });
    });

    it("maps get_neighbors variables correctly", async () => {
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({
            data: { neighbors: [] },
          }),
      });

      await executeExplorerTool("get_neighbors", { id: 99 });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.variables).toEqual({ id: 99 });
    });

    it("maps find_similar variables correctly", async () => {
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({
            data: { similar: [] },
          }),
      });

      await executeExplorerTool("find_similar", { id: 7, limit: 3 });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.variables).toEqual({ id: 7, limit: 3 });
    });

    it("find_similar omits limit when not provided", async () => {
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({
            data: { similar: [] },
          }),
      });

      await executeExplorerTool("find_similar", { id: 7 });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.variables).toEqual({ id: 7 });
    });

    it("returns GraphQL errors when present", async () => {
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({
            errors: [{ message: "Node not found" }],
          }),
      });

      const result = await executeExplorerTool("get_node", { id: 999 });
      const parsed = JSON.parse(result);
      expect(parsed.errors).toEqual([{ message: "Node not found" }]);
    });

    it("truncates sourceText in search_nodes results", async () => {
      const longText = "A".repeat(600);
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({
            data: {
              nodes: {
                total: 1,
                nodes: [{ id: 1, sourceText: longText }],
              },
            },
          }),
      });

      const result = await executeExplorerTool("search_nodes", {
        search: "test",
      });
      const parsed = JSON.parse(result);
      const text = parsed.nodes.nodes[0].sourceText;
      expect(text).toHaveLength(503); // 500 + "..."
      expect(text).toMatch(/\.\.\.$/);
    });

    it("does not truncate short sourceText in search_nodes", async () => {
      const shortText = "Short text";
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({
            data: {
              nodes: {
                total: 1,
                nodes: [{ id: 1, sourceText: shortText }],
              },
            },
          }),
      });

      const result = await executeExplorerTool("search_nodes", {
        search: "test",
      });
      const parsed = JSON.parse(result);
      expect(parsed.nodes.nodes[0].sourceText).toBe(shortText);
    });

    it("truncates sourceText in find_similar results", async () => {
      const longText = "B".repeat(600);
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({
            data: {
              similar: [{ score: 0.95, node: { id: 1, sourceText: longText } }],
            },
          }),
      });

      const result = await executeExplorerTool("find_similar", { id: 1 });
      const parsed = JSON.parse(result);
      expect(parsed.similar[0].node.sourceText).toHaveLength(503);
      expect(parsed.similar[0].node.sourceText).toMatch(/\.\.\.$/);
    });

    it("does NOT truncate sourceText for get_node (full text expected)", async () => {
      const longText = "C".repeat(600);
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({
            data: { node: { id: 1, sourceText: longText } },
          }),
      });

      const result = await executeExplorerTool("get_node", { id: 1 });
      const parsed = JSON.parse(result);
      expect(parsed.node.sourceText).toHaveLength(600);
    });

    it("uses configured EXPLORER_URL", async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ data: { stats: {} } }),
      });

      await executeExplorerTool("get_stats", {});

      expect(mockFetch).toHaveBeenCalledWith(
        "http://test-explorer:3002/graphql",
        expect.anything(),
      );
    });
  });

  describe("summarizeResult", () => {
    it("passes through small results unchanged without calling OpenAI", async () => {
      const smallData = { node: { id: 1, sourceText: "short" } };
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ data: smallData }),
      });

      const result = await executeExplorerTool("get_node", { id: 1 });
      expect(JSON.parse(result)).toEqual(smallData);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("summarizes large results via OpenAI", async () => {
      const longText = "X".repeat(5000);
      const largeData = { node: { id: 42, sourceText: longText, edges: [] } };
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ data: largeData }),
      });

      const summarized = JSON.stringify({
        node: { id: 42, summary: "Section about X", edges: [] },
      });
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: summarized } }],
      });

      const result = await executeExplorerTool("get_node", { id: 42 });
      expect(result).toBe(summarized);
      expect(mockCreate).toHaveBeenCalledOnce();
      expect(mockCreate.mock.calls[0][0].model).toBe("gpt-4o-mini");
    });

    it("falls back to raw JSON when API key is missing", async () => {
      mockGetConfig.mockImplementation((key: string) => {
        if (key === "EXPLORER_URL") return "http://test-explorer:3002";
        if (key === "OPENAI_API_KEY") return undefined;
        return undefined;
      });

      const longText = "Y".repeat(5000);
      const largeData = { node: { id: 1, sourceText: longText } };
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ data: largeData }),
      });

      const result = await executeExplorerTool("get_node", { id: 1 });
      expect(JSON.parse(result)).toEqual(largeData);
      expect(mockCreate).not.toHaveBeenCalled();

      // Restore default config mock
      mockGetConfig.mockImplementation((key: string) => {
        if (key === "EXPLORER_URL") return "http://test-explorer:3002";
        if (key === "OPENAI_API_KEY") return "test-key";
        if (key === "TEXT_MODEL_SMALL") return "gpt-4o-mini";
        return undefined;
      });
    });

    it("falls back to raw JSON when LLM returns empty content", async () => {
      const longText = "Z".repeat(5000);
      const largeData = { node: { id: 1, sourceText: longText } };
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ data: largeData }),
      });

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      const result = await executeExplorerTool("get_node", { id: 1 });
      expect(JSON.parse(result)).toEqual(largeData);
      expect(mockCreate).toHaveBeenCalledOnce();
    });
  });

  describe("isExplorerAvailable", () => {
    it("returns true when explorer responds with 200", async () => {
      mockFetch.mockResolvedValue({ ok: true });
      expect(await isExplorerAvailable()).toBe(true);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.query).toBe("{ __typename }");
    });

    it("returns false when explorer responds with non-200", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      expect(await isExplorerAvailable()).toBe(false);
    });

    it("returns false when fetch throws (connection refused)", async () => {
      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
      expect(await isExplorerAvailable()).toBe(false);
    });

    it("returns false on timeout", async () => {
      mockFetch.mockRejectedValue(new DOMException("Aborted", "AbortError"));
      expect(await isExplorerAvailable()).toBe(false);
    });
  });
});
