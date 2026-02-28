import { describe, expect, it, vi } from "vitest";
import { executeToolCallAndRecord } from "./chat-tool-call-runner";

const mockBroadcast = vi.fn();

vi.mock("../broadcast", () => ({
  broadcast: (...args: unknown[]) => mockBroadcast(...args),
}));

describe("executeToolCallAndRecord", () => {
  it("executes, emits process events, and appends tool result", async () => {
    const toolMessages: Array<Record<string, unknown>> = [];
    const collectedToolResults: { tool: string; result: string }[] = [];
    const executeTool = vi.fn().mockResolvedValue(`{"ok":true}`);
    const emitChatProcess = vi.fn();

    const result = await executeToolCallAndRecord({
      toolName: "GetCases",
      toolCallId: "call_1",
      args: {},
      toolLabelMap: new Map([["GetCases", "list cases"]]),
      executeTool,
      emitChatProcess,
      toolMessages: toolMessages as never,
      collectedToolResults,
      iteration: 1,
    });

    expect(result).toBe(`{"ok":true}`);
    expect(executeTool).toHaveBeenCalledWith("GetCases", {});
    expect(collectedToolResults).toEqual([{ tool: "GetCases", result: `{"ok":true}` }]);
    expect(toolMessages).toHaveLength(1);
    expect(emitChatProcess).toHaveBeenCalledWith(
      "tool-call-start",
      expect.any(String),
      expect.any(Object),
    );
    expect(emitChatProcess).toHaveBeenCalledWith(
      "tool-call-done",
      expect.any(String),
      expect.any(Object),
    );
    expect(mockBroadcast).toHaveBeenCalled();
  });
});
