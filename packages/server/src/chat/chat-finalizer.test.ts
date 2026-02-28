import { describe, expect, it, vi } from "vitest";
import OpenAI from "openai";
import { buildPhase2Messages, generateFinalChatReply } from "./chat-finalizer";

const mockBroadcast = vi.fn();

vi.mock("../broadcast", () => ({
  broadcast: (...args: unknown[]) => mockBroadcast(...args),
}));

vi.mock("../config", () => ({
  getConfig: vi.fn((key: string) => {
    if (key === "TEXT_MODEL_LARGE") return "gpt-4o";
    return "";
  }),
}));

describe("chat-finalizer", () => {
  it("builds phase2 messages with tool summary", () => {
    const messages = buildPhase2Messages({
      toolMessages: [{ role: "system", content: "base" }],
      toolRunSummary: '{"intent":"test"}',
    });
    expect(messages).toHaveLength(2);
    const last = messages[messages.length - 1];
    expect(last.role).toBe("system");
  });

  it("generates final reply and emits process updates", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "final answer" } }],
    });
    const openai = {
      chat: { completions: { create: mockCreate } },
    } as unknown as OpenAI;
    const emitChatProcess = vi.fn();

    const result = await generateFinalChatReply({
      openai,
      conversationMessages: [{ role: "user", content: "hi" }],
      emitChatProcess,
    });

    expect(result.reply).toBe("final answer");
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(emitChatProcess).toHaveBeenCalledWith(
      "final-generation-done",
      expect.any(String),
    );
    expect(mockBroadcast).toHaveBeenCalled();
  });
});
