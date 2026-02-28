import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { initSync, cosine_similarity_dataspace } from "wasm-similarity/wasm_similarity_core.js";
import { blobToF32, resolveSourceText } from "./explorer/server.ts";

// ── Logging (stderr only — stdout is the MCP stdio channel) ─────────
const log = {
  info: (...args: unknown[]) => console.error("[mcp]", ...args),
  warn: (...args: unknown[]) => console.error("[mcp][warn]", ...args),
  error: (...args: unknown[]) => console.error("[mcp][error]", ...args),
};

// ── WASM similarity init ────────────────────────────────────────────
{
  const candidates: string[] = [];
  try {
    candidates.push(require.resolve("wasm-similarity/wasm_similarity_bg.wasm"));
  } catch {}
  const mcpSrcDir = dirname(new URL(import.meta.url).pathname);
  candidates.push(join(mcpSrcDir, "../node_modules/wasm-similarity/wasm_similarity_bg.wasm"));
  candidates.push(join(mcpSrcDir, "../../node_modules/wasm-similarity/wasm_similarity_bg.wasm"));
  let wasmInitialized = false;
  for (const wasmPath of candidates) {
    try {
      const wasmBuffer = readFileSync(wasmPath);
      initSync({ module: wasmBuffer });
      wasmInitialized = true;
      log.info(`WASM similarity initialized from ${wasmPath}`);
      break;
    } catch {}
  }
  if (!wasmInitialized) {
    log.error("Failed to initialize wasm-similarity: WASM file not found in any candidate path");
    process.exit(1);
  }
}

// ── Two-stage retrieval constants (same as chat.router.ts) ──────────
const STAGE1_POOL_SIZE = 200;
const NEAR_DUP_SCORE_DELTA = 0.02;
const TYPE_PRIORS: Record<string, number> = {
  section: 1.0,
  constitution_section: 1.0,
  popular_name: 0.85,
  court: 0.7,
  manual_chunk: 0.5,
  authority: 0.55,
};
const REPEALED_DEMOTION = 0.4;
const W_SEM = 0.55;
const W_LEX = 0.25;
const W_GRAPH = 0.20;
const MAX_CONTEXT_NODES = 15;
const MISSING_EDGE_SIM_THRESHOLD = 0.80;
const NOISY_EDGE_SIM_THRESHOLD = 0.35;

const MANUAL_INTENT_TERMS = new Set([
  "benchbook", "manual", "procedure", "form", "handbook", "guide", "guideline",
]);
const AUTHORITY_INTENT_TERMS = new Set([
  "charter", "compact", "authority", "commission", "board",
]);

const KNOWLEDGE_STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "your", "about",
  "into", "have", "what", "when", "where", "which", "under", "virginia",
  "code", "statute", "statutes", "case", "cases", "law", "legal", "search",
  "knowledge", "more", "details", "summarize", "strongest", "arguments",
]);

// ── Types ───────────────────────────────────────────────────────────
type AdjacencyEntry = {
  contains_out: Set<number>;
  contains_in: Set<number>;
  cites_out: Set<number>;
  cites_in: Set<number>;
  references_out: Set<number>;
  references_in: Set<number>;
};

type NodeMeta = {
  nodeId: number;
  source: string;
  sourceId: string;
  nodeType: string;
};

type EmbeddingRecord = NodeMeta & {
  embedding: Float32Array;
};

type AnswerCandidate = {
  node_id: number;
  source: string;
  source_id: string;
  node_type: string;
  content: string;
  score: number;
  semantic_score: number;
  lexical_score: number;
  graph_coherence: number;
};

type ContextNode = {
  node_id: number;
  source: string;
  source_id: string;
  node_type: string;
  content: string;
  relation: string;
  anchor_node_id: number;
};

type StructuredSearchResult = {
  answers: AnswerCandidate[];
  context: ContextNode[];
};

type Stage1Candidate = {
  record: EmbeddingRecord;
  semanticScore: number;
  chunkText: string;
  docKey: string;
  nodeType: string;
};

type DupClusterLog = {
  docKey: string;
  chunks: number;
  keptChunkIdx: number;
  scores: number[];
};

// ── Virginia DB source text resolution ──────────────────────────────
function buildVirgStmts(virgDb: Database) {
  return {
    virginiaCode: virgDb.prepare(
      "SELECT COALESCE(title, '') AS title, COALESCE(body, '') AS body FROM virginia_code WHERE section = ? LIMIT 1",
    ),
    constitution: virgDb.prepare(
      "SELECT COALESCE(section_name, '') AS section_name, COALESCE(section_title, '') AS section_title, COALESCE(section_text, '') AS section_text FROM constitution WHERE section_name = ? LIMIT 1",
    ),
    popularNames: virgDb.prepare(
      "SELECT COALESCE(name, '') AS name, COALESCE(title_num, '') AS title_num, COALESCE(section, '') AS section, COALESCE(body, '') AS body FROM popular_names WHERE name = ? LIMIT 1",
    ),
    authorities: virgDb.prepare(
      "SELECT COALESCE(name, '') AS name, COALESCE(short_name, '') AS short_name, COALESCE(codified, '') AS codified, COALESCE(title, '') AS title, COALESCE(section, '') AS section, COALESCE(body, '') AS body FROM authorities WHERE short_name = ? LIMIT 1",
    ),
    courts: virgDb.prepare(
      "SELECT COALESCE(name, '') AS name, COALESCE(locality, '') AS locality, COALESCE(type, '') AS type, COALESCE(address, '') AS address, COALESCE(city, '') AS city, COALESCE(state, '') AS state, COALESCE(zip, '') AS zip, COALESCE(phone, '') AS phone, COALESCE(email, '') AS email, COALESCE(hours, '') AS hours, COALESCE(homepage, '') AS homepage FROM courts WHERE id = ? LIMIT 1",
    ),
    documents: virgDb.prepare(
      "SELECT title, content FROM documents WHERE filename = ? LIMIT 1",
    ),
  };
}

type VirgStmts = ReturnType<typeof buildVirgStmts>;

const stripHtmlAndNormalize = (value: string): string =>
  value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

function resolveChunkText(
  virgStmts: VirgStmts | null,
  source: string,
  sourceId: string,
  nodeType: string,
): string | null {
  if (!virgStmts) return null;
  try {
    if (source === "virginia_code" && nodeType === "section") {
      const row = virgStmts.virginiaCode.get(sourceId) as any;
      if (!row) return null;
      return stripHtmlAndNormalize(`${row.title} ${row.body}`);
    }
    if (source === "constitution" && nodeType === "constitution_section") {
      const row = virgStmts.constitution.get(sourceId) as any;
      if (!row) return null;
      return stripHtmlAndNormalize(`${row.section_name} ${row.section_title} ${row.section_text}`);
    }
    if (source === "popular_names" && nodeType === "popular_name") {
      const row = virgStmts.popularNames.get(sourceId) as any;
      if (!row) return null;
      return stripHtmlAndNormalize(`${row.name} ${row.title_num} ${row.section} ${row.body}`);
    }
    if (source === "authorities" && nodeType === "authority") {
      const row = virgStmts.authorities.get(sourceId) as any;
      if (!row) return null;
      return stripHtmlAndNormalize(`${row.name} ${row.short_name} ${row.codified} ${row.title} ${row.section} ${row.body}`);
    }
    if (source === "courts" && nodeType === "court") {
      const row = virgStmts.courts.get(Number(sourceId)) as any;
      if (!row) return null;
      return stripHtmlAndNormalize(`${row.name} ${row.locality} ${row.type} ${row.address} ${row.city} ${row.state} ${row.zip} ${row.phone} ${row.email} ${row.hours} ${row.homepage}`);
    }
    return null;
  } catch {
    return null;
  }
}

// ── Lexical scoring ─────────────────────────────────────────────────
const tokenizeKnowledgeQuery = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !KNOWLEDGE_STOP_WORDS.has(token));

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

// ── Graph helpers ───────────────────────────────────────────────────
const ensureAdjEntry = (
  map: Map<number, AdjacencyEntry>,
  id: number,
): AdjacencyEntry => {
  let entry = map.get(id);
  if (!entry) {
    entry = {
      contains_out: new Set(),
      contains_in: new Set(),
      cites_out: new Set(),
      cites_in: new Set(),
      references_out: new Set(),
      references_in: new Set(),
    };
    map.set(id, entry);
  }
  return entry;
};

const getSiblings = (
  nodeId: number,
  adj: Map<number, AdjacencyEntry>,
): Set<number> => {
  const siblings = new Set<number>();
  const entry = adj.get(nodeId);
  if (!entry) return siblings;
  for (const parentId of entry.contains_in) {
    const parent = adj.get(parentId);
    if (parent) {
      for (const childId of parent.contains_out) {
        if (childId !== nodeId) siblings.add(childId);
      }
    }
  }
  return siblings;
};

const computeGraphCoherence = (
  nodeId: number,
  poolNodeIds: Set<number>,
  adj: Map<number, AdjacencyEntry>,
  topStatuteParents: Set<number>,
): number => {
  if (poolNodeIds.size === 0) return 0;
  const entry = adj.get(nodeId);
  if (!entry) return 0;

  const neighborhood = new Set<number>();
  for (const id of entry.cites_out) neighborhood.add(id);
  for (const id of entry.cites_in) neighborhood.add(id);
  const siblings = getSiblings(nodeId, adj);
  for (const id of siblings) neighborhood.add(id);

  let overlapCount = 0;
  for (const candidateId of poolNodeIds) {
    if (candidateId !== nodeId && neighborhood.has(candidateId)) {
      overlapCount++;
    }
  }
  let coherence = overlapCount / poolNodeIds.size;

  if (topStatuteParents.size > 0) {
    for (const refId of entry.references_out) {
      const refEntry = adj.get(refId);
      if (!refEntry) continue;
      for (const parentId of refEntry.contains_in) {
        if (topStatuteParents.has(parentId)) {
          coherence += 0.1;
          break;
        }
      }
      if (coherence > 1) break;
    }
  }

  return Math.min(coherence, 1.0);
};

// ── Two-stage search pipeline ───────────────────────────────────────
function twoStageSearch(params: {
  queryEmbedding: number[];
  queryText: string;
  topK: number;
  embeddingRecords: EmbeddingRecord[];
  nodeMetaById: Map<number, NodeMeta>;
  adj: Map<number, AdjacencyEntry>;
  virgStmts: VirgStmts | null;
}): StructuredSearchResult {
  const {
    queryEmbedding, queryText, topK,
    embeddingRecords, nodeMetaById, adj, virgStmts,
  } = params;

  const queryTokens = tokenizeKnowledgeQuery(queryText);

  // Detect intent overrides
  const hasManualIntent = queryTokens.some((t) => MANUAL_INTENT_TERMS.has(t));
  const hasAuthorityIntent = queryTokens.some((t) => AUTHORITY_INTENT_TERMS.has(t));
  const hasRepealIntent = queryTokens.some((t) => t === "repeal" || t === "repealed");

  // ── WASM cosine similarity ──
  const ranked = cosine_similarity_dataspace(
    flatEmbeddings,
    embeddingRecords.length,
    embeddingDim,
    new Float64Array(queryEmbedding),
  );

  // ── Stage 1a: Broad cosine pool ──
  const resolveText = (rec: EmbeddingRecord): string => {
    const fromDb = resolveChunkText(virgStmts, rec.source, rec.sourceId, rec.nodeType);
    return fromDb ?? `${rec.source}:${rec.sourceId} (${rec.nodeType})`;
  };

  const rawPool: Stage1Candidate[] = [];
  const poolLimit = Math.min(STAGE1_POOL_SIZE, Math.floor(ranked.length / 2));
  for (let i = 0; i < ranked.length && rawPool.length < poolLimit; i += 2) {
    const score = ranked[i];
    const idx = Math.trunc(ranked[i + 1]);
    if (!Number.isFinite(score)) continue;
    if (!Number.isFinite(idx) || idx < 0 || idx >= embeddingRecords.length) continue;
    const rec = embeddingRecords[idx];
    rawPool.push({
      record: rec,
      semanticScore: score,
      chunkText: resolveText(rec),
      docKey: `${rec.source}|${rec.sourceId}`,
      nodeType: rec.nodeType,
    });
  }

  // ── Stage 1b: Doc-level deduplication ──
  const docGroups = new Map<string, Stage1Candidate[]>();
  for (const c of rawPool) {
    const group = docGroups.get(c.docKey) ?? [];
    group.push(c);
    docGroups.set(c.docKey, group);
  }

  const dupClusters: DupClusterLog[] = [];
  const dedupedPool: Stage1Candidate[] = [];
  for (const [docKey, group] of docGroups) {
    group.sort((a, b) => b.semanticScore - a.semanticScore);
    dedupedPool.push(group[0]);
    if (group.length > 1) {
      dupClusters.push({
        docKey,
        chunks: group.length,
        keptChunkIdx: 0,
        scores: group.map((c) => Number(c.semanticScore.toFixed(4))),
      });
    }
  }
  dedupedPool.sort((a, b) => b.semanticScore - a.semanticScore);

  // ── Stage 1c: Near-duplicate suppression ──
  const afterNearDup: Stage1Candidate[] = [];
  for (const candidate of dedupedPool) {
    const nodeId = candidate.record.nodeId;
    let suppressed = false;
    for (const kept of afterNearDup) {
      const keptId = kept.record.nodeId;
      const scoreDelta = kept.semanticScore - candidate.semanticScore;
      if (scoreDelta < NEAR_DUP_SCORE_DELTA) continue;
      const keptParents = adj.get(keptId)?.contains_in;
      const candidateParents = adj.get(nodeId)?.contains_in;
      if (keptParents && candidateParents) {
        for (const p of candidateParents) {
          if (keptParents.has(p)) {
            suppressed = true;
            break;
          }
        }
      }
      if (suppressed) break;
    }
    if (!suppressed) afterNearDup.push(candidate);
  }

  // ── Stage 1d: Query-agnostic type priors ──
  for (const candidate of afterNearDup) {
    let prior = TYPE_PRIORS[candidate.nodeType] ?? 0.8;
    if (hasManualIntent && candidate.nodeType === "manual_chunk") prior = 1.0;
    if (hasAuthorityIntent && candidate.nodeType === "authority") prior = 1.0;
    candidate.semanticScore *= prior;
  }

  // ── Stage 1e: Repealed suppression ──
  if (!hasRepealIntent) {
    for (const candidate of afterNearDup) {
      if (/\brepealed\b/i.test(candidate.chunkText)) {
        candidate.semanticScore *= REPEALED_DEMOTION;
      }
    }
  }

  afterNearDup.sort((a, b) => b.semanticScore - a.semanticScore);

  // ── Stage 2: Graph-aware re-ranking ──
  const poolNodeIds = new Set<number>();
  for (const c of afterNearDup) {
    poolNodeIds.add(c.record.nodeId);
  }

  const topStatuteParents = new Set<number>();
  for (const c of afterNearDup.slice(0, 10)) {
    if (c.nodeType === "section" || c.nodeType === "constitution_section") {
      const entry = adj.get(c.record.nodeId);
      if (entry) {
        for (const parentId of entry.contains_in) {
          topStatuteParents.add(parentId);
        }
      }
    }
  }

  const reranked = afterNearDup.map((candidate) => {
    const lexicalScore = lexicalOverlapScore(queryTokens, candidate.chunkText);
    const graphCoherence = computeGraphCoherence(
      candidate.record.nodeId,
      poolNodeIds,
      adj,
      topStatuteParents,
    );
    const finalScore =
      candidate.semanticScore * W_SEM +
      lexicalScore * W_LEX +
      graphCoherence * W_GRAPH;

    return {
      record: candidate.record,
      semanticScore: candidate.semanticScore,
      lexicalScore,
      graphCoherence,
      finalScore,
      chunkText: candidate.chunkText,
    };
  });

  reranked.sort((a, b) => b.finalScore - a.finalScore);

  // ── Final dedup and select ──
  type RerankedHit = (typeof reranked)[number];
  const selected: RerankedHit[] = [];
  const seen = new Set<string>();
  for (const row of reranked) {
    const key = `${row.record.source}|${row.record.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(row);
    if (selected.length >= topK) break;
  }

  // ── Triage logging ──
  logTriageArtifacts(selected, dupClusters, reranked.slice(0, 50), adj);

  // ── Build structured output ──
  const answers: AnswerCandidate[] = selected.map((hit) => ({
    node_id: hit.record.nodeId,
    source: hit.record.source,
    source_id: hit.record.sourceId,
    node_type: hit.record.nodeType,
    content: hit.chunkText,
    score: hit.finalScore,
    semantic_score: hit.semanticScore,
    lexical_score: hit.lexicalScore,
    graph_coherence: hit.graphCoherence,
  }));

  // ── Context expansion ──
  const answerNodeIds = new Set(selected.map((h) => h.record.nodeId));
  const contextNodes: ContextNode[] = [];
  const seenContextIds = new Set<number>();

  const addContext = (nodeId: number, relation: string, anchorNodeId: number) => {
    if (answerNodeIds.has(nodeId)) return;
    if (seenContextIds.has(nodeId)) return;
    if (contextNodes.length >= MAX_CONTEXT_NODES) return;
    seenContextIds.add(nodeId);

    const meta = nodeMetaById.get(nodeId);
    if (!meta) return;

    const text = resolveChunkText(virgStmts, meta.source, meta.sourceId, meta.nodeType)
      ?? `${meta.source}:${meta.sourceId} (${meta.nodeType})`;
    contextNodes.push({
      node_id: nodeId,
      source: meta.source,
      source_id: meta.sourceId,
      node_type: meta.nodeType,
      content: text,
      relation,
      anchor_node_id: anchorNodeId,
    });
  };

  for (const hit of selected) {
    const nodeId = hit.record.nodeId;
    const entry = adj.get(nodeId);
    if (!entry) continue;

    for (const parentId of entry.contains_in) addContext(parentId, "parent", nodeId);
    for (const childId of entry.contains_out) addContext(childId, "child", nodeId);
    for (const citedId of entry.cites_out) addContext(citedId, "cites", nodeId);
    for (const citingId of entry.cites_in) addContext(citingId, "cited_by", nodeId);

    if (contextNodes.length >= MAX_CONTEXT_NODES) break;
  }

  return { answers, context: contextNodes };
}

// ── Triage logging ──────────────────────────────────────────────────
function logTriageArtifacts(
  hits: { record: EmbeddingRecord; semanticScore: number }[],
  dupClusters: DupClusterLog[],
  stage1Pool: { record: EmbeddingRecord; semanticScore: number }[],
  adj: Map<number, AdjacencyEntry>,
) {
  for (const cluster of dupClusters) {
    log.info(
      `[triage] dup_cluster doc_key=${cluster.docKey} chunks=${cluster.chunks} kept_chunk_idx=${cluster.keptChunkIdx} scores=[${cluster.scores.join(",")}]`,
    );
  }

  for (let i = 0; i < hits.length; i++) {
    const aId = hits[i].record.nodeId;
    for (let j = i + 1; j < hits.length; j++) {
      const bId = hits[j].record.nodeId;
      const simProxy = 1 - Math.abs(hits[i].semanticScore - hits[j].semanticScore);
      if (simProxy < MISSING_EDGE_SIM_THRESHOLD) continue;

      const aEntry = adj.get(aId);
      const bEntry = adj.get(bId);
      if (!aEntry || !bEntry) continue;
      let hasPath = false;
      if (aEntry.cites_out.has(bId) || aEntry.cites_in.has(bId)) hasPath = true;
      if (aEntry.contains_out.has(bId) || aEntry.contains_in.has(bId)) hasPath = true;
      if (!hasPath) {
        for (const mid of aEntry.cites_out) {
          const midEntry = adj.get(mid);
          if (midEntry && (midEntry.cites_out.has(bId) || midEntry.contains_out.has(bId))) {
            hasPath = true;
            break;
          }
        }
      }
      if (!hasPath) {
        for (const mid of aEntry.contains_in) {
          if (bEntry.contains_in.has(mid)) { hasPath = true; break; }
        }
      }
      if (!hasPath) {
        const aLabel = `${hits[i].record.source} ${hits[i].record.sourceId}`.trim();
        const bLabel = `${hits[j].record.source} ${hits[j].record.sourceId}`.trim();
        log.info(
          `[triage] missing_edge nodeA=${aId}(${aLabel}) nodeB=${bId}(${bLabel}) cosSim=${simProxy.toFixed(2)} no_path_via=cites,contains`,
        );
      }
    }
  }

  for (let i = 0; i < stage1Pool.length; i++) {
    const aId = stage1Pool[i].record.nodeId;
    const aEntry = adj.get(aId);
    if (!aEntry) continue;
    for (let j = i + 1; j < stage1Pool.length; j++) {
      const bId = stage1Pool[j].record.nodeId;
      const simProxy = 1 - Math.abs(stage1Pool[i].semanticScore - stage1Pool[j].semanticScore);
      let relType: string | null = null;
      if (aEntry.cites_out.has(bId) || aEntry.cites_in.has(bId)) relType = "cites";
      else if (aEntry.contains_out.has(bId) || aEntry.contains_in.has(bId)) relType = "contains";
      if (relType && simProxy < NOISY_EDGE_SIM_THRESHOLD) {
        log.info(
          `[triage] noisy_edge nodeA=${aId} nodeB=${bId} rel=${relType} cosSim=${simProxy.toFixed(2)}`,
        );
      }
    }
  }
}

// ── CLI args ────────────────────────────────────────────────────────
const mcpDir = dirname(new URL(import.meta.url).pathname);
const defaultEmbeddings = join(mcpDir, "../datasets/data/embeddings.sqlite.db");
const defaultVirginia = join(mcpDir, "../datasets/data/virginia.db");

const args = process.argv.slice(2);
let embeddingsPath = "";
let virginiaPath = "";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--embeddings" && args[i + 1]) embeddingsPath = args[++i];
  else if (args[i] === "--virginia" && args[i + 1]) virginiaPath = args[++i];
}
if (!embeddingsPath && existsSync(defaultEmbeddings)) embeddingsPath = defaultEmbeddings;
if (!virginiaPath && existsSync(defaultVirginia)) virginiaPath = defaultVirginia;

if (!embeddingsPath) {
  log.error("Usage: bun mcp-server.ts --embeddings <path> [--virginia <path>]");
  log.error(`Hint: expected default embeddings DB at ${defaultEmbeddings}`);
  process.exit(1);
}

// ── Open databases ──────────────────────────────────────────────────
log.info(`Opening embeddings DB: ${embeddingsPath}`);
const embDb = new Database(embeddingsPath);

let virgDb: Database | null = null;
let virgStmts: VirgStmts | null = null;
if (virginiaPath && existsSync(virginiaPath)) {
  log.info(`Opening Virginia DB: ${virginiaPath}`);
  virgDb = new Database(virginiaPath, { readonly: true });
  virgStmts = buildVirgStmts(virgDb);
}

// Prepared statements for get_node / get_neighbors
const stmts = {
  nodeById: embDb.prepare(
    "SELECT id, source, source_id, chunk_idx, node_type FROM nodes WHERE id = ?",
  ),
  edgesFrom: embDb.prepare(
    "SELECT from_id, to_id, rel_type, weight FROM edges WHERE from_id = ?",
  ),
  edgesTo: embDb.prepare(
    "SELECT from_id, to_id, rel_type, weight FROM edges WHERE to_id = ?",
  ),
};

// ── Load in-memory caches ───────────────────────────────────────────
log.info("Loading embeddings cache...");
const embRows = embDb
  .query(
    `SELECT e.node_id, n.source, n.source_id, n.node_type, e.embedding
     FROM embeddings e JOIN nodes n ON n.id = e.node_id`,
  )
  .all() as Array<{
    node_id: number;
    source: string;
    source_id: string;
    node_type: string;
    embedding: Buffer | Uint8Array;
  }>;

const embeddingRecords: EmbeddingRecord[] = [];
const nodeMetaById = new Map<number, NodeMeta>();

for (const row of embRows) {
  const vec = blobToF32(row.embedding);
  if (vec.length === 0) continue;
  const rec: EmbeddingRecord = {
    nodeId: row.node_id,
    source: row.source,
    sourceId: row.source_id,
    nodeType: row.node_type,
    embedding: vec,
  };
  embeddingRecords.push(rec);
  nodeMetaById.set(row.node_id, {
    nodeId: row.node_id,
    source: row.source,
    sourceId: row.source_id,
    nodeType: row.node_type,
  });
}
log.info(`Loaded ${embeddingRecords.length} embedding records`);

// ── Pre-pack embeddings into flat Float64Array for WASM cosine sim ──
const embeddingDim = embeddingRecords.length > 0 ? embeddingRecords[0].embedding.length : 0;
const flatEmbeddings = new Float64Array(embeddingRecords.length * embeddingDim);
for (let i = 0; i < embeddingRecords.length; i++) {
  const emb = embeddingRecords[i].embedding;
  for (let j = 0; j < embeddingDim; j++) {
    flatEmbeddings[i * embeddingDim + j] = emb[j];
  }
}
log.info(`Pre-packed embeddings into flat Float64Array (dim=${embeddingDim}, count=${embeddingRecords.length})`);

// Also load nodes that have no embedding (for context resolution)
const allNodeRows = embDb
  .query("SELECT id, source, source_id, node_type FROM nodes")
  .all() as Array<{ id: number; source: string; source_id: string; node_type: string }>;
for (const row of allNodeRows) {
  if (!nodeMetaById.has(row.id)) {
    nodeMetaById.set(row.id, {
      nodeId: row.id,
      source: row.source,
      sourceId: row.source_id,
      nodeType: row.node_type,
    });
  }
}
log.info(`Total node metadata entries: ${nodeMetaById.size}`);

log.info("Loading adjacency cache...");
const edgeRows = embDb
  .query("SELECT from_id, to_id, rel_type FROM edges")
  .all() as Array<{ from_id: number; to_id: number; rel_type: string }>;

const adj = new Map<number, AdjacencyEntry>();
for (const { from_id, to_id, rel_type } of edgeRows) {
  const fromEntry = ensureAdjEntry(adj, from_id);
  const toEntry = ensureAdjEntry(adj, to_id);
  if (rel_type === "contains") {
    fromEntry.contains_out.add(to_id);
    toEntry.contains_in.add(from_id);
  } else if (rel_type === "cites") {
    fromEntry.cites_out.add(to_id);
    toEntry.cites_in.add(from_id);
  } else if (rel_type === "references") {
    fromEntry.references_out.add(to_id);
    toEntry.references_in.add(from_id);
  }
}
log.info(`Loaded adjacency cache: ${edgeRows.length} edges, ${adj.size} nodes`);

// ── MCP Server ──────────────────────────────────────────────────────
const server = new McpServer({
  name: "knowledge-search",
  version: "1.0.0",
});

// Tool 1: search_knowledge
server.tool(
  "search_knowledge",
  "Two-stage graph-aware semantic search over legal knowledge base. Returns ranked answers with semantic, lexical, and graph coherence scores, plus structurally related context nodes.",
  {
    query_embedding: z.array(z.number()).describe("Pre-computed query embedding vector"),
    query_text: z.string().describe("Original query text for lexical scoring and intent detection"),
    top_k: z.number().optional().default(5).describe("Number of top results to return"),
  },
  async ({ query_embedding, query_text, top_k }) => {
    if (query_embedding.length !== embeddingDim) {
      log.error(
        `search_knowledge dimension mismatch: query_dim=${query_embedding.length} corpus_dim=${embeddingDim}`,
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              answers: [],
              context: [],
              error: `Embedding dimension mismatch: query=${query_embedding.length}, corpus=${embeddingDim}`,
            }),
          },
        ],
      };
    }

    const result = twoStageSearch({
      queryEmbedding: query_embedding,
      queryText: query_text,
      topK: top_k,
      embeddingRecords,
      nodeMetaById,
      adj,
      virgStmts,
    });

    log.info(
      `search_knowledge query="${query_text.slice(0, 80)}" answers=${result.answers.length} context=${result.context.length}`,
    );

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  },
);

// Tool 2: get_node
server.tool(
  "get_node",
  "Get detailed information about a knowledge graph node, including metadata, source text, and adjacency info.",
  {
    node_id: z.number().describe("Node ID to look up"),
  },
  async ({ node_id }) => {
    const row = stmts.nodeById.get(node_id) as any;
    if (!row) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Node not found" }) }],
      };
    }

    const sourceText = resolveChunkText(virgStmts, row.source, row.source_id, row.node_type)
      ?? resolveSourceText(virgStmts as any, row.source, row.source_id)
      ?? null;

    const entry = adj.get(node_id);
    const adjacency = entry
      ? {
          parents: [...entry.contains_in],
          children: [...entry.contains_out],
          cites: [...entry.cites_out],
          cited_by: [...entry.cites_in],
          references: [...entry.references_out],
          referenced_by: [...entry.references_in],
        }
      : null;

    const result = {
      id: row.id,
      source: row.source,
      source_id: row.source_id,
      chunk_idx: row.chunk_idx,
      node_type: row.node_type,
      source_text: sourceText,
      adjacency,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  },
);

// Tool 3: get_neighbors
server.tool(
  "get_neighbors",
  "Get neighboring nodes in the knowledge graph, optionally filtered by relation type and direction.",
  {
    node_id: z.number().describe("Node ID to get neighbors for"),
    relation: z.string().optional().describe("Filter by relation type: contains, cites, references"),
    direction: z.enum(["out", "in", "both"]).optional().default("both").describe("Edge direction"),
  },
  async ({ node_id, relation, direction }) => {
    const fromEdges = (direction === "in" ? [] : stmts.edgesFrom.all(node_id)) as any[];
    const toEdges = (direction === "out" ? [] : stmts.edgesTo.all(node_id)) as any[];

    let edges = [
      ...fromEdges.map((e: any) => ({
        from_id: e.from_id,
        to_id: e.to_id,
        rel_type: e.rel_type,
        weight: e.weight,
        direction: "out",
        neighbor_id: e.to_id,
      })),
      ...toEdges.map((e: any) => ({
        from_id: e.from_id,
        to_id: e.to_id,
        rel_type: e.rel_type,
        weight: e.weight,
        direction: "in",
        neighbor_id: e.from_id,
      })),
    ];

    if (relation) {
      edges = edges.filter((e) => e.rel_type === relation);
    }

    const neighbors = edges.map((e) => {
      const meta = nodeMetaById.get(e.neighbor_id);
      const sourceText = meta
        ? (resolveChunkText(virgStmts, meta.source, meta.sourceId, meta.nodeType)
           ?? `${meta.source}:${meta.sourceId} (${meta.nodeType})`)
        : null;

      return {
        node_id: e.neighbor_id,
        source: meta?.source ?? null,
        source_id: meta?.sourceId ?? null,
        node_type: meta?.nodeType ?? null,
        rel_type: e.rel_type,
        direction: e.direction,
        weight: e.weight,
        text: sourceText,
      };
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ node_id, neighbors }) }],
    };
  },
);

// Tool 4: get_embedding_dim
server.tool(
  "get_embedding_dim",
  "Returns the embedding dimension used by the knowledge base corpus.",
  {},
  async () => {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ dim: embeddingDim }) }],
    };
  },
);

// Tool 5: find_similar
server.tool(
  "find_similar",
  "Find nodes with the most similar embeddings to a given node using cosine similarity. Useful for discovering semantically related legal provisions that may not be directly linked by edges.",
  {
    id: z.number().describe("The node ID to find similar nodes for"),
    limit: z.number().optional().default(10).describe("Number of similar nodes to return (default 10, max 50)"),
  },
  async ({ id, limit }) => {
    const targetRec = embeddingRecords.find(r => r.nodeId === id);
    if (!targetRec) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Node embedding not found" }) }],
      };
    }

    const ranked = cosine_similarity_dataspace(
      flatEmbeddings,
      embeddingRecords.length,
      embeddingDim,
      new Float64Array(Array.from(targetRec.embedding).map(v => Number(v))),
    );

    const results = [];
    for (let i = 0; i < ranked.length && results.length < limit + 1; i += 2) {
      const score = ranked[i];
      const idx = Math.trunc(ranked[i + 1]);
      if (idx < 0 || idx >= embeddingRecords.length) continue;
      const rec = embeddingRecords[idx];
      if (rec.nodeId === id) continue; // skip self

      const meta = nodeMetaById.get(rec.nodeId);
      const text = meta
        ? (resolveChunkText(virgStmts, meta.source, meta.sourceId, meta.nodeType)
           ?? `${meta.source}:${meta.sourceId} (${meta.nodeType})`)
        : null;

      results.push({
        score,
        node: {
          id: rec.nodeId,
          source: rec.source,
          source_id: rec.sourceId,
          node_type: rec.nodeType,
          text: text?.slice(0, 500),
        }
      });
      if (results.length >= limit) break;
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ results }) }],
    };
  }
);

// Tool 6: get_stats
server.tool(
  "get_stats",
  "Get an overview of the knowledge graph dataset: total node count, edge count, embedding count, and breakdowns by node type and edge type.",
  {},
  async () => {
    const nodeCount = nodeMetaById.size;
    const embeddingCount = embeddingRecords.length;
    
    const nodeTypesMap = new Map<string, number>();
    for (const meta of nodeMetaById.values()) {
        nodeTypesMap.set(meta.nodeType, (nodeTypesMap.get(meta.nodeType) ?? 0) + 1);
    }
    const nodeTypes = Array.from(nodeTypesMap.entries()).map(([type, count]) => ({ type, count }));

    let edgeCount = 0;
    const edgeTypesMap = new Map<string, number>();
    for (const entry of adj.values()) {
        const counts = [
            { type: "contains", count: entry.contains_out.size },
            { type: "cites", count: entry.cites_out.size },
            { type: "references", count: entry.references_out.size }
        ];
        for (const { type, count } of counts) {
            edgeCount += count;
            edgeTypesMap.set(type, (edgeTypesMap.get(type) ?? 0) + count);
        }
    }
    const edgeTypes = Array.from(edgeTypesMap.entries()).map(([type, count]) => ({ type, count }));

    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        stats: {
            nodeCount,
            edgeCount,
            embeddingCount,
            nodeTypes,
            edgeTypes
        }
      }) }],
    };
  }
);

// Tool 7: search_nodes
server.tool(
  "search_nodes",
  "Search for nodes in the knowledge graph by type and/or a search term that matches against source and source_id.",
  {
    type: z.string().optional().describe("Filter by node type, e.g. 'section', 'court', 'title', 'constitution_section', 'authority'"),
    search: z.string().optional().describe("Search term to match against source and source_id fields"),
    limit: z.number().optional().default(20).describe("Max results to return (default 20, max 200)"),
    offset: z.number().optional().default(0).describe("Pagination offset (default 0)"),
  },
  async ({ type, search, limit, offset }) => {
    let matches = Array.from(nodeMetaById.values());

    if (type) {
        matches = matches.filter(m => m.nodeType === type);
    }
    if (search) {
        const s = search.toLowerCase();
        matches = matches.filter(m => 
            m.source.toLowerCase().includes(s) || 
            m.sourceId.toLowerCase().includes(s)
        );
    }

    const total = matches.length;
    const results = matches.slice(offset, offset + limit).map(meta => {
        const text = resolveChunkText(virgStmts, meta.source, meta.sourceId, meta.nodeType)
          ?? `${meta.source}:${meta.sourceId} (${meta.nodeType})`;
        return {
            id: meta.nodeId,
            source: meta.source,
            source_id: meta.sourceId,
            node_type: meta.nodeType,
            text: text.slice(0, 500)
        };
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ total, nodes: results }) }],
    };
  }
);

// ── Start server ────────────────────────────────────────────────────
log.info("Starting MCP server on stdio...");
const transport = new StdioServerTransport();
await server.connect(transport);
log.info("MCP server connected.");
