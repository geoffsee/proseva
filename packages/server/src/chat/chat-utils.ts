import OpenAI from "openai";

export type ChatProcessStage =
  | "request-start"
  | "tool-context-start"
  | "tool-context-done"
  | "tool-context-skipped"
  | "tool-context-failed"
  | "tool-loop-start"
  | "tool-iteration"
  | "tool-call-start"
  | "tool-call-done"
  | "force-tool"
  | "tool-loop-complete"
  | "tool-summary-start"
  | "tool-summary-tool-start"
  | "tool-summary-tool-done"
  | "tool-summary-done"
  | "tool-summary-failed"
  | "final-context-ready"
  | "final-generation-start"
  | "final-generation-done"
  | "error";

type ProcessSource = {
  source: string;
  source_id?: string;
  node_type?: string;
  score?: number;
  preview?: string;
};

export type SummaryChunk = {
  rank: number;
  node_id?: number;
  source: string;
  source_id?: string;
  node_type?: string;
  score: number;
  chunk_text: string;
  text_from_virginia_db?: boolean;
  text_source?: "explorer_graphql" | "sqlite_lookup" | "embedding_label";
};

export const previewText = (value: string, max = 160): string =>
  value.replace(/\s+/g, " ").trim().slice(0, max);

export const previewMessageContent = (
  content: OpenAI.ChatCompletionMessageParam["content"],
): string => {
  if (typeof content === "string") return previewText(content, 320);
  if (Array.isArray(content)) {
    return previewText(
      content
        .map((part) => {
          if (part.type === "text") return part.text ?? "";
          return `[${part.type}]`;
        })
        .join(" "),
      320,
    );
  }
  return "";
};

export const parseSearchNodesTotal = (raw: string): number | null => {
  try {
    const parsed = JSON.parse(raw) as {
      total?: unknown;
      nodes?: unknown;
    };
    if (typeof parsed?.total === "number" && Number.isFinite(parsed.total)) {
      return parsed.total;
    }
    if (
      parsed?.nodes &&
      typeof parsed.nodes === "object" &&
      !Array.isArray(parsed.nodes)
    ) {
      const legacy = parsed.nodes as { total?: unknown };
      if (
        typeof legacy.total === "number" &&
        Number.isFinite(legacy.total)
      ) {
        return legacy.total;
      }
    }
    if (Array.isArray(parsed?.nodes)) return parsed.nodes.length;
    return null;
  } catch {
    return null;
  }
};

const sanitizeToolDescription = (description: string | undefined): string => {
  if (!description) return "No description available.";
  const oneLine = description.replace(/\s+/g, " ").trim();
  if (!oneLine) return "No description available.";
  return oneLine.slice(0, 260);
};

export const buildToolSemanticGuide = (
  tools: OpenAI.ChatCompletionTool[],
): string => {
  const lines = tools
    .map((tool) => {
      if (tool.type !== "function") return null;
      const name = tool.function.name;
      const description = sanitizeToolDescription(tool.function.description);
      return `- ${name}: ${description}`;
    })
    .filter((line): line is string => line !== null);
  return `Tool semantics:\n${lines.join("\n")}`;
};

export const buildToolLabelMap = (
  tools: OpenAI.ChatCompletionTool[],
): Map<string, string> => {
  const labels = new Map<string, string>();
  for (const tool of tools) {
    if (tool.type !== "function") continue;
    const name = tool.function.name;
    const description = sanitizeToolDescription(tool.function.description);
    const phrase = description.split(/[.;:]/, 1)[0]?.trim();
    labels.set(name, phrase && phrase.length > 0 ? phrase : name);
  }
  labels.set(
    "GetKnowledgeNNTopK3Chunks",
    "nearest legal text chunks for summary grounding",
  );
  return labels;
};

export const toolUserLabel = (
  name: string,
  labels: Map<string, string>,
): string => {
  return labels.get(name) ?? name;
};

const hasTool = (tools: OpenAI.ChatCompletionTool[], name: string): boolean =>
  tools.some((tool) => tool.type === "function" && tool.function.name === name);

export const getFunctionToolNames = (
  tools: OpenAI.ChatCompletionTool[],
): Set<string> =>
  new Set(
    tools
      .filter(
        (
          tool,
        ): tool is OpenAI.ChatCompletionTool & { type: "function" } =>
          tool.type === "function",
      )
      .map((tool) => tool.function.name),
  );

const findToolNameByPrefix = (
  tools: OpenAI.ChatCompletionTool[],
  prefix: string,
): string | null => {
  const lowerPrefix = prefix.toLowerCase();
  for (const tool of tools) {
    if (tool.type !== "function") continue;
    if (tool.function.name.toLowerCase().startsWith(lowerPrefix)) {
      return tool.function.name;
    }
  }
  return null;
};

export const getSearchKnowledgeToolName = (
  tools: OpenAI.ChatCompletionTool[],
): string | null =>
  findToolNameByPrefix(tools, "searchknowledge") ??
  findToolNameByPrefix(tools, "search_knowledge");

export const getSearchNodesToolName = (
  tools: OpenAI.ChatCompletionTool[],
): string | null => findToolNameByPrefix(tools, "search_nodes");

export const buildKnowledgeSystemNote = (
  tools: OpenAI.ChatCompletionTool[],
): string => {
  const searchKnowledgeName = getSearchKnowledgeToolName(tools);
  const searchNodesName = getSearchNodesToolName(tools);
  const hasGetNode = hasTool(tools, "get_node");
  if (searchKnowledgeName && searchNodesName && hasGetNode) {
    return `You also have access to a Virginia law knowledge graph via MCP tools, including ${searchKnowledgeName}, ${searchNodesName}, and get_node. Prefer ${searchKnowledgeName} for semantic legal retrieval. ${searchNodesName} may return truncated text; use get_node for important sections.`;
  }
  if (searchKnowledgeName) {
    return `You also have access to a Virginia law knowledge graph via MCP tools. Prefer ${searchKnowledgeName} for semantic legal retrieval when legal questions are asked.`;
  }
  return "You also have access to legal knowledge tools via MCP. Prefer legal retrieval tools when legal questions are asked.";
};

const toFiniteScore = (value: unknown): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Number(value.toFixed(6));
};

const toProcessSourcesFromSearchKnowledge = (raw: string): ProcessSource[] => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    let items: unknown[];
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const structured = parsed as { answers?: unknown[] };
      items = Array.isArray(structured.answers) ? structured.answers : [];
    } else if (Array.isArray(parsed)) {
      items = parsed;
    } else {
      return [];
    }
    return items
      .slice(0, 5)
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const source = typeof row.source === "string" ? row.source : "";
        if (!source) return null;
        const sourceId =
          typeof row.source_id === "string" ? row.source_id : undefined;
        const nodeType =
          typeof row.node_type === "string" ? row.node_type : undefined;
        const content = typeof row.content === "string" ? row.content : "";
        return {
          source,
          source_id: sourceId,
          node_type: nodeType,
          score: toFiniteScore(row.score),
          preview: previewText(content, 120),
        } as ProcessSource;
      })
      .filter((row): row is ProcessSource => row !== null);
  } catch {
    return [];
  }
};

const toProcessSourcesFromSummaryChunks = (raw: string): ProcessSource[] => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .slice(0, 5)
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const source = typeof row.source === "string" ? row.source : "";
        if (!source) return null;
        const sourceId =
          typeof row.source_id === "string" ? row.source_id : undefined;
        const nodeType =
          typeof row.node_type === "string" ? row.node_type : undefined;
        const chunkText =
          typeof row.chunk_text === "string" ? row.chunk_text : "";
        return {
          source,
          source_id: sourceId,
          node_type: nodeType,
          score: toFiniteScore(row.score),
          preview: previewText(chunkText, 120),
        } as ProcessSource;
      })
      .filter((row): row is ProcessSource => row !== null);
  } catch {
    return [];
  }
};

export const parseSummaryChunks = (raw: string): SummaryChunk[] => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        if (
          typeof row.source !== "string" ||
          typeof row.chunk_text !== "string" ||
          typeof row.score !== "number"
        ) {
          return null;
        }
        return {
          rank:
            typeof row.rank === "number" && Number.isFinite(row.rank)
              ? row.rank
              : 0,
          node_id:
            typeof row.node_id === "number" && Number.isFinite(row.node_id)
              ? row.node_id
              : undefined,
          source: row.source,
          source_id:
            typeof row.source_id === "string" ? row.source_id : undefined,
          node_type:
            typeof row.node_type === "string" ? row.node_type : undefined,
          score: row.score,
          chunk_text: row.chunk_text,
          text_from_virginia_db:
            typeof row.text_from_virginia_db === "boolean"
              ? row.text_from_virginia_db
              : undefined,
          text_source:
            row.text_source === "explorer_graphql" ||
            row.text_source === "sqlite_lookup" ||
            row.text_source === "embedding_label"
              ? row.text_source
              : undefined,
        } as SummaryChunk;
      })
      .filter((row): row is SummaryChunk => row !== null);
  } catch {
    return [];
  }
};

export const buildToolProcessData = (
  toolName: string,
  result: string,
): Record<string, unknown> => {
  const normalizedTool = toolName.toLowerCase().replaceAll("_", "");
  const payload: Record<string, unknown> = {
    tool: toolName,
    result_len: result.length,
  };
  if (toolName === "search_nodes") {
    const total = parseSearchNodesTotal(result);
    if (typeof total === "number") payload.search_nodes_total = total;
  }
  if (normalizedTool === "searchknowledge") {
    const sources = toProcessSourcesFromSearchKnowledge(result);
    payload.sources = sources;
    payload.result_count = sources.length;
  }
  if (toolName === "GetKnowledgeNNTopK3Chunks") {
    const sources = toProcessSourcesFromSummaryChunks(result);
    const chunks = parseSummaryChunks(result);
    const sourceTextByOrigin = chunks.reduce<Record<string, number>>(
      (acc, chunk) => {
        const key = chunk.text_source ?? "unknown";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {},
    );
    payload.sources = sources;
    payload.result_count = sources.length;
    payload.source_text_resolved = chunks.filter(
      (chunk) => chunk.text_from_virginia_db,
    ).length;
    payload.source_text_by_origin = sourceTextByOrigin;
  }
  if (toolName === "get_node") {
    try {
      const parsed = JSON.parse(result) as
        | { node?: Record<string, unknown> }
        | Record<string, unknown>;
      const node =
        parsed && typeof parsed === "object" && "node" in parsed
          ? (parsed as { node?: Record<string, unknown> }).node
          : (parsed as Record<string, unknown>);
      if (node && typeof node === "object") {
        payload.node_id = node.id ?? node.node_id;
        payload.node_source = node.source;
        payload.node_source_id = node.sourceId ?? node.source_id;
        payload.node_type = node.nodeType ?? node.node_type;
        const sourceText =
          typeof node.sourceText === "string"
            ? node.sourceText
            : typeof node.source_text === "string"
              ? node.source_text
              : undefined;
        if (sourceText) {
          payload.node_text_preview = previewText(sourceText, 120);
        }
      }
    } catch {
      // best-effort metadata only
    }
  }
  return payload;
};

export const isLikelyLegalQuery = (text: string): boolean => {
  const normalized = text.toLowerCase();
  if (!normalized.trim()) return false;
  return /\b(virginia|code|statute|law|legal|custody|visitation|support|divorce|guardian|petition|motion|hearing|court|jurisdiction|best interests)\b/.test(
    normalized,
  );
};
