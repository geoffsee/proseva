import { beforeEach, describe, expect, it, vi } from "vitest";
import OpenAI from "openai";
import { createExecuteTool } from "./chat-tool-executor";

const mockCallCaseTool = vi.fn();
const mockCallKnowledgeTool = vi.fn();
const mockGetEmbeddingDim = vi.fn();
const mockSearchKnowledge = vi.fn();

vi.mock("../mcp-case-client", () => ({
  callCaseTool: (...args: unknown[]) => mockCallCaseTool(...args),
}));

vi.mock("../mcp-knowledge-client", () => ({
  callKnowledgeTool: (...args: unknown[]) => mockCallKnowledgeTool(...args),
  getEmbeddingDim: (...args: unknown[]) => mockGetEmbeddingDim(...args),
  searchKnowledge: (...args: unknown[]) => mockSearchKnowledge(...args),
}));

vi.mock("../config", () => ({
  getConfig: vi.fn((key: string) => {
    if (key === "EMBEDDINGS_MODEL") return "octen-embedding-0.6b";
    return "";
  }),
}));

describe("createExecuteTool", () => {
  beforeEach(() => {
    mockCallCaseTool.mockReset();
    mockCallKnowledgeTool.mockReset();
    mockGetEmbeddingDim.mockReset();
    mockSearchKnowledge.mockReset();
  });

  it("routes case tools to callCaseTool", async () => {
    mockCallCaseTool.mockResolvedValue(`{"ok":true}`);
    const embeddingsClient = {
      embeddings: { create: vi.fn() },
    } as unknown as OpenAI;
    const executeTool = createExecuteTool({
      embeddingsClient,
      caseToolNames: new Set(["GetCases"]),
      knowledgeToolNames: new Set(["get_node"]),
      searchKnowledgeToolName: "SearchKnowledge",
    });

    const result = await executeTool("GetCases", {});
    expect(result).toBe(`{"ok":true}`);
    expect(mockCallCaseTool).toHaveBeenCalledWith("GetCases", {});
  });

  it("routes knowledge tools to callKnowledgeTool", async () => {
    mockCallKnowledgeTool.mockResolvedValue(`{"id":42}`);
    const embeddingsClient = {
      embeddings: { create: vi.fn() },
    } as unknown as OpenAI;
    const executeTool = createExecuteTool({
      embeddingsClient,
      caseToolNames: new Set(["GetCases"]),
      knowledgeToolNames: new Set(["get_node"]),
      searchKnowledgeToolName: "SearchKnowledge",
    });

    const result = await executeTool("get_node", { id: 42 });
    expect(result).toBe(`{"id":42}`);
    expect(mockCallKnowledgeTool).toHaveBeenCalledWith("get_node", { id: 42 });
  });

  it("executes SearchKnowledge via embeddings + MCP search", async () => {
    const mockEmbeddingsCreate = vi
      .fn()
      .mockResolvedValue({ data: [{ embedding: [0.1, 0.2, 0.3] }] });
    mockGetEmbeddingDim.mockResolvedValue(3);
    mockSearchKnowledge.mockResolvedValue({
      answers: [
        {
          source: "va-code",
          score: 0.9,
          content: "text",
        },
      ],
      context: [],
    });
    const embeddingsClient = {
      embeddings: { create: mockEmbeddingsCreate },
    } as unknown as OpenAI;
    const executeTool = createExecuteTool({
      embeddingsClient,
      caseToolNames: new Set(["GetCases"]),
      knowledgeToolNames: new Set(["get_node"]),
      searchKnowledgeToolName: "SearchKnowledge",
    });

    const result = await executeTool("SearchKnowledge", {
      query: "custody",
      topK: 3,
    });

    expect(mockEmbeddingsCreate).toHaveBeenCalled();
    expect(mockSearchKnowledge).toHaveBeenCalledWith(
      [0.1, 0.2, 0.3],
      "custody",
      3,
    );
    expect(JSON.parse(result)).toMatchObject({ answers: expect.any(Array) });
  });

  it("returns unknown tool for unsupported names", async () => {
    const embeddingsClient = {
      embeddings: { create: vi.fn() },
    } as unknown as OpenAI;
    const executeTool = createExecuteTool({
      embeddingsClient,
      caseToolNames: new Set(["GetCases"]),
      knowledgeToolNames: new Set(["get_node"]),
      searchKnowledgeToolName: "SearchKnowledge",
    });

    const result = await executeTool("NotARealTool", {});
    expect(JSON.parse(result)).toEqual({ error: "Unknown tool" });
  });
});
