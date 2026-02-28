import { broadcast } from "../broadcast";
import { buildToolProcessData, previewText, toolUserLabel } from "./chat-utils";
import type { ChatProcessStage } from "./chat-utils";
import type OpenAI from "openai";

export const executeToolCallAndRecord = async ({
  toolName,
  toolCallId,
  args,
  toolLabelMap,
  executeTool,
  emitChatProcess,
  toolMessages,
  collectedToolResults,
  iteration,
  forced = false,
}: {
  toolName: string;
  toolCallId: string;
  args: Record<string, unknown>;
  toolLabelMap: Map<string, string>;
  executeTool: (name: string, args: Record<string, unknown>) => Promise<string>;
  emitChatProcess: (
    stage: ChatProcessStage,
    message: string,
    data?: Record<string, unknown>,
  ) => void;
  toolMessages: OpenAI.ChatCompletionMessageParam[];
  collectedToolResults: { tool: string; result: string }[];
  iteration?: number;
  forced?: boolean;
}): Promise<string> => {
  const startData: Record<string, unknown> = {
    tool: toolName,
    args_preview: previewText(JSON.stringify(args), 180),
  };
  if (typeof iteration === "number") startData.iteration = iteration;
  if (forced) startData.forced = true;
  emitChatProcess(
    "tool-call-start",
    `Running ${toolUserLabel(toolName, toolLabelMap)}.`,
    startData,
  );
  broadcast("activity-status", {
    source: "chat",
    phase: "tool-start",
    tool: toolName,
  });
  const result = await executeTool(toolName, args);
  broadcast("activity-status", {
    source: "chat",
    phase: "tool-done",
    tool: toolName,
  });
  const resultPreview = previewText(result, 240);
  const forcedPart = forced ? " forced=true" : "";
  console.info(
    `[chat][tool-decision] tool_result tool=${toolName}${forcedPart} result_len=${result.length} preview="${resultPreview}"`,
  );
  const doneData: Record<string, unknown> = {
    ...buildToolProcessData(toolName, result),
  };
  if (typeof iteration === "number") doneData.iteration = iteration;
  if (forced) doneData.forced = true;
  emitChatProcess(
    "tool-call-done",
    `${toolUserLabel(toolName, toolLabelMap)} completed.`,
    doneData,
  );
  collectedToolResults.push({ tool: toolName, result });
  toolMessages.push({
    role: "tool",
    tool_call_id: toolCallId,
    content: result,
  });
  return result;
};
