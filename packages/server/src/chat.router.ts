import { AutoRouter } from "itty-router";
import { join, resolve } from "path";
import { existsSync } from "node:fs";
import { readFile } from "fs/promises";
import { Database as SqliteDatabase } from "bun:sqlite";
import OpenAI from "openai";
import { db } from "./db";
import { getConfig } from "./config";
import { broadcast } from "./broadcast";
import {
  cosine_similarity_dataspace,
} from "./wasm-similarity-init";
import { getChatSystemPrompt } from "./prompts";
import { analyzeCaseGraph, compressCaseGraphForPrompt } from "./chat-graph";
import {
  explorerTools,
  executeExplorerTool,
  isExplorerToolName,
} from "./explorer-tools";
import {
  runDeterministicGraphOrchestration,
  shouldUseDeterministicGraphFlow,
} from "./chat-graphql-orchestrator";
import { asIttyRoute, openapiFormat } from "./openapi";

const __dir =
  import.meta.dir ??
  import.meta.dirname ??
  new URL(".", import.meta.url).pathname;

const appRoot = process.env.PROSEVA_DATA_DIR ?? join(__dir, "../..");
type SearchEmbeddingRecord = {
  nodeId?: number;
  source: string;
  sourceId?: string;
  nodeType?: string;
  content: string;
  embedding: number[];
};

const previewText = (value: string, max = 160): string =>
  value.replace(/\s+/g, " ").trim().slice(0, max);

const previewMessageContent = (
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

const parseSearchNodesTotal = (raw: string): number | null => {
  try {
    const parsed = JSON.parse(raw) as {
      nodes?: { total?: unknown };
    };
    const total = parsed?.nodes?.total;
    return typeof total === "number" && Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
};

const stripHtmlAndNormalize = (value: string): string =>
  value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

type ChatProcessStage =
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

type SummaryChunk = {
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

const toFiniteScore = (value: unknown): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Number(value.toFixed(6));
};

const toProcessSourcesFromSearchKnowledge = (raw: string): ProcessSource[] => {
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

const parseSummaryChunks = (raw: string): SummaryChunk[] => {
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

const buildToolProcessData = (
  toolName: string,
  result: string,
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    tool: toolName,
    result_len: result.length,
  };
  if (toolName === "search_nodes") {
    const total = parseSearchNodesTotal(result);
    if (typeof total === "number") payload.search_nodes_total = total;
  }
  if (toolName === "SearchKnowledge") {
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
      const parsed = JSON.parse(result) as { node?: Record<string, unknown> };
      const node = parsed?.node;
      if (node && typeof node === "object") {
        payload.node_id = node.id;
        payload.node_source = node.source;
        payload.node_source_id = node.sourceId;
        payload.node_type = node.nodeType;
        if (typeof node.sourceText === "string") {
          payload.node_text_preview = previewText(node.sourceText, 120);
        }
      }
    } catch {
      // best-effort metadata only
    }
  }
  return payload;
};

const toolUserLabel = (name: string): string => {
  const labels: Record<string, string> = {
    GetCases: "case records",
    GetDeadlines: "deadlines",
    GetContacts: "contacts",
    GetFinances: "financial records",
    GetDocuments: "document index",
    GetDocumentText: "document text",
    SearchTimeline: "timeline events",
    SearchKnowledge: "legal knowledge",
    get_stats: "knowledge graph stats",
    search_nodes: "legal node candidates",
    get_node: "legal node details",
    get_neighbors: "related legal nodes",
    find_similar: "similar legal nodes",
    GetKnowledgeNNTopK3Chunks: "nearest legal text chunks",
  };
  return labels[name] ?? name;
};

const isLikelyLegalQuery = (text: string): boolean => {
  const normalized = text.toLowerCase();
  if (!normalized.trim()) return false;
  return /\b(virginia|code|statute|law|legal|custody|visitation|support|divorce|guardian|petition|motion|hearing|court|jurisdiction|best interests)\b/.test(
    normalized,
  );
};

let datasetEmbeddingsCache:
  | { path: string; records: SearchEmbeddingRecord[] }
  | null = null;

const serverPackageRoot = join(__dir, "..");

const resolveDatasetsDbPath = (
  fileName: "embeddings.sqlite.db" | "virginia.db",
): string | null => {
  const datasetsDir = process.env.DATASETS_DIR;
  if (!datasetsDir) return null;
  const candidates = Array.from(
    new Set([
      resolve(datasetsDir, fileName),
      resolve(serverPackageRoot, datasetsDir, fileName),
    ]),
  );
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[0] ?? null;
};

const loadNodeSourceTextFromExplorer = async (
  nodeId: number,
): Promise<string | null> => {
  if (!Number.isFinite(nodeId)) return null;
  const explorerUrl = getConfig("EXPLORER_URL") || "http://localhost:3002";
  try {
    const res = await fetch(`${explorerUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query ($id: Int!) {
          node(id: $id) {
            id
            sourceText
          }
        }`,
        variables: { id: Math.trunc(nodeId) },
      }),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      data?: { node?: { sourceText?: unknown } | null };
      errors?: unknown[];
    };
    if (Array.isArray(payload.errors) && payload.errors.length > 0) {
      return null;
    }
    const sourceText = payload?.data?.node?.sourceText;
    if (typeof sourceText !== "string" || !sourceText.trim()) return null;
    return stripHtmlAndNormalize(sourceText);
  } catch {
    return null;
  }
};

const toUint8Array = (value: unknown): Uint8Array | null => {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (
    typeof Buffer !== "undefined" &&
    value instanceof Buffer
  ) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
};

const decodeEmbeddingBlob = (blob: unknown): number[] | null => {
  const bytes = toUint8Array(blob);
  if (!bytes || bytes.byteLength === 0 || bytes.byteLength % 4 !== 0) {
    return null;
  }
  const vec = new Float32Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength / 4,
  );
  return Array.from(vec, (v) => Number(v));
};

const loadDatasetEmbeddings = (): SearchEmbeddingRecord[] => {
  const dbPath = resolveDatasetsDbPath("embeddings.sqlite.db");
  if (!dbPath || !existsSync(dbPath)) return [];
  if (datasetEmbeddingsCache?.path === dbPath) {
    return datasetEmbeddingsCache.records;
  }

  const datasetDb = new SqliteDatabase(dbPath, { readonly: true });
  try {
    const rows = datasetDb
      .query(
        `SELECT e.node_id AS node_id, n.source AS source, n.source_id AS source_id, n.node_type AS node_type, e.embedding AS embedding
         FROM embeddings e
         JOIN nodes n ON n.id = e.node_id`,
      )
      .all() as Array<{
      node_id: number;
      source: string;
      source_id: string;
      node_type: string;
      embedding: unknown;
    }>;

    const records: SearchEmbeddingRecord[] = [];
    for (const row of rows) {
      const decoded = decodeEmbeddingBlob(row.embedding);
      if (!decoded) continue;
      records.push({
        nodeId: row.node_id,
        source: row.source,
        sourceId: row.source_id,
        nodeType: row.node_type,
        content: `${row.source}:${row.source_id} (${row.node_type})`,
        embedding: decoded,
      });
    }
    datasetEmbeddingsCache = { path: dbPath, records };
    console.info(
      `[chat][SearchKnowledge] loaded dataset embeddings path=${dbPath} records=${records.length}`,
    );
    return records;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[chat][SearchKnowledge] failed loading dataset embeddings path=${dbPath}: ${message}`,
    );
    return [];
  } finally {
    datasetDb.close(false);
  }
};

const loadSourceChunkText = (
  source: string,
  sourceId: string,
  nodeType: string,
): string | null => {
  const dbPath = resolveDatasetsDbPath("virginia.db");
  if (!dbPath || !existsSync(dbPath)) return null;
  const normalizedSourceId = sourceId.trim();

  const vdb = new SqliteDatabase(dbPath, { readonly: true });
  try {
    if (source === "virginia_code" && nodeType === "section") {
      const row = vdb
        .query(
          `SELECT COALESCE(title, '') AS title, COALESCE(body, '') AS body
           FROM virginia_code
           WHERE section = ?1
           LIMIT 1`,
        )
        .get(normalizedSourceId) as { title: string; body: string } | null;
      if (!row) return null;
      return stripHtmlAndNormalize(`${row.title} ${row.body}`);
    }
    if (source === "constitution" && nodeType === "constitution_section") {
      const row = vdb
        .query(
          `SELECT COALESCE(section_name, '') AS section_name,
                  COALESCE(section_title, '') AS section_title,
                  COALESCE(section_text, '') AS section_text
           FROM constitution
           WHERE section_name = ?1
           LIMIT 1`,
        )
        .get(normalizedSourceId) as {
        section_name: string;
        section_title: string;
        section_text: string;
      } | null;
      if (!row) return null;
      return stripHtmlAndNormalize(
        `${row.section_name} ${row.section_title} ${row.section_text}`,
      );
    }
    if (source === "popular_names" && nodeType === "popular_name") {
      const row = vdb
        .query(
          `SELECT COALESCE(name, '') AS name,
                  COALESCE(title_num, '') AS title_num,
                  COALESCE(section, '') AS section,
                  COALESCE(body, '') AS body
           FROM popular_names
           WHERE name = ?1
           LIMIT 1`,
        )
        .get(normalizedSourceId) as {
        name: string;
        title_num: string;
        section: string;
        body: string;
      } | null;
      if (!row) return null;
      return stripHtmlAndNormalize(
        `${row.name} ${row.title_num} ${row.section} ${row.body}`,
      );
    }
    if (source === "authorities" && nodeType === "authority") {
      const row = vdb
        .query(
          `SELECT COALESCE(name, '') AS name,
                  COALESCE(short_name, '') AS short_name,
                  COALESCE(codified, '') AS codified,
                  COALESCE(title, '') AS title,
                  COALESCE(section, '') AS section,
                  COALESCE(body, '') AS body
           FROM authorities
           WHERE short_name = ?1
           LIMIT 1`,
        )
        .get(normalizedSourceId) as {
        name: string;
        short_name: string;
        codified: string;
        title: string;
        section: string;
        body: string;
      } | null;
      if (!row) return null;
      return stripHtmlAndNormalize(
        `${row.name} ${row.short_name} ${row.codified} ${row.title} ${row.section} ${row.body}`,
      );
    }
    if (source === "courts" && nodeType === "court") {
      const row = vdb
        .query(
          `SELECT COALESCE(name, '') AS name,
                  COALESCE(locality, '') AS locality,
                  COALESCE(type, '') AS type,
                  COALESCE(address, '') AS address,
                  COALESCE(city, '') AS city,
                  COALESCE(state, '') AS state,
                  COALESCE(zip, '') AS zip,
                  COALESCE(phone, '') AS phone,
                  COALESCE(email, '') AS email,
                  COALESCE(hours, '') AS hours,
                  COALESCE(homepage, '') AS homepage
           FROM courts
           WHERE id = ?1
           LIMIT 1`,
        )
        .get(Number(normalizedSourceId)) as {
        name: string;
        locality: string;
        type: string;
        address: string;
        city: string;
        state: string;
        zip: string;
        phone: string;
        email: string;
        hours: string;
        homepage: string;
      } | null;
      if (!row) return null;
      return stripHtmlAndNormalize(
        `${row.name} ${row.locality} ${row.type} ${row.address} ${row.city} ${row.state} ${row.zip} ${row.phone} ${row.email} ${row.hours} ${row.homepage}`,
      );
    }
    return null;
  } catch {
    return null;
  } finally {
    vdb.close(false);
  }
};

type RankedKnowledgeHit = {
  record: SearchEmbeddingRecord;
  semanticScore: number;
  lexicalScore: number;
  hybridScore: number;
  chunkText: string;
  textFromVirginiaDb: boolean;
  textSource: "sqlite_lookup" | "embedding_label";
};

const KNOWLEDGE_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "your",
  "about",
  "into",
  "have",
  "what",
  "when",
  "where",
  "which",
  "under",
  "virginia",
  "code",
  "statute",
  "statutes",
  "case",
  "cases",
  "law",
  "legal",
  "search",
  "knowledge",
  "more",
  "details",
  "summarize",
  "strongest",
  "arguments",
]);

const tokenizeKnowledgeQuery = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter(
      (token) => token.length >= 3 && !KNOWLEDGE_STOP_WORDS.has(token),
    );

const lexicalOverlapScore = (
  queryTokens: string[],
  candidateText: string,
): number => {
  if (queryTokens.length === 0) return 0;
  const candidateTokens = new Set(tokenizeKnowledgeQuery(candidateText));
  let matched = 0;
  for (const token of queryTokens) {
    if (candidateTokens.has(token)) matched += 1;
  }
  return matched / queryTokens.length;
};

const resolveKnowledgeChunkText = (
  record: SearchEmbeddingRecord,
): {
  chunkText: string;
  textFromVirginiaDb: boolean;
  textSource: "sqlite_lookup" | "embedding_label";
} => {
  let chunkTextFromDb: string | null = null;
  if (record.source && record.sourceId && record.nodeType) {
    chunkTextFromDb = loadSourceChunkText(
      record.source,
      record.sourceId,
      record.nodeType,
    );
  }
  if (chunkTextFromDb && chunkTextFromDb.trim()) {
    return {
      chunkText: chunkTextFromDb,
      textFromVirginiaDb: true,
      textSource: "sqlite_lookup",
    };
  }
  return {
    chunkText: record.content,
    textFromVirginiaDb: false,
    textSource: "embedding_label",
  };
};

const rankKnowledgeHits = ({
  query,
  topK,
  ranked,
  usableRecords,
  preferVirginiaText,
}: {
  query: string;
  topK: number;
  ranked: Float64Array;
  usableRecords: SearchEmbeddingRecord[];
  preferVirginiaText: boolean;
}): RankedKnowledgeHit[] => {
  const queryTokens = tokenizeKnowledgeQuery(query);
  const candidates: RankedKnowledgeHit[] = [];
  const maxCandidates = Math.min(
    Math.max(topK * 20, 20),
    Math.floor(ranked.length / 2),
  );
  for (
    let i = 0;
    i < ranked.length && candidates.length < maxCandidates;
    i += 2
  ) {
    const semanticScore = ranked[i];
    const idx = Math.trunc(ranked[i + 1]);
    if (!Number.isFinite(semanticScore)) continue;
    if (!Number.isFinite(idx) || idx < 0 || idx >= usableRecords.length) {
      continue;
    }
    const record = usableRecords[idx];
    const resolved = resolveKnowledgeChunkText(record);
    const lexicalScore = lexicalOverlapScore(queryTokens, resolved.chunkText);
    const hybridScore =
      semanticScore +
      lexicalScore * 0.35 +
      (resolved.textFromVirginiaDb ? 0.02 : 0);
    candidates.push({
      record,
      semanticScore,
      lexicalScore,
      hybridScore,
      chunkText: resolved.chunkText,
      textFromVirginiaDb: resolved.textFromVirginiaDb,
      textSource: resolved.textSource,
    });
  }

  const sorted = [...candidates].sort((a, b) => {
    const aLex = a.lexicalScore > 0 ? 1 : 0;
    const bLex = b.lexicalScore > 0 ? 1 : 0;
    if (aLex !== bLex) return bLex - aLex;
    if (preferVirginiaText) {
      const aDb = a.textFromVirginiaDb ? 1 : 0;
      const bDb = b.textFromVirginiaDb ? 1 : 0;
      if (aDb !== bDb) return bDb - aDb;
    }
    if (b.hybridScore !== a.hybridScore) return b.hybridScore - a.hybridScore;
    return b.semanticScore - a.semanticScore;
  });

  let ordered = sorted;
  if (preferVirginiaText) {
    const dbMatches = ordered.filter((row) => row.textFromVirginiaDb);
    if (dbMatches.length > 0) {
      ordered = [
        ...dbMatches,
        ...ordered.filter((row) => !row.textFromVirginiaDb),
      ];
    }
  }

  const lexicalMatches = ordered.filter((row) => row.lexicalScore > 0);
  if (lexicalMatches.length > 0) {
    ordered = [
      ...lexicalMatches,
      ...ordered.filter((row) => row.lexicalScore <= 0),
    ];
  }

  const selected: RankedKnowledgeHit[] = [];
  const seen = new Set<string>();
  for (const row of ordered) {
    const key = `${row.record.source}|${row.record.sourceId ?? ""}|${row.record.nodeType ?? ""}|${row.record.nodeId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(row);
    if (selected.length >= topK) break;
  }
  return selected;
};

const router = AutoRouter({ base: "/api", format: openapiFormat });

router.post(
  "/chat",
  asIttyRoute("post", "/chat", async (req) => {
    const { messages } = (await req.json()) as {
      messages: { role: string; content: string }[];
    };
    const openai = new OpenAI({
      apiKey: getConfig("OPENAI_API_KEY"),
      baseURL: getConfig("OPENAI_ENDPOINT"),
    });

    const baseSystemPrompt = getChatSystemPrompt();

    const tools: OpenAI.ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "GetCases",
          description: "List all cases with their parties and filings",
          parameters: { type: "object", properties: {}, required: [] },
        },
      },
      {
        type: "function",
        function: {
          name: "GetDeadlines",
          description: "List all deadlines, optionally filtered by caseId",
          parameters: {
            type: "object",
            properties: {
              caseId: {
                type: "string",
                description: "Optional case ID to filter by",
              },
            },
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "GetContacts",
          description: "List all contacts, optionally filtered by caseId",
          parameters: {
            type: "object",
            properties: {
              caseId: {
                type: "string",
                description: "Optional case ID to filter by",
              },
            },
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "GetFinances",
          description: "List all financial entries",
          parameters: { type: "object", properties: {}, required: [] },
        },
      },
      {
        type: "function",
        function: {
          name: "GetDocuments",
          description: "List all ingested documents from the document index",
          parameters: { type: "object", properties: {}, required: [] },
        },
      },
      {
        type: "function",
        function: {
          name: "GetDocumentText",
          description:
            "Read the extracted text of a specific document by its ID",
          parameters: {
            type: "object",
            properties: {
              id: { type: "string", description: "The document ID" },
            },
            required: ["id"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "SearchTimeline",
          description:
            "Search timeline events by date, party, title, case number, or keyword. Returns chronological events from the case timeline.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description:
                  "Search query to match against event titles, details, or parties",
              },
              party: {
                type: "string",
                description: "Filter by party (Father, Mother, Court)",
              },
              caseNumber: {
                type: "string",
                description: "Filter by case number (e.g., JA018953-05-00)",
              },
              isCritical: {
                type: "boolean",
                description: "Filter to only critical events",
              },
              startDate: {
                type: "string",
                description: "Filter events after this date (MM-DD format)",
              },
              endDate: {
                type: "string",
                description: "Filter events before this date (MM-DD format)",
              },
            },
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "SearchKnowledge",
          description:
            "Search the legal knowledge base for Virginia-specific rules, legal concepts, case lifecycle information, document handling guidance, and API surface details. Use this when the user asks about Virginia law, court procedures, legal terminology, case statuses, or how the system works.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Natural language search query",
              },
              topK: {
                type: "number",
                description: "Number of results to return (default 3)",
              },
            },
            required: ["query"],
          },
        },
      },
      ...explorerTools,
    ];

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
    const parseBooleanArg = (value: unknown): boolean | undefined => {
      if (typeof value === "boolean") return value;
      if (value === "true") return true;
      if (value === "false") return false;
      return undefined;
    };
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

You also have access to a Virginia law knowledge graph via explorer tools (get_stats, search_nodes, get_node, get_neighbors, find_similar). Use these for Virginia Code lookups, graph traversal of legal provisions, and semantic similarity search. search_nodes returns truncated text — use get_node for full text of important sections.

Always prefer using SearchKnowledge when the user asks a legal question.`;

    const executeTool = async (
      name: string,
      args: Record<string, unknown>,
    ): Promise<string> => {
      switch (name) {
        case "GetCases":
          return JSON.stringify([...db.cases.values()]);
        case "GetDeadlines": {
          const caseId = parseStringArg(args.caseId);
          let deadlines = [...db.deadlines.values()];
          if (caseId)
            deadlines = deadlines.filter((d) => d.caseId === caseId);
          return JSON.stringify(deadlines);
        }
        case "GetContacts": {
          const caseId = parseStringArg(args.caseId);
          let contacts = [...db.contacts.values()];
          if (caseId) contacts = contacts.filter((c) => c.caseId === caseId);
          return JSON.stringify(contacts);
        }
        case "GetFinances":
          return JSON.stringify([...db.finances.values()]);
        case "GetDocuments": {
          const docs = [...db.documents.values()];
          return JSON.stringify(
            docs.map(({ id, title, category, pageCount }) => ({
              id,
              title,
              category,
              pages: pageCount,
            })),
          );
        }
        case "GetDocumentText": {
          const documentId = parseStringArg(args.id);
          if (!documentId) {
            return JSON.stringify({ error: "Document ID is required" });
          }
          const doc = db.documents.get(documentId);
          if (!doc) return JSON.stringify({ error: "Document not found" });
          return JSON.stringify({
            id: doc.id,
            title: doc.title,
            text: doc.extractedText,
          });
        }
        case "SearchTimeline": {
          interface TimelineEvent {
            title?: string;
            details?: string;
            party?: string;
            date?: string;
            case?: { number?: string };
            isCritical?: boolean;
            source?: string;
          }

          try {
            const timelinePath = join(
              appRoot,
              "case-data/case-documents/timeline_data.json",
            );
            const timelineRaw = await readFile(timelinePath, "utf-8");
            const timelineData = JSON.parse(timelineRaw);
            let events: TimelineEvent[] = timelineData.events || [];
            const query = parseStringArg(args.query);
            const party = parseStringArg(args.party);
            const caseNumber = parseStringArg(args.caseNumber);
            const isCritical = parseBooleanArg(args.isCritical);
            const startDate = parseStringArg(args.startDate);
            const endDate = parseStringArg(args.endDate);

            // Apply filters
            if (query) {
              const q = query.toLowerCase();
              events = events.filter(
                (e: TimelineEvent) =>
                  e.title?.toLowerCase().includes(q) ||
                  e.details?.toLowerCase().includes(q) ||
                  e.party?.toLowerCase().includes(q),
              );
            }
            if (party) {
              events = events.filter((e: TimelineEvent) => e.party === party);
            }
            if (caseNumber) {
              events = events.filter(
                (e: TimelineEvent) => e.case?.number === caseNumber,
              );
            }
            if (isCritical !== undefined) {
              events = events.filter(
                (e: TimelineEvent) => e.isCritical === isCritical,
              );
            }
            if (startDate) {
              events = events.filter(
                (e: TimelineEvent) => e.date && e.date >= startDate,
              );
            }
            if (endDate) {
              events = events.filter(
                (e: TimelineEvent) => e.date && e.date <= endDate,
              );
            }

            return JSON.stringify({
              total: events.length,
              events: events.map((e: TimelineEvent) => ({
                date: e.date,
                party: e.party,
                title: e.title,
                caseNumber: e.case?.number,
                isCritical: e.isCritical,
                details: e.details,
                source: e.source,
              })),
            });
          } catch {
            return JSON.stringify({ error: "Could not search timeline" });
          }
        }
        case "SearchKnowledge": {
          try {
            const query = parseStringArg(args.query);
            if (!query) {
              return JSON.stringify({ error: "Query is required" });
            }
            const topK = parseNumberArg(args.topK) ?? 3;
            const embeddingsModel =
              getConfig("EMBEDDINGS_MODEL") || "text-embedding-3-small";
            const embeddingKeysPreview = Array.from(db.embeddings.keys()).slice(
              0,
              3,
            );
            console.info(
              `[chat][SearchKnowledge] precheck query_len=${query.length} topK=${topK} model=${embeddingsModel} db_embeddings_size=${db.embeddings.size} preview_keys=${JSON.stringify(embeddingKeysPreview)} PROSEVA_DATA_DIR=${process.env.PROSEVA_DATA_DIR ?? "<unset>"} DATASETS_DIR=${process.env.DATASETS_DIR ?? "<unset>"} cwd=${process.cwd()}`,
            );
            let records: SearchEmbeddingRecord[] = Array.from(
              db.embeddings.values(),
            );
            if (records.length === 0) {
              const datasetRecords = loadDatasetEmbeddings();
              if (datasetRecords.length > 0) {
                records = datasetRecords;
                console.info(
                  `[chat][SearchKnowledge] using DATASETS_DIR fallback records=${records.length}`,
                );
              } else {
                console.warn(
                  "[chat][SearchKnowledge] No embeddings available in db.embeddings",
                );
                return JSON.stringify([]);
              }
            }
            const dimCounts = new Map<number, number>();
            for (const record of records) {
              const dim = record.embedding.length;
              dimCounts.set(dim, (dimCounts.get(dim) ?? 0) + 1);
            }
            const targetDim =
              [...dimCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
            console.info(
              `[chat][SearchKnowledge] query_len=${query.length} topK=${topK} model=${embeddingsModel} records=${records.length} target_dim=${targetDim}`,
            );
            const embeddingRequest: {
              model: string;
              input: string;
              dimensions?: number;
            } = {
              model: embeddingsModel,
              input: query,
            };
            if (
              targetDim > 0 &&
              embeddingsModel.startsWith("text-embedding-3-")
            ) {
              embeddingRequest.dimensions = targetDim;
            }
            const embResponse = await openai.embeddings.create(embeddingRequest);
            const queryVec = embResponse.data[0].embedding;
            console.info(
              `[chat][SearchKnowledge] query_embedding_dim=${queryVec.length}`,
            );
            if (targetDim <= 0) {
              console.warn(
                "[chat][SearchKnowledge] Could not determine embedding dimension from corpus",
              );
              return JSON.stringify([]);
            }
            if (queryVec.length !== targetDim) {
              console.error(
                `[chat][SearchKnowledge] Dimension mismatch query_dim=${queryVec.length} target_dim=${targetDim}`,
              );
              return JSON.stringify({
                error: `Knowledge embedding dimension mismatch (query=${queryVec.length}, corpus=${targetDim})`,
              });
            }
            const usableRecords = records.filter(
              (record) => record.embedding.length === targetDim,
            );
            if (usableRecords.length === 0) {
              console.warn(
                "[chat][SearchKnowledge] No embeddings matched target dimension",
              );
              return JSON.stringify([]);
            }
            const flat = new Float64Array(usableRecords.length * targetDim);
            for (let i = 0; i < usableRecords.length; i++) {
              flat.set(usableRecords[i].embedding, i * targetDim);
            }
            const ranked = cosine_similarity_dataspace(
              flat,
              usableRecords.length,
              targetDim,
              new Float64Array(queryVec),
            );
            const scored = rankKnowledgeHits({
              query,
              topK,
              ranked,
              usableRecords,
              preferVirginiaText: true,
            }).map((hit) => ({
              node_id: hit.record.nodeId,
              source: hit.record.source,
              source_id: hit.record.sourceId,
              node_type: hit.record.nodeType,
              content: hit.chunkText,
              score: hit.hybridScore,
              semantic_score: hit.semanticScore,
              lexical_score: hit.lexicalScore,
              text_from_virginia_db: hit.textFromVirginiaDb,
              text_source: hit.textSource,
            }));
            const resultDetails = scored.map((row, idx) => {
              const preview = row.content
                .replace(/\s+/g, " ")
                .slice(0, 120);
              return {
                rank: idx + 1,
                source: row.source,
                score: Number(row.score.toFixed(6)),
                lexical_score:
                  typeof row.lexical_score === "number"
                    ? Number(row.lexical_score.toFixed(4))
                    : 0,
                text_source: row.text_source,
                content_preview: preview,
                content_len: row.content.length,
              };
            });
            console.info(
              `[chat][SearchKnowledge] returning_results=${scored.length} requested_topK=${topK} usable_records=${usableRecords.length} query_dim=${queryVec.length} target_dim=${targetDim} results=${JSON.stringify(resultDetails)}`,
            );
            return JSON.stringify(scored);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            const stack = error instanceof Error ? error.stack : undefined;
            console.error(
              `[chat][SearchKnowledge] failed: ${message}`,
              stack ? `\n${stack}` : "",
            );
            return JSON.stringify({ error: "Knowledge search failed" });
          }
        }
        default:
          if (isExplorerToolName(name)) {
            try {
              return await executeExplorerTool(name, args);
            } catch {
              return JSON.stringify({
                error: `Explorer tool '${name}' failed — explorer may be unavailable`,
              });
            }
          }
          return JSON.stringify({ error: "Unknown tool" });
      }
    };

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

    // === Phase 1: Tool-calling with TEXT_MODEL_SMALL ===
    const latestUserMessage =
      [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const latestAssistantMessage =
      [...messages].reverse().find((m) => m.role === "assistant")?.content ??
      "";
    let toolDecisionQuery = latestUserMessage;
    let hasOptimizedToolContext = false;
    const toolSemanticGuide = `Tool semantics:
- GetCases: list all cases and parties.
- GetDeadlines: deadlines and court dates; optionally filtered by caseId.
- GetContacts: case-linked contacts and roles; optionally filtered by caseId.
- GetFinances: financial entries and monetary records.
- GetDocuments: list indexed documents and metadata.
- GetDocumentText: read full extracted text for a specific document id.
- SearchTimeline: timeline/event retrieval by query, party, case number, criticality, or date range.
- SearchKnowledge: semantic retrieval for Virginia law and legal concepts.
- get_stats: dataset/graph coverage overview.
- search_nodes: lexical lookup by source/type/source_id (quick candidate discovery).
- get_node: canonical full node payload and sourceText for a specific id.
- get_neighbors: structural graph traversal for related nodes.
- find_similar: embedding-nearest neighbors from a known node id.

Intent policy:
- Prefer direct case tools for user/case data.
- Prefer SearchKnowledge for semantic legal lookups.
- Use search_nodes to find candidate node ids, then get_node for full text.
- Use graph tools (get_neighbors/find_similar) only when relationship mapping is needed.`;
    emitChatProcess(
      "request-start",
      "Received your request. Preparing retrieval plan.",
      {
        message_count: messages.length,
        latest_user_len: latestUserMessage.length,
        latest_user_preview: previewText(latestUserMessage),
      },
    );

    if (
      shouldUseDeterministicGraphFlow() &&
      isLikelyLegalQuery(latestUserMessage)
    ) {
      console.info(
        `[chat][graph-flow] enabled=true query_len=${latestUserMessage.length}`,
      );
      try {
        const graphResult = await runDeterministicGraphOrchestration({
          openai,
          systemPrompt,
          messages,
          latestUserMessage,
          latestAssistantMessage,
          emitChatProcess,
        });
        if (graphResult.used) {
          const phase2ContextPreview = graphResult.conversationMessages
            .map((message, idx) => {
              const role = message.role;
              const content = previewMessageContent(message.content);
              return `#${idx + 1} role=${role} content="${content}"`;
            })
            .join(" | ");
          console.info(
            `[chat][final-context] message_count=${graphResult.conversationMessages.length} context=${phase2ContextPreview}`,
          );
          emitChatProcess(
            "final-context-ready",
            "Final answer context assembled.",
            {
              message_count: graphResult.conversationMessages.length,
              deterministic_graph_flow: true,
            },
          );
          broadcast("activity-status", { source: "chat", phase: "generating" });
          emitChatProcess(
            "final-generation-start",
            "Generating final response for you.",
          );
          const finalCompletion = await openai.chat.completions.create({
            model: getConfig("TEXT_MODEL_LARGE") || "gpt-4o",
            messages: graphResult.conversationMessages,
          });
          broadcast("activity-status", { source: "chat", phase: "idle" });
          emitChatProcess("final-generation-done", "Final response generated.");
          return {
            reply:
              finalCompletion.choices[0].message.content ??
              "Sorry, I was unable to complete the request.",
          };
        }
        emitChatProcess(
          "error",
          "Deterministic graph orchestration produced no result.",
          { deterministic_graph_flow: true },
        );
        return {
          reply:
            "I could not complete deterministic legal retrieval for this request.",
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `[chat][graph-flow] failed terminal=true error=${message}`,
        );
        emitChatProcess(
          "error",
          "Deterministic graph orchestration failed.",
          {
            error: message,
            deterministic_graph_flow: true,
          },
        );
        return {
          reply:
            "I could not complete deterministic legal retrieval for this request.",
        };
      }
    }

    if (
      latestUserMessage.trim().length > 0 &&
      latestAssistantMessage.trim().length > 0
    ) {
      const optimizationPrompt = `Merge the former assistant response and latest user message into a concise context optimized for tool calling.

Return only the optimized context text.

Use the following tool semantics to shape intent and terminology:
${toolSemanticGuide}

Former assistant response:
${latestAssistantMessage || "<none>"}

Latest user message:
${latestUserMessage}`;
      try {
        emitChatProcess(
          "tool-context-start",
          "Optimizing context for smarter tool selection.",
        );
        console.info(
          `[chat][tool-context] optimize_start latest_user_len=${latestUserMessage.length} latest_assistant_len=${latestAssistantMessage.length}`,
        );
        const optimizationCompletion = await openai.chat.completions.create({
          model: getConfig("TEXT_MODEL_SMALL") || "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You produce concise retrieval-oriented context for downstream tool selection. Respect available tool semantics and optimize for intentional tool routing.",
            },
            { role: "user", content: optimizationPrompt },
          ],
        });
        const optimized =
          optimizationCompletion.choices[0]?.message?.content?.trim() || "";
        if (optimized.length > 0) {
          toolDecisionQuery = optimized;
          hasOptimizedToolContext = true;
          emitChatProcess(
            "tool-context-done",
            "Tool-selection context optimized.",
            {
              optimized_len: optimized.length,
              optimized_preview: previewText(optimized),
            },
          );
          console.info(
            `[chat][tool-context] optimize_done optimized_len=${optimized.length} preview="${previewText(optimized)}"`,
          );
        } else {
          emitChatProcess(
            "tool-context-failed",
            "Context optimizer returned empty output. Using your original question.",
          );
          console.warn(
            "[chat][tool-context] optimize_empty fallback=latest_user_message",
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        emitChatProcess(
          "tool-context-failed",
          "Context optimization failed. Continuing with your original question.",
          { error: message },
        );
        console.warn(
          `[chat][tool-context] optimize_failed fallback=latest_user_message error=${message}`,
        );
      }
    } else {
      emitChatProcess(
        "tool-context-skipped",
        "Using latest user message directly for tool routing.",
      );
    }
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
    emitChatProcess(
      "tool-loop-start",
      "Selecting and executing tools.",
      { max_iters: 10, user_query_preview: latestUserPreview },
    );
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
      emitChatProcess(
        "tool-iteration",
        `Tool selection iteration ${i + 1} complete.`,
        {
          iteration: i + 1,
          finish_reason: choice.finish_reason ?? "<none>",
          tool_calls: calledTools.length,
          tools: calledTools,
        },
      );

      if (
        choice.finish_reason === "tool_calls" ||
        choice.message.tool_calls?.length
      ) {
        toolMessages.push(choice.message);
        for (const toolCall of choice.message.tool_calls ?? []) {
          if (toolCall.type !== "function") continue;
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(toolCall.function.arguments) as Record<
              string,
              unknown
            >;
          } catch {
            args = {};
          }
          console.info(
            `[chat][tool-decision] invoke tool=${toolCall.function.name} args=${JSON.stringify(args).slice(0, 500)}`,
          );
          emitChatProcess(
            "tool-call-start",
            `Running ${toolUserLabel(toolCall.function.name)}.`,
            {
              iteration: i + 1,
              tool: toolCall.function.name,
              args_preview: previewText(JSON.stringify(args), 180),
            },
          );
          broadcast("activity-status", {
            source: "chat",
            phase: "tool-start",
            tool: toolCall.function.name,
          });
          const result = await executeTool(toolCall.function.name, args);
          broadcast("activity-status", {
            source: "chat",
            phase: "tool-done",
            tool: toolCall.function.name,
          });
          const resultPreview = previewText(result, 240);
          console.info(
            `[chat][tool-decision] tool_result tool=${toolCall.function.name} result_len=${result.length} preview="${resultPreview}"`,
          );
          emitChatProcess(
            "tool-call-done",
            `${toolUserLabel(toolCall.function.name)} completed.`,
            {
              iteration: i + 1,
              ...buildToolProcessData(toolCall.function.name, result),
            },
          );
          if (toolCall.function.name === "SearchKnowledge") {
            sawSearchKnowledge = true;
          }
          if (toolCall.function.name === "search_nodes") {
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
          collectedToolResults.push({ tool: toolCall.function.name, result });
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }
        if (
          !forcedSearchKnowledge &&
          !sawSearchKnowledge &&
          toolDecisionQuery.trim().length > 0 &&
          consecutiveEmptySearchNodes >= 2
        ) {
          const forcedArgs = { query: toolDecisionQuery, topK: 3 };
          const forcedToolCallId = `forced_searchknowledge_${i + 1}`;
          console.info(
            `[chat][tool-decision] force_searchknowledge reason=search_nodes_empty_repeated consecutive_empty=${consecutiveEmptySearchNodes} query_len=${toolDecisionQuery.length}`,
          );
          emitChatProcess(
            "force-tool",
            "SearchKnowledge was forced after repeated empty lexical search results.",
            {
              reason: "search_nodes_empty_repeated",
              consecutive_empty_search_nodes: consecutiveEmptySearchNodes,
            },
          );
          toolMessages.push({
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: forcedToolCallId,
                type: "function",
                function: {
                  name: "SearchKnowledge",
                  arguments: JSON.stringify(forcedArgs),
                },
              },
            ],
          });
          emitChatProcess(
            "tool-call-start",
            `Running ${toolUserLabel("SearchKnowledge")}.`,
            {
              iteration: i + 1,
              tool: "SearchKnowledge",
              forced: true,
              args_preview: previewText(JSON.stringify(forcedArgs), 180),
            },
          );
          broadcast("activity-status", {
            source: "chat",
            phase: "tool-start",
            tool: "SearchKnowledge",
          });
          const forcedResult = await executeTool("SearchKnowledge", forcedArgs);
          broadcast("activity-status", {
            source: "chat",
            phase: "tool-done",
            tool: "SearchKnowledge",
          });
          const forcedPreview = previewText(forcedResult, 240);
          console.info(
            `[chat][tool-decision] tool_result tool=SearchKnowledge forced=true result_len=${forcedResult.length} preview="${forcedPreview}"`,
          );
          emitChatProcess(
            "tool-call-done",
            `${toolUserLabel("SearchKnowledge")} completed.`,
            {
              iteration: i + 1,
              forced: true,
              ...buildToolProcessData("SearchKnowledge", forcedResult),
            },
          );
          collectedToolResults.push({
            tool: "SearchKnowledge",
            result: forcedResult,
          });
          toolMessages.push({
            role: "tool",
            tool_call_id: forcedToolCallId,
            content: forcedResult,
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
    if (
      collectedToolResults.length === 0 &&
      isLikelyLegalQuery(latestUserMessage)
    ) {
      const forcedArgs = { query: latestUserMessage, topK: 3 };
      const forcedToolCallId = "forced_searchknowledge_no_tools";
      emitChatProcess(
        "force-tool",
        "SearchKnowledge was forced because no tools were selected for a legal query.",
        {
          reason: "no_tool_calls_for_legal_query",
          query_preview: previewText(latestUserMessage),
        },
      );
      toolMessages.push({
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: forcedToolCallId,
            type: "function",
            function: {
              name: "SearchKnowledge",
              arguments: JSON.stringify(forcedArgs),
            },
          },
        ],
      });
      emitChatProcess(
        "tool-call-start",
        `Running ${toolUserLabel("SearchKnowledge")}.`,
        {
          tool: "SearchKnowledge",
          forced: true,
          args_preview: previewText(JSON.stringify(forcedArgs), 180),
        },
      );
      broadcast("activity-status", {
        source: "chat",
        phase: "tool-start",
        tool: "SearchKnowledge",
      });
      const forcedResult = await executeTool("SearchKnowledge", forcedArgs);
      broadcast("activity-status", {
        source: "chat",
        phase: "tool-done",
        tool: "SearchKnowledge",
      });
      emitChatProcess(
        "tool-call-done",
        `${toolUserLabel("SearchKnowledge")} completed.`,
        {
          forced: true,
          ...buildToolProcessData("SearchKnowledge", forcedResult),
        },
      );
      collectedToolResults.push({
        tool: "SearchKnowledge",
        result: forcedResult,
      });
      toolMessages.push({
        role: "tool",
        tool_call_id: forcedToolCallId,
        content: forcedResult,
      });
      forcedSearchKnowledge = true;
      sawSearchKnowledge = true;
    }
    console.info(
      `[chat][tool-decision] phase1_complete tool_calls_total=${collectedToolResults.length}`,
    );
    emitChatProcess("tool-loop-complete", "Tool execution phase completed.", {
      tool_calls_total: collectedToolResults.length,
      forced_search_knowledge: forcedSearchKnowledge,
    });

    const executeSummaryTool = async (
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
        const embeddingsModel =
          getConfig("EMBEDDINGS_MODEL") || "text-embedding-3-small";
        const records = loadDatasetEmbeddings();
        if (records.length === 0) {
          return JSON.stringify([]);
        }

        const dimCounts = new Map<number, number>();
        for (const record of records) {
          dimCounts.set(
            record.embedding.length,
            (dimCounts.get(record.embedding.length) ?? 0) + 1,
          );
        }
        const targetDim =
          [...dimCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
        if (targetDim <= 0) return JSON.stringify([]);

        const embeddingRequest: {
          model: string;
          input: string;
          dimensions?: number;
        } = {
          model: embeddingsModel,
          input: query,
        };
        if (
          targetDim > 0 &&
          embeddingsModel.startsWith("text-embedding-3-")
        ) {
          embeddingRequest.dimensions = targetDim;
        }
        const embResponse = await openai.embeddings.create(embeddingRequest);
        const queryVec = embResponse.data[0].embedding;
        if (queryVec.length !== targetDim) return JSON.stringify([]);

        const usableRecords = records.filter(
          (record) => record.embedding.length === targetDim,
        );
        if (usableRecords.length === 0) return JSON.stringify([]);
        const flat = new Float64Array(usableRecords.length * targetDim);
        for (let i = 0; i < usableRecords.length; i++) {
          flat.set(usableRecords[i].embedding, i * targetDim);
        }
        const ranked = cosine_similarity_dataspace(
          flat,
          usableRecords.length,
          targetDim,
          new Float64Array(queryVec),
        );

        const chunks: Array<{
          rank: number;
          node_id?: number;
          source: string;
          source_id?: string;
          node_type?: string;
          score: number;
          chunk_text: string;
          text_from_virginia_db: boolean;
          text_source:
            | "explorer_graphql"
            | "sqlite_lookup"
            | "embedding_label";
        }> = [];
        for (let i = 0; i < ranked.length && chunks.length < topK; i += 2) {
          const idx = ranked[i + 1];
          const rec = usableRecords[idx];
          let chunkTextFromDb: string | null = null;
          let textSource: "explorer_graphql" | "sqlite_lookup" | "embedding_label" =
            "embedding_label";
          if (typeof rec.nodeId === "number") {
            chunkTextFromDb = await loadNodeSourceTextFromExplorer(rec.nodeId);
            if (chunkTextFromDb) textSource = "explorer_graphql";
          }
          if (
            !chunkTextFromDb &&
            rec.source &&
            rec.sourceId &&
            rec.nodeType
          ) {
            chunkTextFromDb = loadSourceChunkText(
              rec.source,
              rec.sourceId,
              rec.nodeType,
            );
            if (chunkTextFromDb) textSource = "sqlite_lookup";
          }
          const chunkText = chunkTextFromDb || rec.content;
          chunks.push({
            rank: chunks.length + 1,
            node_id: rec.nodeId,
            source: rec.source,
            source_id: rec.sourceId,
            node_type: rec.nodeType,
            score: ranked[i],
            chunk_text: chunkText,
            text_from_virginia_db:
              typeof chunkTextFromDb === "string" &&
              chunkTextFromDb.trim().length > 0,
            text_source: textSource,
          });
        }
        const sourceTextResolved = chunks.filter(
          (chunk) => chunk.text_from_virginia_db,
        ).length;
        const sourceTextByOrigin = chunks.reduce<Record<string, number>>(
          (acc, chunk) => {
            acc[chunk.text_source] = (acc[chunk.text_source] ?? 0) + 1;
            return acc;
          },
          {},
        );
        console.info(
          `[chat][tool-summary] nn_topk3 query_len=${query.length} topK=${topK} chunks=${chunks.length} source_text_resolved=${sourceTextResolved} fallback_label=${chunks.length - sourceTextResolved} sources=${JSON.stringify(sourceTextByOrigin)}`,
        );
        return JSON.stringify(chunks);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return JSON.stringify({ error: `GetKnowledgeNNTopK3Chunks failed: ${message}` });
      }
    };

    let toolRunSummary = "No tools were called in phase 1.";
    try {
      emitChatProcess("tool-summary-start", "Summarizing tool results.", {
        tool_calls_total: collectedToolResults.length,
      });
      console.info(
        `[chat][tool-summary] start tool_calls_total=${collectedToolResults.length}`,
      );
      const summaryGroundingQuery =
        latestUserMessage.trim().length > 0
          ? latestUserMessage
          : toolDecisionQuery;
      const summaryGroundingArgs = { query: summaryGroundingQuery, topK: 3 };
      emitChatProcess(
        "tool-summary-tool-start",
        `Running ${toolUserLabel("GetKnowledgeNNTopK3Chunks")} for summary grounding.`,
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
        `${toolUserLabel("GetKnowledgeNNTopK3Chunks")} completed for summary grounding.`,
        {
          ...buildToolProcessData(
            "GetKnowledgeNNTopK3Chunks",
            summaryGroundingResult,
          ),
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
        summaryGroundingChunks: summaryGroundingChunks.map((chunk) => ({
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
      console.warn(
        `[chat][tool-summary] failed fallback_used=true error=${message}`,
      );
      emitChatProcess(
        "tool-summary-failed",
        "Tool summary failed. Proceeding without summary enhancement.",
        { error: message },
      );
    }

    // === Phase 2: Conversational response with TEXT_MODEL_LARGE ===
    // Reuse the full tool-call transcript (assistant tool_calls + tool results)
    // so the final model has authoritative retrieval context.
    const conversationMessages: OpenAI.ChatCompletionMessageParam[] = [
      ...toolMessages,
      {
        role: "system",
        content: `Tool run summary (post-phase1): ${toolRunSummary}`,
      },
    ];
    const phase2ContextPreview = conversationMessages
      .map((message, idx) => {
        const role = message.role;
        const content = previewMessageContent(message.content);
        const toolCallId =
          role === "tool" && "tool_call_id" in message
            ? message.tool_call_id
            : undefined;
        const idPart = toolCallId ? ` tool_call_id=${toolCallId}` : "";
        return `#${idx + 1} role=${role}${idPart} content="${content}"`;
      })
      .join(" | ");
    console.info(
      `[chat][final-context] message_count=${conversationMessages.length} context=${phase2ContextPreview}`,
    );
    emitChatProcess("final-context-ready", "Final answer context assembled.", {
      message_count: conversationMessages.length,
    });

    broadcast("activity-status", { source: "chat", phase: "generating" });
    emitChatProcess(
      "final-generation-start",
      "Generating final response for you.",
    );
    try {
      const finalCompletion = await openai.chat.completions.create({
        model: getConfig("TEXT_MODEL_LARGE") || "gpt-4o",
        messages: conversationMessages,
      });
      broadcast("activity-status", { source: "chat", phase: "idle" });
      emitChatProcess("final-generation-done", "Final response generated.");

      return {
        reply:
          finalCompletion.choices[0].message.content ??
          "Sorry, I was unable to complete the request.",
      };
    } catch (error) {
      broadcast("activity-status", { source: "chat", phase: "idle" });
      const message = error instanceof Error ? error.message : String(error);
      emitChatProcess("error", "Chat response generation failed.", {
        error: message,
      });
      throw error;
    }
  }),
);

export { router as chatRouter };
