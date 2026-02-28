import OpenAI from "openai";
import { getConfig } from "../config";
import {
  callKnowledgeTool,
  getEmbeddingDim,
  searchKnowledge,
} from "../mcp-knowledge-client";
import { callCaseTool } from "../mcp-case-client";

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

export const createExecuteTool = ({
  embeddingsClient,
  caseToolNames,
  knowledgeToolNames,
  searchKnowledgeToolName,
}: {
  embeddingsClient: OpenAI;
  caseToolNames: Set<string>;
  knowledgeToolNames: Set<string>;
  searchKnowledgeToolName: string;
}) => {
  return async (name: string, args: Record<string, unknown>): Promise<string> => {
    if (caseToolNames.has(name)) {
      return await callCaseTool(name, args);
    }

    if (name === searchKnowledgeToolName || name === "SearchKnowledge") {
      try {
        const query =
          parseStringArg(args.query) ?? parseStringArg(args.query_text);
        if (!query) {
          return JSON.stringify({ error: "Query is required" });
        }
        const topK = parseNumberArg(args.topK) ?? parseNumberArg(args.top_k) ?? 3;
        const embeddingsModel =
          getConfig("EMBEDDINGS_MODEL") || "octen-embedding-0.6b";
        const targetDim = await getEmbeddingDim();
        console.info(
          `[chat][SearchKnowledge] query_len=${query.length} topK=${topK} model=${embeddingsModel} target_dim=${targetDim}`,
        );
        if (targetDim <= 0) {
          console.warn(
            "[chat][SearchKnowledge] Could not determine embedding dimension from MCP server",
          );
          return JSON.stringify([]);
        }
        const embResponse = await embeddingsClient.embeddings.create({
          model: embeddingsModel,
          input: query,
          encoding_format: "float",
        });
        const queryVec = embResponse.data[0].embedding;
        if (queryVec.length !== targetDim) {
          console.error(
            `[chat][SearchKnowledge] Dimension mismatch query_dim=${queryVec.length} target_dim=${targetDim}`,
          );
          return JSON.stringify({
            error: `Knowledge embedding dimension mismatch (query=${queryVec.length}, corpus=${targetDim})`,
          });
        }

        const result = await searchKnowledge(queryVec, query, topK);
        const resultDetails = result.answers.map((row, idx) => ({
          rank: idx + 1,
          source: row.source,
          score: Number(row.score.toFixed(6)),
          content_preview: row.content.replace(/\s+/g, " ").slice(0, 120),
        }));
        console.info(
          `[chat][SearchKnowledge] returning answers=${result.answers.length} context=${result.context.length} topK=${topK} results=${JSON.stringify(resultDetails)}`,
        );
        return JSON.stringify(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[chat][SearchKnowledge] failed: ${message}`);
        return JSON.stringify({ error: "Knowledge search failed" });
      }
    }

    if (knowledgeToolNames.has(name)) {
      return await callKnowledgeTool(name, args);
    }

    return JSON.stringify({ error: "Unknown tool" });
  };
};
