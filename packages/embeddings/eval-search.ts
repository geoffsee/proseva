#!/usr/bin/env bun
/**
 * Semantic search quality evaluation script.
 *
 * Embeds natural-language questions via the local embedding server, ranks all
 * stored embeddings using wasm-similarity, and reports top-K results per query.
 *
 * Prerequisites:
 *   cargo run --release --bin embedding-server   (port 8000)
 */

import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import {
  initSync,
  cosine_similarity_dataspace,
  cosine_distance_dataspace,
  euclidean_distance_dataspace,
  squared_euclidean_distance_dataspace,
  jaccard_index_dataspace,
} from "wasm-similarity/wasm_similarity_core.js";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

// ── wasm init ────────────────────────────────────────────────────────────────

const wasmPath = require.resolve("wasm-similarity/wasm_similarity_bg.wasm");
initSync({ module: readFileSync(wasmPath) });

// ── config ───────────────────────────────────────────────────────────────────

const EMBED_URL = process.env.EMBED_URL ?? "http://localhost:8000";



function findGitRoot(startDir = process.cwd()) {
  let dir = startDir;
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, ".git"))) {
      return dir;
    }
    dir = dirname(dir);
  }
  return null;
}

const EMB_PATH = `${findGitRoot()}/packages/datasets/data/embeddings.sqlite.db`;
const VIRG_PATH = `${findGitRoot()}/packages/datasets/data/virginia.db`;
const K = 10;

// ── databases ────────────────────────────────────────────────────────────────

const embDb = new Database(EMB_PATH);
const virgDb = new Database(VIRG_PATH);

// ── helpers ──────────────────────────────────────────────────────────────────

function blobToF32(blob: Buffer | Uint8Array): Float32Array {
  const buf = Buffer.from(blob);
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

// ── load corpus into flat Float64Array ───────────────────────────────────────

console.log("Loading embeddings into memory...");
const allRows = embDb.prepare("SELECT node_id, embedding FROM embeddings").all() as {
  node_id: number;
  embedding: Buffer;
}[];

const dim = allRows[0] ? blobToF32(allRows[0].embedding).length : 0;
const nodeIds = allRows.map((r) => r.node_id);
const flat = new Float64Array(allRows.length * dim);
for (let i = 0; i < allRows.length; i++) {
  const f32 = blobToF32(allRows[i].embedding);
  for (let j = 0; j < dim; j++) flat[i * dim + j] = f32[j];
}
console.log(`Loaded ${allRows.length} embeddings (${dim}d) into ${(flat.byteLength / 1e6).toFixed(0)} MB flat array\n`);

// ── jaccard: build token-set corpus ──────────────────────────────────────────

const SET_SIZE = 256;

function hashWord(word: string): number {
  // FNV-1a 32-bit, forced positive via >>> 0, then +1 to avoid 0
  let h = 0x811c9dc5;
  for (let i = 0; i < word.length; i++) {
    h ^= word.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) + 1; // always > 0
}

function tokenize(text: string): number[] {
  const words = text
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const seen = new Set<number>();
  const hashes: number[] = [];
  for (const w of words) {
    const h = hashWord(w);
    if (!seen.has(h)) {
      seen.add(h);
      hashes.push(h);
      if (hashes.length >= SET_SIZE) break;
    }
  }
  return hashes;
}

// Bulk-load all source texts into a node_id → text map
console.log("Building Jaccard token-set corpus...");

function bulkLoadTexts(): Map<number, string> {
  const textMap = new Map<number, string>();
  const allNodes = embDb
    .prepare("SELECT id, source, source_id FROM nodes WHERE id IN (SELECT node_id FROM embeddings)")
    .all() as { id: number; source: string; source_id: string }[];

  // Batch load each source type
  const vcRows = virgDb.prepare("SELECT section, title, body FROM virginia_code").all() as any[];
  const vcMap = new Map(vcRows.map((r: any) => [r.section, `${r.title ?? ""} ${r.body ?? ""}`]));

  const constRows = virgDb.prepare("SELECT article_id, section_count, section_name, section_title, section_text FROM constitution").all() as any[];
  const constMap = new Map(constRows.map((r: any) => [`${r.article_id}:${r.section_count}`, `${r.section_name ?? ""} ${r.section_title ?? ""} ${r.section_text ?? ""}`]));

  const authRows = virgDb.prepare("SELECT short_name, title, body FROM authorities").all() as any[];
  const authMap = new Map(authRows.map((r: any) => [r.short_name, `${r.title ?? ""} ${r.body ?? ""}`]));

  const courtRows = virgDb.prepare("SELECT id, name, locality, type, district, city FROM courts").all() as any[];
  const courtMap = new Map(courtRows.map((r: any) => [String(r.id), `${r.name ?? ""} ${r.locality ?? ""} ${r.type ?? ""} ${r.district ?? ""} ${r.city ?? ""}`]));

  const pnRows = virgDb.prepare("SELECT name, body FROM popular_names").all() as any[];
  const pnMap = new Map(pnRows.map((r: any) => [r.name, `${r.name ?? ""} ${r.body ?? ""}`]));

  const docRows = virgDb.prepare("SELECT filename, title, content FROM documents").all() as any[];
  const docMap = new Map(docRows.map((r: any) => [r.filename, `${r.title ?? ""} ${r.content ?? ""}`]));

  for (const node of allNodes) {
    let text: string | undefined;
    switch (node.source) {
      case "virginia_code": text = vcMap.get(node.source_id); break;
      case "constitution":  text = constMap.get(node.source_id); break;
      case "authorities":   text = authMap.get(node.source_id); break;
      case "courts":        text = courtMap.get(node.source_id); break;
      case "popular_names": text = pnMap.get(node.source_id); break;
      case "documents":     text = docMap.get(node.source_id); break;
    }
    if (text) textMap.set(node.id, text);
  }
  return textMap;
}

const nodeTexts = bulkLoadTexts();

// Build flat Int32Array for Jaccard — one set of SET_SIZE per embedding row.
// Padding uses constant 0. Since jaccard_index_dataspace deduplicates internally,
// all padding collapses to a single shared element, adding a small constant bias
// (+1 to both intersection and union) rather than inflating the denominator.
const JACCARD_PAD = 0; // all hashes are >= 1, so 0 is a safe pad value
const jaccardFlat = new Int32Array(allRows.length * SET_SIZE);
const jaccardNodeIds = nodeIds; // same order as embedding rows

for (let i = 0; i < allRows.length; i++) {
  const nid = nodeIds[i];
  const text = nodeTexts.get(nid) ?? "";
  const hashes = tokenize(text);
  const offset = i * SET_SIZE;
  for (let j = 0; j < SET_SIZE; j++) {
    jaccardFlat[offset + j] = j < hashes.length ? hashes[j] : JACCARD_PAD;
  }
}

const nodesWithText = Array.from(nodeTexts.values()).filter((t) => t.length > 0).length;
console.log(`Jaccard corpus: ${allRows.length} sets of ${SET_SIZE} tokens (${nodesWithText} nodes with text, ${(jaccardFlat.byteLength / 1e6).toFixed(0)} MB)\n`);

// ── node lookup ──────────────────────────────────────────────────────────────

const nodeStmt = embDb.prepare(
  "SELECT id, source, source_id, chunk_idx, node_type FROM nodes WHERE id = ?",
);

function nodeLabel(id: number): string {
  const row = nodeStmt.get(id) as any;
  if (!row) return `<unknown:${id}>`;
  const chunk = row.chunk_idx > 0 ? ` [chunk ${row.chunk_idx}]` : "";
  return `[${row.node_type}] ${row.source_id}${chunk}`;
}

// ── source text snippet ──────────────────────────────────────────────────────

const virgStmts = {
  virginiaCode: virgDb.prepare("SELECT title, body FROM virginia_code WHERE section = ? LIMIT 1"),
  constitution: virgDb.prepare(
    "SELECT section_name, section_title, section_text FROM constitution WHERE article_id = ? AND section_count = ? LIMIT 1",
  ),
  authorities: virgDb.prepare("SELECT title, body FROM authorities WHERE short_name = ? LIMIT 1"),
  courts: virgDb.prepare("SELECT name, locality, type, district, city FROM courts WHERE id = ? LIMIT 1"),
  popularNames: virgDb.prepare("SELECT name, body FROM popular_names WHERE name = ? LIMIT 1"),
  documents: virgDb.prepare("SELECT title, content FROM documents WHERE filename = ? LIMIT 1"),
};

function snippet(id: number, maxLen = 120): string {
  const row = nodeStmt.get(id) as any;
  if (!row) return "";
  let text: string | null = null;
  try {
    switch (row.source) {
      case "virginia_code": {
        const r = virgStmts.virginiaCode.get(row.source_id) as any;
        text = r ? `${r.title ?? ""} | ${r.body ?? ""}` : null;
        break;
      }
      case "constitution": {
        const [a, s] = row.source_id.split(":");
        const r = virgStmts.constitution.get(parseInt(a), parseInt(s)) as any;
        text = r ? `${r.section_name ?? ""} ${r.section_title ?? ""} | ${r.section_text ?? ""}` : null;
        break;
      }
      case "authorities": {
        const r = virgStmts.authorities.get(row.source_id) as any;
        text = r ? `${r.title ?? ""} | ${r.body ?? ""}` : null;
        break;
      }
      case "courts": {
        const r = virgStmts.courts.get(parseInt(row.source_id)) as any;
        text = r ? `${r.name ?? ""} ${r.locality ?? ""} ${r.type ?? ""}` : null;
        break;
      }
      case "popular_names": {
        const r = virgStmts.popularNames.get(row.source_id) as any;
        text = r ? `${r.name ?? ""} | ${r.body ?? ""}` : null;
        break;
      }
      case "documents": {
        const r = virgStmts.documents.get(row.source_id) as any;
        text = r ? `${r.title ?? ""}` : null;
        break;
      }
    }
  } catch {}
  if (!text) return "";
  text = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}

// ── embed query via local server ─────────────────────────────────────────────

async function embedQuery(text: string): Promise<Float64Array> {
  const res = await fetch(`${EMBED_URL}/v1/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: text, model: "local" }),
  });
  if (!res.ok) throw new Error(`Embedding server error: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as any;
  const vec: number[] = json.data[0].embedding;
  return new Float64Array(vec);
}

// ── wasm-powered multi-metric ranking ────────────────────────────────────────

type MetricName = "cosSim" | "cosDist" | "eucDist" | "sqEucDist";

interface ScoredResult {
  nodeId: number;
  cosSim: number;
  cosDist: number;
  eucDist: number;
  sqEucDist: number;
  jaccard: number;
}

function parseRanked(ranked: Float64Array): Map<number, number> {
  const map = new Map<number, number>();
  for (let i = 0; i < ranked.length; i += 2) {
    map.set(nodeIds[ranked[i + 1]], ranked[i]);
  }
  return map;
}

function rankByQuery(queryVec: Float64Array, queryText: string, topK: number): ScoredResult[] {
  // Primary ranking by cosine similarity (descending)
  const cosSimRanked = cosine_similarity_dataspace(flat, allRows.length, dim, queryVec);

  // Compute all vector metrics across the full corpus
  const cosDistScores = parseRanked(cosine_distance_dataspace(flat, allRows.length, dim, queryVec));
  const eucDistScores = parseRanked(euclidean_distance_dataspace(flat, allRows.length, dim, queryVec));
  const sqEucDistScores = parseRanked(squared_euclidean_distance_dataspace(flat, allRows.length, dim, queryVec));

  // Compute Jaccard scores — tokenize query and rank against token-set corpus
  const queryHashes = tokenize(queryText);
  const querySet = new Int32Array(SET_SIZE);
  for (let j = 0; j < SET_SIZE; j++) {
    querySet[j] = j < queryHashes.length ? queryHashes[j] : JACCARD_PAD;
  }
  const jaccardRanked = jaccard_index_dataspace(querySet, jaccardFlat, allRows.length, SET_SIZE);
  const jaccardScores = new Map<number, number>();
  for (let i = 0; i < jaccardRanked.length; i += 2) {
    jaccardScores.set(jaccardNodeIds[jaccardRanked[i + 1]], jaccardRanked[i]);
  }

  // Build multi-metric results for top-K (ordered by cosine similarity)
  const results: ScoredResult[] = [];
  for (let i = 0; i < cosSimRanked.length && results.length < topK; i += 2) {
    const nid = nodeIds[cosSimRanked[i + 1]];
    results.push({
      nodeId: nid,
      cosSim: cosSimRanked[i],
      cosDist: cosDistScores.get(nid) ?? NaN,
      eucDist: eucDistScores.get(nid) ?? NaN,
      sqEucDist: sqEucDistScores.get(nid) ?? NaN,
      jaccard: jaccardScores.get(nid) ?? 0,
    });
  }
  return results;
}

// Compute corpus-wide percentiles for each metric from a random sample
function computeBaselinePercentiles(queryVec: Float64Array, queryText: string, sampleSize = 500) {
  const cosSimRanked = cosine_similarity_dataspace(flat, allRows.length, dim, queryVec);
  const cosDistRanked = cosine_distance_dataspace(flat, allRows.length, dim, queryVec);
  const eucDistRanked = euclidean_distance_dataspace(flat, allRows.length, dim, queryVec);
  const sqEucDistRanked = squared_euclidean_distance_dataspace(flat, allRows.length, dim, queryVec);

  // Jaccard baseline
  const queryHashes = tokenize(queryText);
  const querySet = new Int32Array(SET_SIZE);
  for (let j = 0; j < SET_SIZE; j++) {
    querySet[j] = j < queryHashes.length ? queryHashes[j] : JACCARD_PAD;
  }
  const jaccardRanked = jaccard_index_dataspace(querySet, jaccardFlat, allRows.length, SET_SIZE);

  // Sample evenly across the ranked list
  const n = Math.min(allRows.length, cosSimRanked.length / 2);
  const step = Math.max(1, Math.floor(n / sampleSize));
  const cosSims: number[] = [];
  const cosDists: number[] = [];
  const eucDists: number[] = [];
  const sqEucDists: number[] = [];
  const jaccards: number[] = [];

  for (let i = 0; i < cosSimRanked.length; i += 2 * step) cosSims.push(cosSimRanked[i]);
  for (let i = 0; i < cosDistRanked.length; i += 2 * step) cosDists.push(cosDistRanked[i]);
  for (let i = 0; i < eucDistRanked.length; i += 2 * step) eucDists.push(eucDistRanked[i]);
  for (let i = 0; i < sqEucDistRanked.length; i += 2 * step) sqEucDists.push(sqEucDistRanked[i]);
  for (let i = 0; i < jaccardRanked.length; i += 2 * step) jaccards.push(jaccardRanked[i]);

  const pct = (arr: number[], p: number) => {
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor((p / 100) * sorted.length)] ?? 0;
  };

  return {
    cosSim:    { p5: pct(cosSims, 5), p25: pct(cosSims, 25), p50: pct(cosSims, 50), p75: pct(cosSims, 75), p95: pct(cosSims, 95) },
    cosDist:   { p5: pct(cosDists, 5), p25: pct(cosDists, 25), p50: pct(cosDists, 50), p75: pct(cosDists, 75), p95: pct(cosDists, 95) },
    eucDist:   { p5: pct(eucDists, 5), p25: pct(eucDists, 25), p50: pct(eucDists, 50), p75: pct(eucDists, 75), p95: pct(eucDists, 95) },
    sqEucDist: { p5: pct(sqEucDists, 5), p25: pct(sqEucDists, 25), p50: pct(sqEucDists, 50), p75: pct(sqEucDists, 75), p95: pct(sqEucDists, 95) },
    jaccard:   { p5: pct(jaccards, 5), p25: pct(jaccards, 25), p50: pct(jaccards, 50), p75: pct(jaccards, 75), p95: pct(jaccards, 95) },
  };
}

// ── natural language evaluation queries ──────────────────────────────────────

interface EvalQuery {
  question: string;
  expectTopics: string[];
}

const queries: EvalQuery[] = [
  {
    question: "What are the penalties for driving under the influence of alcohol in Virginia?",
    expectTopics: ["driv", "alcohol", "intoxicat", "DUI", "motor vehicle", "license", "blood alcohol"],
  },
  {
    question: "What constitutes first degree murder and what is the punishment?",
    expectTopics: ["murder", "manslaught", "kill", "homicid", "felon", "penalty", "premeditat"],
  },
  {
    question: "What rights does the Virginia constitution guarantee for freedom of speech and the press?",
    expectTopics: ["speech", "press", "freedom", "rights", "religion", "assembl", "Bill of Rights"],
  },
  {
    question: "How does Virginia law handle child custody and visitation after divorce?",
    expectTopics: ["child", "custod", "parent", "visitation", "family", "support", "divorce", "guardian"],
  },
  {
    question: "What are the rules for real estate transactions and property transfers in Virginia?",
    expectTopics: ["property", "deed", "conveyan", "estate", "land", "tenant", "real estate", "transfer"],
  },
  {
    question: "How are income taxes assessed and collected under Virginia tax law?",
    expectTopics: ["tax", "revenue", "assess", "rate", "levy", "income", "return", "commissioner"],
  },
  {
    question: "What environmental regulations govern water pollution and waste disposal in Virginia?",
    expectTopics: ["environment", "pollut", "water", "waste", "conserv", "air", "discharge", "permit"],
  },
  {
    question: "How can I request public records from a Virginia government agency under FOIA?",
    expectTopics: ["record", "public", "information", "disclos", "government", "inspect", "freedom", "FOIA"],
  },
  {
    question: "What is the process for forming a limited liability company in Virginia?",
    expectTopics: ["LLC", "liability", "compan", "formation", "articles", "organiz", "registered", "member"],
  },
  {
    question: "What are the landlord's obligations for maintaining rental property in Virginia?",
    expectTopics: ["landlord", "tenant", "rental", "lease", "repair", "habitab", "dwelling", "security deposit"],
  },
  {
    question: "How does Virginia regulate the sale and distribution of firearms?",
    expectTopics: ["firearm", "gun", "weapon", "concealed", "handgun", "purchase", "dealer", "background"],
  },
  {
    question: "What are the grounds for filing a personal injury lawsuit in Virginia?",
    expectTopics: ["injur", "negligenc", "damage", "tort", "liability", "plaintiff", "compensat"],
  },
  {
    question: "How are workers' compensation claims handled in Virginia?",
    expectTopics: ["worker", "compensat", "employ", "injur", "disab", "occupat", "commission"],
  },
  {
    question: "What court has jurisdiction over juvenile criminal cases in Virginia?",
    expectTopics: ["juvenile", "court", "minor", "delinquen", "family", "district", "judge"],
  },
  {
    question: "What are the requirements for a valid will and estate planning in Virginia?",
    expectTopics: ["will", "estate", "probat", "testat", "inherit", "executor", "beneficiar", "decedent"],
  },
];

// ── verify embedding server is reachable ─────────────────────────────────────

async function checkServer(): Promise<boolean> {
  try {
    const res = await fetch(`${EMBED_URL}/v1/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: "test", model: "local" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const serverOk = await checkServer();
  if (!serverOk) {
    console.error("Embedding server not reachable at", EMBED_URL);
    console.error("Start it with: cargo run --release --bin embedding-server");
    process.exit(1);
  }

  console.log("=" .repeat(100));
  console.log("SEMANTIC SEARCH QUALITY EVALUATION — Natural Language Queries");
  console.log("=" .repeat(100));

  const nodeCount = (embDb.prepare("SELECT COUNT(*) as c FROM nodes").get() as any).c;
  const embCount = (embDb.prepare("SELECT COUNT(*) as c FROM embeddings").get() as any).c;
  const edgeCount = (embDb.prepare("SELECT COUNT(*) as c FROM edges").get() as any).c;
  console.log(`Database: ${nodeCount} nodes, ${embCount} embeddings, ${edgeCount} edges`);
  console.log(`Embedding server: ${EMBED_URL}`);
  console.log(`Similarity engine: wasm-similarity (cosine_similarity_dataspace)\n`);

  interface QueryResult {
    question: string;
    topicHitRate: number;
    cosSim:    { top1: number; avg10: number };
    cosDist:   { top1: number; avg10: number };
    eucDist:   { top1: number; avg10: number };
    sqEucDist: { top1: number; avg10: number };
    jaccard:   { top1: number; avg10: number };
    typeCounts: Record<string, number>;
  }

  const results: QueryResult[] = [];

  for (const q of queries) {
    console.log(`${"─".repeat(130)}`);
    console.log(`Q: "${q.question}"`);
    console.log(`  ${"#".padStart(4)}  cosSim  cosDist eucDist sqEucDst jaccard   node`);

    const queryVec = await embedQuery(q.question);
    const similar = rankByQuery(queryVec, q.question, K);
    const baseline = computeBaselinePercentiles(queryVec, q.question);

    let topicHits = 0;
    const typeCounts: Record<string, number> = {};

    for (let i = 0; i < similar.length; i++) {
      const s = similar[i];
      const label = nodeLabel(s.nodeId);
      const snip = snippet(s.nodeId, 100);
      const fullText = (label + " " + snip).toLowerCase();

      const row = nodeStmt.get(s.nodeId) as any;
      typeCounts[row?.node_type ?? "?"] = (typeCounts[row?.node_type ?? "?"] ?? 0) + 1;

      const matchedTopics = q.expectTopics.filter((kw) => fullText.includes(kw.toLowerCase()));
      const hit = matchedTopics.length > 0;
      if (hit) topicHits++;

      const marker = hit ? "+" : "-";
      const scores = `${s.cosSim.toFixed(4)}  ${s.cosDist.toFixed(4)}  ${s.eucDist.toFixed(4)}  ${s.sqEucDist.toFixed(4)}  ${s.jaccard.toFixed(4)}`;
      console.log(`  ${(i + 1).toString().padStart(4)}  ${scores}  ${marker} ${label}`);
      console.log(`${"".padStart(8)}${snip}`);
      if (matchedTopics.length > 0) {
        console.log(`${"".padStart(8)}~ ${matchedTopics.join(", ")}`);
      }
    }

    const avgOf = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const topicHitRate = topicHits / similar.length;

    console.log();
    console.log(`  Corpus baseline (percentiles against this query):`);
    console.log(`    cosSim   P5=${baseline.cosSim.p5.toFixed(4)}  P25=${baseline.cosSim.p25.toFixed(4)}  P50=${baseline.cosSim.p50.toFixed(4)}  P75=${baseline.cosSim.p75.toFixed(4)}  P95=${baseline.cosSim.p95.toFixed(4)}`);
    console.log(`    cosDist  P5=${baseline.cosDist.p5.toFixed(4)}  P25=${baseline.cosDist.p25.toFixed(4)}  P50=${baseline.cosDist.p50.toFixed(4)}  P75=${baseline.cosDist.p75.toFixed(4)}  P95=${baseline.cosDist.p95.toFixed(4)}`);
    console.log(`    eucDist  P5=${baseline.eucDist.p5.toFixed(4)}  P25=${baseline.eucDist.p25.toFixed(4)}  P50=${baseline.eucDist.p50.toFixed(4)}  P75=${baseline.eucDist.p75.toFixed(4)}  P95=${baseline.eucDist.p95.toFixed(4)}`);
    console.log(`    sqEucDst P5=${baseline.sqEucDist.p5.toFixed(4)}  P25=${baseline.sqEucDist.p25.toFixed(4)}  P50=${baseline.sqEucDist.p50.toFixed(4)}  P75=${baseline.sqEucDist.p75.toFixed(4)}  P95=${baseline.sqEucDist.p95.toFixed(4)}`);
    console.log(`    jaccard  P5=${baseline.jaccard.p5.toFixed(4)}  P25=${baseline.jaccard.p25.toFixed(4)}  P50=${baseline.jaccard.p50.toFixed(4)}  P75=${baseline.jaccard.p75.toFixed(4)}  P95=${baseline.jaccard.p95.toFixed(4)}`);
    console.log();
    console.log(`  Hit rate: ${topicHits}/${similar.length} (${(topicHitRate * 100).toFixed(0)}%)`);
    const typeStr = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t}:${c}`).join("  ");
    console.log(`  Types: ${typeStr}`);

    results.push({
      question: q.question,
      topicHitRate,
      cosSim:    { top1: similar[0]?.cosSim ?? 0,    avg10: avgOf(similar.map(s => s.cosSim)) },
      cosDist:   { top1: similar[0]?.cosDist ?? 0,    avg10: avgOf(similar.map(s => s.cosDist)) },
      eucDist:   { top1: similar[0]?.eucDist ?? 0,    avg10: avgOf(similar.map(s => s.eucDist)) },
      sqEucDist: { top1: similar[0]?.sqEucDist ?? 0, avg10: avgOf(similar.map(s => s.sqEucDist)) },
      jaccard:   { top1: similar[0]?.jaccard ?? 0,   avg10: avgOf(similar.map(s => s.jaccard)) },
      typeCounts,
    });
  }

  // ── summary ────────────────────────────────────────────────────────────────

  console.log(`\n${"═".repeat(130)}`);
  console.log("SUMMARY");
  console.log("═".repeat(130));

  const n = results.length;
  const avgAll = (fn: (r: QueryResult) => number) => results.reduce((s, r) => s + fn(r), 0) / n;

  console.log(`\n  Queries evaluated:     ${n}`);
  console.log(`  Avg topic hit rate:    ${(avgAll(r => r.topicHitRate) * 100).toFixed(1)}%`);
  console.log();
  console.log(`  Metric averages (across all queries):`);
  console.log(`  ${"".padEnd(10)} ${"Top-1".padStart(10)}  ${"Avg-10".padStart(10)}`);
  console.log(`  ${"─".repeat(35)}`);
  console.log(`  ${"cosSim".padEnd(10)} ${avgAll(r => r.cosSim.top1).toFixed(4).padStart(10)}  ${avgAll(r => r.cosSim.avg10).toFixed(4).padStart(10)}`);
  console.log(`  ${"cosDist".padEnd(10)} ${avgAll(r => r.cosDist.top1).toFixed(4).padStart(10)}  ${avgAll(r => r.cosDist.avg10).toFixed(4).padStart(10)}`);
  console.log(`  ${"eucDist".padEnd(10)} ${avgAll(r => r.eucDist.top1).toFixed(4).padStart(10)}  ${avgAll(r => r.eucDist.avg10).toFixed(4).padStart(10)}`);
  console.log(`  ${"sqEucDist".padEnd(10)} ${avgAll(r => r.sqEucDist.top1).toFixed(4).padStart(10)}  ${avgAll(r => r.sqEucDist.avg10).toFixed(4).padStart(10)}`);
  console.log(`  ${"jaccard".padEnd(10)} ${avgAll(r => r.jaccard.top1).toFixed(4).padStart(10)}  ${avgAll(r => r.jaccard.avg10).toFixed(4).padStart(10)}`);

  console.log(`\n  Per-query profile:`);
  console.log(`  ${"Question".padEnd(45)} Hit%  cosSim         cosDist        eucDist        sqEucDist      jaccard`);
  console.log(`  ${"".padEnd(45)}       top1   avg10   top1   avg10   top1   avg10   top1   avg10   top1   avg10`);
  console.log(`  ${"─".repeat(145)}`);
  for (const r of results) {
    const short = r.question.length > 42 ? r.question.slice(0, 39) + "..." : r.question;
    const f = (v: number) => v.toFixed(4).padStart(7);
    console.log(
      `  ${short.padEnd(45)} ${(r.topicHitRate * 100).toFixed(0).padStart(3)}% ${f(r.cosSim.top1)}${f(r.cosSim.avg10)} ${f(r.cosDist.top1)}${f(r.cosDist.avg10)} ${f(r.eucDist.top1)}${f(r.eucDist.avg10)} ${f(r.sqEucDist.top1)}${f(r.sqEucDist.avg10)} ${f(r.jaccard.top1)}${f(r.jaccard.avg10)}`,
    );
  }

  console.log();
  embDb.close();
  virgDb.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
