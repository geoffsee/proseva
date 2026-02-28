import OpenAI from "openai";
import { db } from "../db";
import { getConfig } from "../config";
import { broadcast } from "../broadcast";
import { getKnowledgeTools } from "../mcp-knowledge-client";
import { getCaseTools } from "../mcp-case-client";
import { getChatSystemPrompt } from "../prompts";
import { analyzeCaseGraph, compressCaseGraphForPrompt } from "./chat-graph";
import {
  runDeterministicGraphOrchestration,
  shouldUseDeterministicGraphFlow,
} from "./chat-graphql-orchestrator";
import {
  buildKnowledgeSystemNote,
  buildToolLabelMap,
  buildToolSemanticGuide,
  getFunctionToolNames,
  getSearchKnowledgeToolName,
  getSearchNodesToolName,
  isLikelyLegalQuery,
  previewText,
} from "./chat-utils";
import { createExecuteTool } from "./chat-tool-executor";
import { runToolSummaryPhase } from "./chat-summary";
import { buildPhase2Messages, generateFinalChatReply } from "./chat-finalizer";
import { runToolSelectionPhase } from "./chat-phase1";
import type { ChatProcessStage } from "./chat-utils";

type ChatInputMessage = { role: string; content: string };

export const handleChat = async (messages: ChatInputMessage[]) => {
  const openai = new OpenAI({
    apiKey: getConfig("OPENAI_API_KEY"),
    baseURL: getConfig("OPENAI_ENDPOINT"),
  });
  const embeddingsEndpoint = getConfig("EMBEDDINGS_ENDPOINT");
  console.info(`[chat] embeddingsClient baseURL=${embeddingsEndpoint}`);
  const embeddingsClient = new OpenAI({
    apiKey: getConfig("OPENAI_API_KEY") || "unused",
    baseURL: embeddingsEndpoint,
  });

  const caseTools = await getCaseTools();
  const knowledgeTools = await getKnowledgeTools();
  const tools: OpenAI.ChatCompletionTool[] = [...caseTools, ...knowledgeTools];
  const toolLabelMap = buildToolLabelMap(tools);
  const toolSemanticGuide = buildToolSemanticGuide(tools);
  const caseToolNames = getFunctionToolNames(caseTools);
  const knowledgeToolNames = getFunctionToolNames(knowledgeTools);
  const searchKnowledgeToolName =
    getSearchKnowledgeToolName(knowledgeTools) ?? "SearchKnowledge";
  const searchNodesToolName = getSearchNodesToolName(knowledgeTools);

  const baseSystemPrompt = getChatSystemPrompt();
  const knowledgeSystemNote = buildKnowledgeSystemNote(knowledgeTools);
  const documentEntries = [...db.documents.values()];
  const graphSnapshotText = (() => {
    try {
      const graphAnalysis = analyzeCaseGraph(
        {
          cases: [...db.cases.values()],
          deadlines: [...db.deadlines.values()],
          contacts: [...db.contacts.values()],
          filings: [...db.filings.values()],
          evidences: [...db.evidences.values()],
          notes: [...db.notes.values()],
          documents: documentEntries,
        },
        { topK: 10 },
      );
      const compressedGraph = compressCaseGraphForPrompt(graphAnalysis, {
        maxCases: 4,
        maxNodes: 6,
      });
      return JSON.stringify(compressedGraph);
    } catch (error) {
      console.warn("[chat] Graph bootstrap failed", error);
      return JSON.stringify({ warning: "Graph context unavailable" });
    }
  })();
  const systemPrompt = `${baseSystemPrompt}

Graph context bootstrap (compressed JSON snapshot):
${graphSnapshotText}

Treat this snapshot as baseline context for case connectivity and bottlenecks. Use tools for exact record-level lookups when needed.

${knowledgeSystemNote}`;

  const executeTool = createExecuteTool({
    embeddingsClient,
    caseToolNames,
    knowledgeToolNames,
    searchKnowledgeToolName,
  });

  const chatRunId = `chat_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const emitChatProcess = (
    stage: ChatProcessStage,
    message: string,
    data?: Record<string, unknown>,
  ) => {
    broadcast("chat-process", {
      source: "chat",
      runId: chatRunId,
      stage,
      message,
      at: new Date().toISOString(),
      data,
    });
  };

  const latestUserMessage =
    [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const latestAssistantMessage =
    [...messages].reverse().find((m) => m.role === "assistant")?.content ?? "";
  emitChatProcess("request-start", "Received your request. Preparing retrieval plan.", {
    message_count: messages.length,
    latest_user_len: latestUserMessage.length,
    latest_user_preview: previewText(latestUserMessage),
  });

  if (shouldUseDeterministicGraphFlow() && isLikelyLegalQuery(latestUserMessage)) {
    console.info(`[chat][graph-flow] enabled=true query_len=${latestUserMessage.length}`);
    try {
      const graphResult = await runDeterministicGraphOrchestration({
        openai,
        embeddingsClient,
        systemPrompt,
        messages,
        latestUserMessage,
        latestAssistantMessage,
        emitChatProcess,
      });
      if (graphResult.used) {
        return await generateFinalChatReply({
          openai,
          conversationMessages: graphResult.conversationMessages,
          emitChatProcess,
        });
      }
      emitChatProcess("error", "Deterministic graph orchestration produced no result.", {
        deterministic_graph_flow: true,
      });
      return {
        reply: "I could not complete deterministic legal retrieval for this request.",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[chat][graph-flow] failed terminal=true error=${message}`);
      emitChatProcess("error", "Deterministic graph orchestration failed.", {
        error: message,
        deterministic_graph_flow: true,
      });
      return {
        reply: "I could not complete deterministic legal retrieval for this request.",
      };
    }
  }

  const { toolMessages, collectedToolResults, toolDecisionQuery } =
    await runToolSelectionPhase({
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
    });

  const toolRunSummary = await runToolSummaryPhase({
    openai,
    embeddingsClient,
    emitChatProcess,
    collectedToolResults,
    latestUserMessage,
    toolDecisionQuery,
    toolLabelMap,
  });

  const conversationMessages = buildPhase2Messages({
    toolMessages,
    toolRunSummary,
  });
  return await generateFinalChatReply({
    openai,
    conversationMessages,
    emitChatProcess,
  });
};
