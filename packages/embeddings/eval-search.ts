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
import { initSync, cosine_similarity_dataspace } from "wasm-similarity/wasm_similarity_core.js";
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

// ── wasm-powered ranking ─────────────────────────────────────────────────────

function rankByQuery(queryVec: Float64Array, topK: number): { nodeId: number; score: number }[] {
  const ranked = cosine_similarity_dataspace(flat, allRows.length, dim, queryVec);
  const results: { nodeId: number; score: number }[] = [];
  for (let i = 0; i < ranked.length && results.length < topK; i += 2) {
    const score = ranked[i];
    const idx = ranked[i + 1];
    results.push({ nodeId: nodeIds[idx], score });
  }
  return results;
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

  const results: { question: string; topicHitRate: number; avgScore: number; topScore: number }[] = [];

  for (const q of queries) {
    console.log(`${"─".repeat(100)}`);
    console.log(`Q: "${q.question}"`);

    const queryVec = await embedQuery(q.question);
    const similar = rankByQuery(queryVec, K);

    let topicHits = 0;

    for (let i = 0; i < similar.length; i++) {
      const s = similar[i];
      const label = nodeLabel(s.nodeId);
      const snip = snippet(s.nodeId, 150);
      const fullText = (label + " " + snip).toLowerCase();

      const matchedTopics = q.expectTopics.filter((kw) => fullText.includes(kw.toLowerCase()));
      const hit = matchedTopics.length > 0;
      if (hit) topicHits++;

      const marker = hit ? "+" : "-";
      console.log(`  ${(i + 1).toString().padStart(2)}. [${s.score.toFixed(4)}] ${marker} ${label}`);
      console.log(`      ${snip}`);
      if (matchedTopics.length > 0) {
        console.log(`      ~ ${matchedTopics.join(", ")}`);
      }
    }

    const avgScore = similar.reduce((s, r) => s + r.score, 0) / similar.length;
    const topScore = similar[0]?.score ?? 0;
    const topicHitRate = topicHits / similar.length;

    console.log(`  Hit rate: ${topicHits}/${similar.length} (${(topicHitRate * 100).toFixed(0)}%)  |  Scores: ${topScore.toFixed(4)} .. ${(similar[similar.length - 1]?.score ?? 0).toFixed(4)}  (avg ${avgScore.toFixed(4)})`);

    results.push({ question: q.question, topicHitRate, avgScore, topScore });
  }

  // ── cross-type analysis ──────────────────────────────────────────────────

  console.log(`\n${"═".repeat(100)}`);
  console.log("CROSS-TYPE RETRIEVAL — node types appearing in top-10 per query\n");

  for (const q of queries) {
    const queryVec = await embedQuery(q.question);
    const similar = rankByQuery(queryVec, K);
    const typeCounts: Record<string, number> = {};
    for (const s of similar) {
      const row = nodeStmt.get(s.nodeId) as any;
      const t = row?.node_type ?? "unknown";
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    }
    const typeStr = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([t, c]) => `${t}:${c}`)
      .join("  ");
    const short = q.question.length > 55 ? q.question.slice(0, 52) + "..." : q.question;
    console.log(`  ${short.padEnd(56)} ${typeStr}`);
  }

  // ── summary ────────────────────────────────────────────────────────────────

  console.log(`\n${"═".repeat(100)}`);
  console.log("SUMMARY");
  console.log("═".repeat(100));

  const avgHitRate = results.reduce((s, r) => s + r.topicHitRate, 0) / results.length;
  const avgAvgScore = results.reduce((s, r) => s + r.avgScore, 0) / results.length;
  const avgTopScore = results.reduce((s, r) => s + r.topScore, 0) / results.length;

  console.log(`\n  Queries evaluated:     ${results.length}`);
  console.log(`  Avg topic hit rate:    ${(avgHitRate * 100).toFixed(1)}%`);
  console.log(`  Avg top-1 score:       ${avgTopScore.toFixed(4)}`);
  console.log(`  Avg top-10 score:      ${avgAvgScore.toFixed(4)}`);

  console.log(`\n  ${"Question".padEnd(58)} Hit%    Top-1   Avg-10`);
  console.log(`  ${"─".repeat(90)}`);
  for (const r of results) {
    const short = r.question.length > 55 ? r.question.slice(0, 52) + "..." : r.question;
    console.log(
      `  ${short.padEnd(58)} ${(r.topicHitRate * 100).toFixed(0).padStart(3)}%    ${r.topScore.toFixed(4)}  ${r.avgScore.toFixed(4)}`,
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
