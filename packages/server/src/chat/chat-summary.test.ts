import { beforeEach, describe, expect, it, vi } from "vitest";
import OpenAI from "openai";
import { runToolSummaryPhase } from "./chat-summary";

const mockGetEmbeddingDim = vi.fn();
const mockSearchKnowledge = vi.fn();

vi.mock("../mcp-knowledge-client", () => ({
  getEmbeddingDim: (...args: unknown[]) => mockGetEmbeddingDim(...args),
  searchKnowledge: (...args: unknown[]) => mockSearchKnowledge(...args),
}));

vi.mock("../config", () => ({
  getConfig: vi.fn((key: string) => {
    if (key === "EMBEDDINGS_MODEL") return "octen-embedding-0.6b";
    if (key === "TEXT_MODEL_SMALL") return "gpt-4o-mini";
    return "";
  }),
}));

describe("runToolSummaryPhase", () => {
  beforeEach(() => {
    mockGetEmbeddingDim.mockReset();
    mockSearchKnowledge.mockReset();
  });

  it("returns model summary after grounding search", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '{"intent":"custody","confidence":"high"}' } }],
    });
    const openai = {
      chat: { completions: { create: mockCreate } },
    } as unknown as OpenAI;
    const embeddingsClient = {
      embeddings: {
        create: vi.fn().mockResolvedValue({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
      },
    } as unknown as OpenAI;
    mockGetEmbeddingDim.mockResolvedValue(3);
    mockSearchKnowledge.mockResolvedValue({
      answers: [
        {
          node_id: 1,
          source: "va-code",
          source_id: "20-124.3",
          node_type: "section",
          content: "Best interests standard",
          score: 0.88,
        },
      ],
      context: [],
    });
    const emitChatProcess = vi.fn();

    const summary = await runToolSummaryPhase({
      openai,
      embeddingsClient,
      emitChatProcess,
      collectedToolResults: [{ tool: "SearchKnowledge", result: '{"answers":[]}' }],
      latestUserMessage: "What is legal custody?",
      toolDecisionQuery: "legal custody in virginia",
      toolLabelMap: new Map([
        ["GetKnowledgeNNTopK3Chunks", "nearest legal text chunks for summary grounding"],
      ]),
    });

    expect(summary).toContain('"intent":"custody"');
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(emitChatProcess).toHaveBeenCalledWith(
      "tool-summary-start",
      expect.any(String),
      expect.any(Object),
    );
    expect(emitChatProcess).toHaveBeenCalledWith(
      "tool-summary-done",
      expect.any(String),
      expect.any(Object),
    );
  });

  it("falls back when summarization call fails", async () => {
    const openai = {
      chat: { completions: { create: vi.fn().mockRejectedValue(new Error("boom")) } },
    } as unknown as OpenAI;
    const embeddingsClient = {
      embeddings: {
        create: vi.fn().mockResolvedValue({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
      },
    } as unknown as OpenAI;
    mockGetEmbeddingDim.mockResolvedValue(3);
    mockSearchKnowledge.mockResolvedValue({ answers: [], context: [] });
    const emitChatProcess = vi.fn();

    const summary = await runToolSummaryPhase({
      openai,
      embeddingsClient,
      emitChatProcess,
      collectedToolResults: [],
      latestUserMessage: "question",
      toolDecisionQuery: "question",
      toolLabelMap: new Map(),
    });

    expect(summary).toBe("No tools were called in phase 1.");
    expect(emitChatProcess).toHaveBeenCalledWith(
      "tool-summary-failed",
      expect.any(String),
      expect.any(Object),
    );
  });
});
