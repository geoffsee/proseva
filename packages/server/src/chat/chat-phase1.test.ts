import { describe, expect, it, vi } from "vitest";
import OpenAI from "openai";
import { runToolSelectionPhase } from "./chat-phase1";

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

describe("runToolSelectionPhase", () => {
  it("forces SearchKnowledge when legal query gets no tool calls", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ finish_reason: "stop", message: { content: null, tool_calls: [] } }],
    });
    const openai = {
      chat: { completions: { create: mockCreate } },
    } as unknown as OpenAI;
    const executeTool = vi.fn().mockResolvedValue(`{"answers":[]}`);
    const emitChatProcess = vi.fn();

    const result = await runToolSelectionPhase({
      openai,
      messages: [{ role: "user", content: "What does Virginia code say about custody?" }],
      systemPrompt: "system",
      tools: [],
      toolSemanticGuide: "Tool semantics:\n- SearchKnowledge: semantic retrieval",
      toolLabelMap: new Map([["SearchKnowledge", "semantic retrieval"]]),
      searchKnowledgeToolName: "SearchKnowledge",
      searchNodesToolName: "search_nodes",
      latestUserMessage: "What does Virginia code say about custody?",
      latestAssistantMessage: "",
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
