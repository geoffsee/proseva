/**
 * Smoke test for the semanticSearch GraphQL query.
 *
 * Usage:
 *   bun scripts/test-semantic-search.ts "search query here" [--port 3001] [--limit 5]
 *
 * Embeds the query text via OpenAI, then hits the GraphQL endpoint.
 * Requires OPENAI_API_KEY env var (or inherits from the running server's config).
 */
import OpenAI from "openai";
import { Database } from "bun:sqlite";
import { resolve } from "path";
import { existsSync } from "fs";

// --- parse args ---

const args = process.argv.slice(2);
let query = "";
let port = "3001";
let limit = 5;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port") port = args[++i];
  else if (args[i] === "--limit") limit = parseInt(args[++i], 10);
  else if (!args[i].startsWith("--")) query = args[i];
}

if (!query) {
  console.error("Usage: bun scripts/test-semantic-search.ts \"your query\" [--port 3001] [--limit 5]");
  process.exit(1);
}

const GQL = `http://localhost:${port}/api/graphql`;

// --- detect corpus dimension from embeddings DB ---

const datasetsDir = process.env.DATASETS_DIR ?? "../datasets/data";
const embPath = resolve(datasetsDir, "embeddings.sqlite.db");

let corpusDim = 1024; // default
if (existsSync(embPath)) {
  const embDb = new Database(embPath, { readonly: true });
  const row = embDb
    .query("SELECT value FROM model_info WHERE key = 'dimension'")
    .get() as { value: string } | null;
  if (row) corpusDim = parseInt(row.value, 10);
  embDb.close();
}

// --- embed the query ---

const embBase = process.env.OPENAI_BASE_URL ?? "http://localhost:8000/v1";
const openai = new OpenAI({ baseURL: embBase, apiKey: process.env.OPENAI_API_KEY ?? "unused" });
const model = process.env.EMBEDDINGS_MODEL ?? "Octen/Octen-Embedding-0.6B";
console.log(`Embedding query: "${query}" (model=${model}, base=${embBase}, dim=${corpusDim})`);

const embResponse = await openai.embeddings.create({
  model,
  input: query,
});

const vector = embResponse.data[0].embedding;
console.log(`Got ${vector.length}-dim embedding\n`);

// --- query graphql ---

console.log(`Querying ${GQL} ...\n`);

const res = await fetch(GQL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    query: `query($vector: [Float!]!, $limit: Int) {
      semanticSearch(vector: $vector, limit: $limit) {
        nodeId source sourceId nodeType score content
      }
    }`,
    variables: { vector, limit },
  }),
});

if (!res.ok) {
  console.error(`HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const body = (await res.json()) as { data?: any; errors?: any[] };

if (body.errors) {
  console.error("GraphQL errors:", JSON.stringify(body.errors, null, 2));
  process.exit(1);
}

const hits = body.data.semanticSearch;
console.log(`${hits.length} results:\n`);

for (const hit of hits) {
  const preview = hit.content
    ? hit.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 150)
    : "(no content resolved)";
  console.log(`  ${hit.score.toFixed(4)}  ${hit.source}:${hit.sourceId} (${hit.nodeType})`);
  console.log(`         ${preview}\n`);
}
