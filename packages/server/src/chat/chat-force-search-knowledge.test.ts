import { describe, expect, it, vi } from "vitest";
import { forceSearchKnowledgeToolCall } from "./chat-force-search-knowledge";

vi.mock("./chat-tool-call-runner", () => ({
  executeToolCallAndRecord: vi.fn().mockResolvedValue(`{"answers":[]}`),
}));

describe("forceSearchKnowledgeToolCall", () => {
  it("emits force event, injects assistant tool_call, and delegates execution", async () => {
    const emitChatProcess = vi.fn();
    const toolMessages: Array<Record<string, unknown>> = [];
    const collectedToolResults: { tool: string; result: string }[] = [];
    const executeTool = vi.fn();

    await forceSearchKnowledgeToolCall({
      reason: "no_tool_calls_for_legal_query",
      announcement: "forcing semantic",
      query: "custody law",
      topK: 3,
      forcedToolCallId: "forced_1",
      searchKnowledgeToolName: "SearchKnowledge",
      toolLabelMap: new Map([["SearchKnowledge", "semantic retrieval"]]),
      executeTool,
      emitChatProcess,
      toolMessages: toolMessages as never,
      collectedToolResults,
    });

    expect(emitChatProcess).toHaveBeenCalledWith(
      "force-tool",
      "forcing semantic",
      expect.objectContaining({ reason: "no_tool_calls_for_legal_query" }),
    );
    expect(toolMessages).toHaveLength(1);
    const assistant = toolMessages[0] as {
      role: string;
      tool_calls?: Array<{ function: { name: string } }>;
    };
    expect(assistant.role).toBe("assistant");
    expect(assistant.tool_calls?.[0]?.function.name).toBe("SearchKnowledge");
  });
});
