/**
 * Shared explorer tool definitions and executor for the Virginia law knowledge graph.
 * Used by both the chat handler and the research agent.
 */

import OpenAI from "openai";
import { getConfig } from "./config";

// Re-export the OpenAI-format tool definitions
export { tools as explorerTools } from "../../embeddings/explorer/openai-tools";

// --- GraphQL queries (from scenario.ts) ---

const QUERIES: Record<string, string> = {
  get_stats: `{
    stats {
      nodeCount edgeCount embeddingCount
      nodeTypes { type count }
      edgeTypes { type count }
    }
  }`,

  search_nodes: `query ($type: String, $search: String, $limit: Int, $offset: Int) {
    nodes(type: $type, search: $search, limit: $limit, offset: $offset) {
      total
      nodes { id source sourceId chunkIdx nodeType hasEmbedding sourceText }
    }
  }`,

  get_node: `query ($id: Int!) {
    node(id: $id) {
      id source sourceId chunkIdx nodeType hasEmbedding sourceText
      edges { fromId toId relType weight }
    }
  }`,

  get_neighbors: `query ($id: Int!) {
    neighbors(id: $id) {
      fromId toId relType weight
      fromNode { id source sourceId nodeType }
      toNode { id source sourceId nodeType }
    }
  }`,

  find_similar: `query ($id: Int!, $limit: Int) {
    similar(id: $id, limit: $limit) {
      score
      node { id source sourceId nodeType hasEmbedding sourceText }
    }
  }`,
};

// --- Explorer tool names ---

export const EXPLORER_TOOL_NAMES = [
  "get_stats",
  "search_nodes",
  "get_node",
  "get_neighbors",
  "find_similar",
] as const;

export type ExplorerToolName = (typeof EXPLORER_TOOL_NAMES)[number];

export function isExplorerToolName(name: string): name is ExplorerToolName {
  return EXPLORER_TOOL_NAMES.includes(name as ExplorerToolName);
}

// --- Helpers ---

function getExplorerUrl(): string {
  return getConfig("EXPLORER_URL") || "http://localhost:3002";
}

function truncateSourceText(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(truncateSourceText);
  if (typeof obj === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "sourceText" && typeof v === "string" && v.length > 500) {
        out[k] = v.slice(0, 500) + "...";
      } else {
        out[k] = truncateSourceText(v);
      }
    }
    return out;
  }
  return obj;
}

// --- Summarization ---

async function summarizeResult(
  toolName: string,
  rawJson: string,
): Promise<string> {
  if (rawJson.length <= 4000) return rawJson;

  const apiKey = getConfig("OPENAI_API_KEY");
  if (!apiKey) return rawJson;

  const openai = new OpenAI({
    apiKey,
    baseURL: getConfig("OPENAI_ENDPOINT"),
  });

  const response = await openai.chat.completions.create({
    model: getConfig("TEXT_MODEL_SMALL") || "gpt-4o-mini",
    max_tokens: 1024,
    messages: [
      {
        role: "system",
        content:
          "You are a concise legal data summarizer. Condense the following JSON tool result into a shorter but faithful summary. Preserve all node IDs, section numbers, citations, and relationship types. Drop verbose sourceText in favor of a one-line description of each section's topic. Return valid JSON.",
      },
      {
        role: "user",
        content: `Tool: ${toolName}\n\nResult:\n${rawJson.substring(0, 12000)}`,
      },
    ],
  });

  return response.choices[0]?.message?.content || rawJson;
}

// --- Executor ---

export async function executeExplorerTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const query = QUERIES[name];
  if (!query) return JSON.stringify({ error: `Unknown explorer tool: ${name}` });

  const variables: Record<string, unknown> = {};
  if (name === "search_nodes") {
    if (args.type) variables.type = args.type;
    if (args.search) variables.search = args.search;
    variables.limit = args.limit ?? 20;
    variables.offset = args.offset ?? 0;
  } else if (name === "get_node" || name === "get_neighbors") {
    variables.id = args.id;
  } else if (name === "find_similar") {
    variables.id = args.id;
    if (args.limit) variables.limit = args.limit;
  }

  const explorerUrl = getExplorerUrl();
  const res = await fetch(`${explorerUrl}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  const result = (await res.json()) as { data?: any; errors?: any[] };

  if (result.errors) {
    return JSON.stringify({ errors: result.errors });
  }

  // Truncate sourceText in search/similar results to prevent context blowup
  let json: string;
  if (name === "search_nodes" || name === "find_similar") {
    json = JSON.stringify(truncateSourceText(result.data));
  } else {
    json = JSON.stringify(result.data);
  }

  return summarizeResult(name, json);
}

// --- Health check ---

export async function isExplorerAvailable(): Promise<boolean> {
  try {
    const explorerUrl = getExplorerUrl();
    const res = await fetch(`${explorerUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ __typename }" }),
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
