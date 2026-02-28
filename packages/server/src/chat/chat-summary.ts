import OpenAI from "openai";
import { getConfig } from "../config";
import { getEmbeddingDim, searchKnowledge } from "../mcp-knowledge-client";
import {
  buildToolProcessData,
  parseSummaryChunks,
  previewText,
  toolUserLabel,
} from "./chat-utils";
import type { ChatProcessStage, SummaryChunk } from "./chat-utils";

const parseStringArg = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseNumberArg = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const createExecuteSummaryTool = (embeddingsClient: OpenAI) => {
  return async (
    name: string,
    args: Record<string, unknown>,
  ): Promise<string> => {
    if (name !== "GetKnowledgeNNTopK3Chunks") {
      return JSON.stringify({ error: `Unknown summary tool: ${name}` });
    }
    try {
      const query = parseStringArg(args.query);
      if (!query) {
        return JSON.stringify({ error: "query is required" });
      }
      const topK = parseNumberArg(args.topK) ?? 3;
      const embeddingsModel = getConfig("EMBEDDINGS_MODEL") || "octen-embedding-0.6b";
      const targetDim = await getEmbeddingDim();
      if (targetDim <= 0) return JSON.stringify([]);

      const embResponse = await embeddingsClient.embeddings.create({
        model: embeddingsModel,
        input: query,
        encoding_format: "float",
      });
      const queryVec = embResponse.data[0].embedding;
      if (queryVec.length !== targetDim) return JSON.stringify([]);

      const result = await searchKnowledge(queryVec, query, topK);
      const chunks = result.answers.map((a, idx) => ({
        rank: idx + 1,
        node_id: a.node_id,
        source: a.source,
        source_id: a.source_id,
        node_type: a.node_type,
        score: a.score,
        chunk_text: a.content,
        text_from_virginia_db: true,
        text_source: "sqlite_lookup" as const,
      }));

      console.info(
        `[chat][tool-summary] nn_topk3 query_len=${query.length} topK=${topK} chunks=${chunks.length}`,
      );
      return JSON.stringify(chunks);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify({ error: `GetKnowledgeNNTopK3Chunks failed: ${message}` });
    }
  };
};

export const runToolSummaryPhase = async ({
  openai,
  embeddingsClient,
  emitChatProcess,
  collectedToolResults,
  latestUserMessage,
  toolDecisionQuery,
  toolLabelMap,
}: {
  openai: OpenAI;
  embeddingsClient: OpenAI;
  emitChatProcess: (
    stage: ChatProcessStage,
    message: string,
    data?: Record<string, unknown>,
  ) => void;
  collectedToolResults: { tool: string; result: string }[];
  latestUserMessage: string;
  toolDecisionQuery: string;
  toolLabelMap: Map<string, string>;
}): Promise<string> => {
  const executeSummaryTool = createExecuteSummaryTool(embeddingsClient);
  let toolRunSummary = "No tools were called in phase 1.";
  try {
    emitChatProcess("tool-summary-start", "Summarizing tool results.", {
      tool_calls_total: collectedToolResults.length,
    });
    console.info(
      `[chat][tool-summary] start tool_calls_total=${collectedToolResults.length}`,
    );
    const summaryGroundingQuery =
      latestUserMessage.trim().length > 0 ? latestUserMessage : toolDecisionQuery;
    const summaryGroundingArgs = { query: summaryGroundingQuery, topK: 3 };
    emitChatProcess(
      "tool-summary-tool-start",
      `Running ${toolUserLabel("GetKnowledgeNNTopK3Chunks", toolLabelMap)} for summary grounding.`,
      {
        tool: "GetKnowledgeNNTopK3Chunks",
        args_preview: previewText(JSON.stringify(summaryGroundingArgs), 180),
      },
    );
    const summaryGroundingResult = await executeSummaryTool(
      "GetKnowledgeNNTopK3Chunks",
      summaryGroundingArgs,
    );
    const summaryGroundingChunks = parseSummaryChunks(summaryGroundingResult);
    const groundedChunkCount = summaryGroundingChunks.length;
    const sourceTextResolved = summaryGroundingChunks.filter(
      (chunk) => chunk.text_from_virginia_db,
    ).length;
    const sourceTextByOrigin = summaryGroundingChunks.reduce<
      Record<string, number>
    >((acc, chunk) => {
      const key = chunk.text_source ?? "unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    emitChatProcess(
      "tool-summary-tool-done",
      `${toolUserLabel("GetKnowledgeNNTopK3Chunks", toolLabelMap)} completed for summary grounding.`,
      {
        ...buildToolProcessData("GetKnowledgeNNTopK3Chunks", summaryGroundingResult),
        query_preview: previewText(summaryGroundingQuery, 120),
        grounded_chunk_count: groundedChunkCount,
        source_text_resolved: sourceTextResolved,
        source_text_by_origin: sourceTextByOrigin,
      },
    );
    console.info(
      `[chat][tool-summary] grounding_chunks query_len=${summaryGroundingQuery.length} count=${groundedChunkCount} source_text_resolved=${sourceTextResolved} source_text_by_origin=${JSON.stringify(sourceTextByOrigin)}`,
    );
    const toolSummaryInput = {
      optimizedToolDecisionQuery: toolDecisionQuery,
      originalLatestUserMessage: latestUserMessage,
      toolCalls: collectedToolResults.map((entry, idx) => ({
        order: idx + 1,
        tool: entry.tool,
        result: entry.result,
      })),
      summaryGroundingQuery,
      summaryGroundingChunks: summaryGroundingChunks.map((chunk: SummaryChunk) => ({
        ...chunk,
        chunk_text: previewText(chunk.chunk_text, 1200),
      })),
    };
    const summaryMessages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "Summarize completed tool-calling outcomes for downstream final response generation. Keep it short and factual. Return compact JSON with keys: intent, key_findings, legal_chunks, gaps, confidence. legal_chunks must come from summaryGroundingChunks when available and include real text excerpts, not placeholder labels.",
      },
      {
        role: "user",
        content: `Summarize this completed tool run as compact JSON with keys: intent, key_findings, legal_chunks, gaps, confidence.\n\n${JSON.stringify(toolSummaryInput).slice(0, 16000)}`,
      },
    ];
    const toolSummaryCompletion = await openai.chat.completions.create({
      model: getConfig("TEXT_MODEL_SMALL") || "gpt-4o-mini",
      messages: summaryMessages,
    });
    const summary = toolSummaryCompletion.choices[0]?.message?.content?.trim() ?? "";
    if (summary.length > 0) {
      toolRunSummary = summary;
    }
    console.info(
      `[chat][tool-summary] done summary_len=${toolRunSummary.length} preview="${previewText(toolRunSummary, 240)}"`,
    );
    emitChatProcess("tool-summary-done", "Tool summary prepared.", {
      summary_len: toolRunSummary.length,
      summary_preview: previewText(toolRunSummary, 240),
      summary_text: toolRunSummary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[chat][tool-summary] failed fallback_used=true error=${message}`);
    emitChatProcess(
      "tool-summary-failed",
      "Tool summary failed. Proceeding without summary enhancement.",
      { error: message },
    );
  }
  return toolRunSummary;
};
