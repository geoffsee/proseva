import { Database } from "bun:sqlite";
import { createSchema, createYoga } from "graphql-yoga";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";

// --- Cosine similarity (exported for unit testing) ---

export function blobToF32(blob: Buffer | Uint8Array): Float32Array {
  const buf = Buffer.from(blob);
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

export function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// --- Source text resolution ---

function buildVirgStmts(virgDb: Database) {
  return {
    virginiaCode: virgDb.prepare(
      "SELECT title, body FROM virginia_code WHERE section = ? LIMIT 1",
    ),
    constitution: virgDb.prepare(
      "SELECT section_name, section_title, section_text FROM constitution WHERE article_id = ? AND section_count = ? LIMIT 1",
    ),
    authorities: virgDb.prepare(
      "SELECT title, body FROM authorities WHERE short_name = ? LIMIT 1",
    ),
    courts: virgDb.prepare(
      "SELECT name, locality, type, district, city FROM courts WHERE id = ? LIMIT 1",
    ),
    popularNames: virgDb.prepare(
      "SELECT name, body FROM popular_names WHERE name = ? LIMIT 1",
    ),
    documents: virgDb.prepare(
      "SELECT title, content FROM documents WHERE filename = ? LIMIT 1",
    ),
  };
}

export function resolveSourceText(
  virgStmts: ReturnType<typeof buildVirgStmts> | null,
  source: string,
  sourceId: string,
): string | null {
  if (!virgStmts) return null;
  try {
    switch (source) {
      case "virginia_code": {
        const row = virgStmts.virginiaCode.get(sourceId) as any;
        return row ? `${row.title ?? ""}\n${row.body ?? ""}`.trim() : null;
      }
      case "constitution": {
        const parts = sourceId.split(":");
        if (parts.length === 2) {
          const row = virgStmts.constitution.get(
            parseInt(parts[0]),
            parseInt(parts[1]),
          ) as any;
          return row
            ? `${row.section_name ?? ""} ${row.section_title ?? ""}\n${row.section_text ?? ""}`.trim()
            : null;
        }
        return null;
      }
      case "authorities": {
        const row = virgStmts.authorities.get(sourceId) as any;
        return row ? `${row.title ?? ""}\n${row.body ?? ""}`.trim() : null;
      }
      case "courts": {
        const row = virgStmts.courts.get(parseInt(sourceId)) as any;
        return row
          ? `${row.name ?? ""} - ${row.locality ?? ""} ${row.type ?? ""} ${row.district ?? ""} ${row.city ?? ""}`.trim()
          : null;
      }
      case "popular_names": {
        const row = virgStmts.popularNames.get(sourceId) as any;
        return row ? `${row.name ?? ""}\n${row.body ?? ""}`.trim() : null;
      }
      case "documents": {
        const row = virgStmts.documents.get(sourceId) as any;
        if (!row) return null;
        const content = (row.content ?? "") as string;
        return `${row.title ?? ""}\n${content.length > 2000 ? content.slice(0, 2000) + "..." : content}`.trim();
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// --- App factory (exported for testing) ---

export function createApp(embeddingsPath: string, virginiaPath?: string) {
  // Open embeddings DB in default mode instead of readonly.
  // In practice, Bun's sqlite readonly mode can fail with WAL-mode DBs.
  const embDb = new Database(embeddingsPath);

  let virgDb: Database | null = null;
  let virgStmts: ReturnType<typeof buildVirgStmts> | null = null;
  if (virginiaPath) {
    virgDb = new Database(virginiaPath, { readonly: true });
    virgStmts = buildVirgStmts(virgDb);
  }

  const stmts = {
    nodeCount: embDb.prepare("SELECT COUNT(*) as count FROM nodes"),
    edgeCount: embDb.prepare("SELECT COUNT(*) as count FROM edges"),
    embeddingCount: embDb.prepare("SELECT COUNT(*) as count FROM embeddings"),
    nodeTypes: embDb.prepare(
      "SELECT node_type as type, COUNT(*) as count FROM nodes GROUP BY node_type ORDER BY count DESC",
    ),
    edgeTypes: embDb.prepare(
      "SELECT rel_type as type, COUNT(*) as count FROM edges GROUP BY rel_type ORDER BY count DESC",
    ),
    nodeById: embDb.prepare(
      "SELECT id, source, source_id, chunk_idx, node_type FROM nodes WHERE id = ?",
    ),
    hasEmbedding: embDb.prepare("SELECT 1 FROM embeddings WHERE node_id = ?"),
    edgesFrom: embDb.prepare(
      "SELECT from_id, to_id, rel_type, weight FROM edges WHERE from_id = ?",
    ),
    edgesTo: embDb.prepare(
      "SELECT from_id, to_id, rel_type, weight FROM edges WHERE to_id = ?",
    ),
    embedding: embDb.prepare(
      "SELECT embedding FROM embeddings WHERE node_id = ?",
    ),
    allEmbeddings: embDb.prepare("SELECT node_id, embedding FROM embeddings"),
    nodesFiltered: embDb.prepare(
      "SELECT id, source, source_id, chunk_idx, node_type FROM nodes WHERE (?1 IS NULL OR node_type = ?1) AND (?2 IS NULL OR source_id LIKE '%' || ?2 || '%' OR source LIKE '%' || ?2 || '%') LIMIT ?3 OFFSET ?4",
    ),
    nodesFilteredCount: embDb.prepare(
      "SELECT COUNT(*) as count FROM nodes WHERE (?1 IS NULL OR node_type = ?1) AND (?2 IS NULL OR source_id LIKE '%' || ?2 || '%' OR source LIKE '%' || ?2 || '%')",
    ),
  };

  function resolveNode(id: number) {
    const row = stmts.nodeById.get(id) as any;
    if (!row) return null;
    const n = {
      id: row.id,
      source: row.source,
      sourceId: row.source_id,
      chunkIdx: row.chunk_idx,
      nodeType: row.node_type,
    };
    return {
      ...n,
      hasEmbedding: !!stmts.hasEmbedding.get(id),
      sourceText: resolveSourceText(virgStmts, n.source, n.sourceId),
      edges: () => {
        const from = stmts.edgesFrom.all(id) as any[];
        const to = stmts.edgesTo.all(id) as any[];
        return [...from, ...to].map((e) => ({
          fromId: e.from_id,
          toId: e.to_id,
          relType: e.rel_type,
          weight: e.weight,
        }));
      },
    };
  }

  const typeDefs = /* GraphQL */ `
    type Query {
      stats: Stats!
      nodes(
        type: String
        search: String
        limit: Int
        offset: Int
      ): NodeConnection!
      node(id: Int!): Node
      neighbors(id: Int!): [Edge!]!
      similar(id: Int!, limit: Int): [SimilarNode!]!
    }
    type Stats {
      nodeCount: Int!
      edgeCount: Int!
      embeddingCount: Int!
      nodeTypes: [TypeCount!]!
      edgeTypes: [TypeCount!]!
    }
    type TypeCount {
      type: String!
      count: Int!
    }
    type NodeConnection {
      nodes: [Node!]!
      total: Int!
    }
    type Node {
      id: Int!
      source: String!
      sourceId: String!
      chunkIdx: Int!
      nodeType: String!
      hasEmbedding: Boolean!
      sourceText: String
      edges: [Edge!]!
    }
    type Edge {
      fromId: Int!
      toId: Int!
      relType: String!
      weight: Float
      fromNode: Node
      toNode: Node
    }
    type SimilarNode {
      node: Node!
      score: Float!
    }
  `;

  const resolvers = {
    Query: {
      stats: () => ({
        nodeCount: (stmts.nodeCount.get() as any).count,
        edgeCount: (stmts.edgeCount.get() as any).count,
        embeddingCount: (stmts.embeddingCount.get() as any).count,
        nodeTypes: stmts.nodeTypes.all(),
        edgeTypes: stmts.edgeTypes.all(),
      }),

      nodes: (
        _parent: any,
        args: {
          type?: string;
          search?: string;
          limit?: number;
          offset?: number;
        },
      ) => {
        const limit = Math.min(args.limit ?? 50, 200);
        const offset = args.offset ?? 0;
        const type = args.type || null;
        const search = args.search || null;
        const rows = stmts.nodesFiltered.all(
          type,
          search,
          limit,
          offset,
        ) as any[];
        const total = (stmts.nodesFilteredCount.get(type, search) as any).count;
        return { nodes: rows.map((r) => resolveNode(r.id)), total };
      },

      node: (_parent: any, args: { id: number }) => resolveNode(args.id),

      neighbors: (_parent: any, args: { id: number }) => {
        const from = stmts.edgesFrom.all(args.id) as any[];
        const to = stmts.edgesTo.all(args.id) as any[];
        return [...from, ...to].map((e) => ({
          fromId: e.from_id,
          toId: e.to_id,
          relType: e.rel_type,
          weight: e.weight,
        }));
      },

      similar: (_: any, args: { id: number; limit?: number }) => {
        const topK = Math.min(args.limit ?? 10, 50);
        const targetRow = stmts.embedding.get(args.id) as any;
        if (!targetRow) return [];
        const targetVec = blobToF32(targetRow.embedding);
        const all = stmts.allEmbeddings.all() as any[];
        const scored: { nodeId: number; score: number }[] = [];
        for (const row of all) {
          if (row.node_id === args.id) continue;
          const vec = blobToF32(row.embedding);
          scored.push({
            nodeId: row.node_id,
            score: cosineSim(targetVec, vec),
          });
        }
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, topK).map((s) => ({
          node: resolveNode(s.nodeId),
          score: s.score,
        }));
      },
    },

    Edge: {
      fromNode: (edge: any) => resolveNode(edge.fromId),
      toNode: (edge: any) => resolveNode(edge.toId),
    },
  };

  const schema = createSchema({ typeDefs, resolvers });
  const yoga = createYoga({ schema, graphqlEndpoint: "/graphql" });

  function cleanup() {
    embDb.close();
    virgDb?.close();
  }

  return { yoga, cleanup };
}

// --- CLI entrypoint ---

if (import.meta.main) {
  const args = process.argv.slice(2);
  const explorerDir = dirname(new URL(import.meta.url).pathname);
  const defaultEmbeddings = join(
    explorerDir,
    "../../datasets/data/embeddings.sqlite.db",
  );
  const defaultVirginia = join(explorerDir, "../../datasets/data/virginia.db");

  let embeddings = "";
  let virginia = "";
  let port = 3002;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--embeddings" && args[i + 1]) embeddings = args[++i];
    else if (args[i] === "--virginia" && args[i + 1]) virginia = args[++i];
    else if (args[i] === "--port" && args[i + 1])
      port = parseInt(args[++i], 10);
  }

  // Convenience defaults for local dev in this monorepo.
  if (!embeddings && existsSync(defaultEmbeddings)) {
    embeddings = defaultEmbeddings;
  }
  if (!virginia && existsSync(defaultVirginia)) {
    virginia = defaultVirginia;
  }

  if (!embeddings) {
    console.error(
      "Usage: bun server.ts --embeddings <path> [--virginia <path>] [--port <n>]",
    );
    console.error(
      `Hint: expected default embeddings DB at ${defaultEmbeddings}`,
    );
    process.exit(1);
  }

  const { yoga } = createApp(embeddings, virginia || undefined);
  const htmlPath = join(explorerDir, "index.html");

  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/" || url.pathname === "/index.html") {
        try {
          const html = readFileSync(htmlPath, "utf-8");
          return new Response(html, {
            headers: { "Content-Type": "text/html" },
          });
        } catch {
          return new Response("index.html not found", { status: 404 });
        }
      }

      if (url.pathname === "/graphql") {
        const res = await yoga.fetch(req);
        return new Response(res.body, {
          status: res.status,
          statusText: res.statusText,
          headers: Object.fromEntries(res.headers.entries()),
        });
      }

      return new Response("Not found", { status: 404 });
    },
  });

  console.log(`Embeddings Explorer running at http://localhost:${server.port}`);
  console.log(`  GraphiQL: http://localhost:${server.port}/graphql`);
  console.log(`  Embeddings DB: ${embeddings}`);
  if (virginia) console.log(`  Virginia DB: ${virginia}`);
}
