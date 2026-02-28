import { describe, expect, it, vi } from "vitest";
import OpenAI from "openai";
import { runChatToolLoop } from "./chat-tool-loop";

const mockBroadcast = vi.fn();

vi.mock("../broadcast", () => ({
  broadcast: (...args: unknown[]) => mockBroadcast(...args),
}));

vi.mock("../config", () => ({
  getConfig: vi.fn((key: string) => {
    if (key === "TEXT_MODEL_SMALL") return "gpt-4o-mini";
    return "";
  }),
}));

describe("runChatToolLoop", () => {
  it("forces SearchKnowledge for legal query when no tools are selected", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ finish_reason: "stop", message: { content: null, tool_calls: [] } }],
    });
    const openai = {
      chat: { completions: { create: mockCreate } },
    } as unknown as OpenAI;
    const executeTool = vi.fn().mockResolvedValue(`{"answers":[]}`);
    const emitChatProcess = vi.fn();

    const result = await runChatToolLoop({
      openai,
      messages: [{ role: "user", content: "What does Virginia code say about custody?" }],
      systemPrompt: "system",
      tools: [],
      toolLabelMap: new Map([["SearchKnowledge", "semantic retrieval"]]),
      searchKnowledgeToolName: "SearchKnowledge",
      searchNodesToolName: "search_nodes",
      toolDecisionQuery: "What does Virginia code say about custody?",
      hasOptimizedToolContext: false,
      latestUserMessage: "What does Virginia code say about custody?",
      executeTool,
      emitChatProcess,
    });

    expect(executeTool).toHaveBeenCalledWith("SearchKnowledge", {
      query: "What does Virginia code say about custody?",
      topK: 3,
    });
    expect(result.collectedToolResults).toHaveLength(1);
    expect(result.forcedSearchKnowledge).toBe(true);
    expect(mockBroadcast).toHaveBeenCalled();
  });
});
