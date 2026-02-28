import { previewText } from "./chat-utils";
import { executeToolCallAndRecord } from "./chat-tool-call-runner";
import type OpenAI from "openai";
import type { ChatProcessStage } from "./chat-utils";

export const forceSearchKnowledgeToolCall = async ({
  reason,
  reasonData,
  announcement,
  query,
  topK,
  forcedToolCallId,
  searchKnowledgeToolName,
  toolLabelMap,
  executeTool,
  emitChatProcess,
  toolMessages,
  collectedToolResults,
  iteration,
}: {
  reason: string;
  reasonData?: Record<string, unknown>;
  announcement: string;
  query: string;
  topK: number;
  forcedToolCallId: string;
  searchKnowledgeToolName: string;
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
}) => {
  const forcedArgs = { query, topK };
  emitChatProcess("force-tool", announcement, {
    reason,
    ...(reasonData ?? {}),
    query_preview: previewText(query),
  });
  toolMessages.push({
    role: "assistant",
    content: null,
    tool_calls: [
      {
        id: forcedToolCallId,
        type: "function",
        function: {
          name: searchKnowledgeToolName,
          arguments: JSON.stringify(forcedArgs),
        },
      },
    ],
  });
  await executeToolCallAndRecord({
    toolName: searchKnowledgeToolName,
    toolCallId: forcedToolCallId,
    args: forcedArgs,
    toolLabelMap,
    executeTool,
    emitChatProcess,
    toolMessages,
    collectedToolResults,
    iteration,
    forced: true,
  });
};
