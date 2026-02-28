import { describe, expect, it, vi } from "vitest";
import OpenAI from "openai";
import { optimizeToolDecisionContext } from "./chat-context-optimizer";

vi.mock("../config", () => ({
  getConfig: vi.fn((key: string) => {
    if (key === "TEXT_MODEL_SMALL") return "gpt-4o-mini";
    return "";
  }),
}));

describe("optimizeToolDecisionContext", () => {
  it("optimizes when user+assistant context exists", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "optimized custody query" } }],
    });
    const openai = {
      chat: { completions: { create: mockCreate } },
    } as unknown as OpenAI;
    const emitChatProcess = vi.fn();

    const result = await optimizeToolDecisionContext({
      openai,
      latestUserMessage: "Tell me more.",
      latestAssistantMessage: "Custody split definitions.",
      toolSemanticGuide: "Tool semantics:\n- SearchKnowledge: semantic retrieval",
      emitChatProcess,
    });

    expect(result.toolDecisionQuery).toBe("optimized custody query");
    expect(result.hasOptimizedToolContext).toBe(true);
    expect(emitChatProcess).toHaveBeenCalledWith(
      "tool-context-done",
      expect.any(String),
      expect.any(Object),
    );
  });

  it("skips optimization when assistant context missing", async () => {
    const openai = {
      chat: { completions: { create: vi.fn() } },
    } as unknown as OpenAI;
    const emitChatProcess = vi.fn();

    const result = await optimizeToolDecisionContext({
      openai,
      latestUserMessage: "Tell me more.",
      latestAssistantMessage: "",
      toolSemanticGuide: "Tool semantics",
      emitChatProcess,
    });

    expect(result.toolDecisionQuery).toBe("Tell me more.");
    expect(result.hasOptimizedToolContext).toBe(false);
    expect(emitChatProcess).toHaveBeenCalledWith(
      "tool-context-skipped",
      expect.any(String),
    );
  });
});
