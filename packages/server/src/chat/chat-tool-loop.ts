import OpenAI from "openai";
import { getConfig } from "../config";
import {
  isLikelyLegalQuery,
  parseSearchNodesTotal,
  previewText,
} from "./chat-utils";
import type { ChatProcessStage } from "./chat-utils";
import { executeToolCallAndRecord } from "./chat-tool-call-runner";
import { forceSearchKnowledgeToolCall } from "./chat-force-search-knowledge";

type ChatInputMessage = { role: string; content: string };

export const runChatToolLoop = async ({
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
}: {
  openai: OpenAI;
  messages: ChatInputMessage[];
  systemPrompt: string;
  tools: OpenAI.ChatCompletionTool[];
  toolLabelMap: Map<string, string>;
  searchKnowledgeToolName: string;
  searchNodesToolName: string | null;
  toolDecisionQuery: string;
  hasOptimizedToolContext: boolean;
  latestUserMessage: string;
  executeTool: (name: string, args: Record<string, unknown>) => Promise<string>;
  emitChatProcess: (
    stage: ChatProcessStage,
    message: string,
    data?: Record<string, unknown>,
  ) => void;
}): Promise<{
  toolMessages: OpenAI.ChatCompletionMessageParam[];
  collectedToolResults: { tool: string; result: string }[];
  forcedSearchKnowledge: boolean;
}> => {
  const latestUserPreview = previewText(toolDecisionQuery);
  const toolMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...(hasOptimizedToolContext
      ? ([
          {
            role: "system",
            content: `Tool-calling optimized context (prioritize this for tool selection): ${toolDecisionQuery}`,
          },
        ] as OpenAI.ChatCompletionMessageParam[])
      : []),
    ...messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];
  const collectedToolResults: { tool: string; result: string }[] = [];
  let consecutiveEmptySearchNodes = 0;
  let forcedSearchKnowledge = false;
  let sawSearchKnowledge = false;
  emitChatProcess("tool-loop-start", "Selecting and executing tools.", {
    max_iters: 10,
    user_query_preview: latestUserPreview,
  });
  console.info(
    `[chat][tool-decision] start user_query_len=${toolDecisionQuery.length} preview="${latestUserPreview}" max_iters=10`,
  );

  for (let i = 0; i < 10; i++) {
    const completion = await openai.chat.completions.create({
      model: getConfig("TEXT_MODEL_SMALL") || "gpt-4o-mini",
      messages: toolMessages,
      tools,
    });

    const choice = completion.choices[0];
    const calledTools = (choice.message.tool_calls ?? [])
      .filter((toolCall) => toolCall.type === "function")
      .map((toolCall) => toolCall.function.name);
    console.info(
      `[chat][tool-decision] iter=${i + 1} finish_reason=${choice.finish_reason ?? "<none>"} tool_calls=${calledTools.length} tools=${JSON.stringify(calledTools)}`,
    );
    emitChatProcess("tool-iteration", `Tool selection iteration ${i + 1} complete.`, {
      iteration: i + 1,
      finish_reason: choice.finish_reason ?? "<none>",
      tool_calls: calledTools.length,
      tools: calledTools,
    });

    if (choice.finish_reason === "tool_calls" || choice.message.tool_calls?.length) {
      toolMessages.push(choice.message);
      for (const toolCall of choice.message.tool_calls ?? []) {
        if (toolCall.type !== "function") continue;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        } catch {
          args = {};
        }
        console.info(
          `[chat][tool-decision] invoke tool=${toolCall.function.name} args=${JSON.stringify(args).slice(0, 500)}`,
        );
        const result = await executeToolCallAndRecord({
          toolName: toolCall.function.name,
          toolCallId: toolCall.id,
          args,
          toolLabelMap,
          executeTool,
          emitChatProcess,
          toolMessages,
          collectedToolResults,
          iteration: i + 1,
        });
        if (
          toolCall.function.name === searchKnowledgeToolName ||
          toolCall.function.name === "SearchKnowledge"
        ) {
          sawSearchKnowledge = true;
        }
        if (searchNodesToolName && toolCall.function.name === searchNodesToolName) {
          const total = parseSearchNodesTotal(result);
          if (total === 0) {
            consecutiveEmptySearchNodes += 1;
            console.info(
              `[chat][tool-decision] search_nodes_total=0 consecutive_empty=${consecutiveEmptySearchNodes}`,
            );
          } else if (typeof total === "number") {
            consecutiveEmptySearchNodes = 0;
          }
        }
      }

      if (
        !forcedSearchKnowledge &&
        !sawSearchKnowledge &&
        toolDecisionQuery.trim().length > 0 &&
        !!searchNodesToolName &&
        consecutiveEmptySearchNodes >= 2
      ) {
        console.info(
          `[chat][tool-decision] force_searchknowledge reason=search_nodes_empty_repeated consecutive_empty=${consecutiveEmptySearchNodes} query_len=${toolDecisionQuery.length}`,
        );
        await forceSearchKnowledgeToolCall({
          reason: "search_nodes_empty_repeated",
          reasonData: {
            consecutive_empty_search_nodes: consecutiveEmptySearchNodes,
          },
          announcement:
            "SearchKnowledge was forced after repeated empty lexical search results.",
          query: toolDecisionQuery,
          topK: 3,
          forcedToolCallId: `forced_searchknowledge_${i + 1}`,
          searchKnowledgeToolName,
          toolLabelMap,
          executeTool,
          emitChatProcess,
          toolMessages,
          collectedToolResults,
          iteration: i + 1,
        });
        forcedSearchKnowledge = true;
        sawSearchKnowledge = true;
        consecutiveEmptySearchNodes = 0;
      }
      continue;
    }

    console.info(
      `[chat][tool-decision] no_tool_call iter=${i + 1} finish_reason=${choice.finish_reason ?? "<none>"} ending_phase1=true`,
    );
    break;
  }

  if (collectedToolResults.length === 0 && isLikelyLegalQuery(latestUserMessage)) {
    await forceSearchKnowledgeToolCall({
      reason: "no_tool_calls_for_legal_query",
      announcement:
        "SearchKnowledge was forced because no tools were selected for a legal query.",
      query: latestUserMessage,
      topK: 3,
      forcedToolCallId: "forced_searchknowledge_no_tools",
      searchKnowledgeToolName,
      toolLabelMap,
      executeTool,
      emitChatProcess,
      toolMessages,
      collectedToolResults,
    });
    forcedSearchKnowledge = true;
  }

  console.info(
    `[chat][tool-decision] phase1_complete tool_calls_total=${collectedToolResults.length}`,
  );
  emitChatProcess("tool-loop-complete", "Tool execution phase completed.", {
    tool_calls_total: collectedToolResults.length,
    forced_search_knowledge: forcedSearchKnowledge,
  });

  return { toolMessages, collectedToolResults, forcedSearchKnowledge };
};
