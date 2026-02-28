import OpenAI from "openai";
import { optimizeToolDecisionContext } from "./chat-context-optimizer";
import { runChatToolLoop } from "./chat-tool-loop";
import type { ChatProcessStage } from "./chat-utils";

type ChatInputMessage = { role: string; content: string };

export const runToolSelectionPhase = async ({
  openai,
  messages,
  systemPrompt,
  tools,
  toolSemanticGuide,
  toolLabelMap,
  searchKnowledgeToolName,
  searchNodesToolName,
  latestUserMessage,
  latestAssistantMessage,
  executeTool,
  emitChatProcess,
}: {
  openai: OpenAI;
  messages: ChatInputMessage[];
  systemPrompt: string;
  tools: OpenAI.ChatCompletionTool[];
  toolSemanticGuide: string;
  toolLabelMap: Map<string, string>;
  searchKnowledgeToolName: string;
  searchNodesToolName: string | null;
  latestUserMessage: string;
  latestAssistantMessage: string;
  executeTool: (name: string, args: Record<string, unknown>) => Promise<string>;
  emitChatProcess: (
    stage: ChatProcessStage,
    message: string,
    data?: Record<string, unknown>,
  ) => void;
}): Promise<{
  toolMessages: OpenAI.ChatCompletionMessageParam[];
  collectedToolResults: { tool: string; result: string }[];
  toolDecisionQuery: string;
  forcedSearchKnowledge: boolean;
}> => {
  const { toolDecisionQuery, hasOptimizedToolContext } =
    await optimizeToolDecisionContext({
      openai,
      latestUserMessage,
      latestAssistantMessage,
      toolSemanticGuide,
      emitChatProcess,
    });

  const { toolMessages, collectedToolResults, forcedSearchKnowledge } =
    await runChatToolLoop({
      openai,
      messages,
      systemPrompt,
      tools,
      toolLabelMap,
      searchKnowledgeToolName,
      searchNodesToolName,
      toolDecisionQuery,
      hasOptimizedToolContext,
      latestUserMessage,
      executeTool,
      emitChatProcess,
    });

  return {
    toolMessages,
    collectedToolResults,
    toolDecisionQuery,
    forcedSearchKnowledge,
  };
};
