import { Database } from "bun:sqlite";
import { existsSync } from "fs";
import { join, resolve } from "path";
import { db } from "../db/client";
import { builder } from "./builder";
import {
  cosine_similarity_dataspace,
  ensureWasmSimilarityInit,
} from "../wasm-similarity-init";

// --- Court ---

builder.drizzleObject("courts", {
  name: "Court",
  fields: (t) => ({
    id: t.exposeInt("id"),
    name: t.exposeString("name"),
    locality: t.exposeString("locality", { nullable: true }),
    type: t.exposeString("type", { nullable: true }),
    district: t.exposeString("district", { nullable: true }),
    clerk: t.exposeString("clerk", { nullable: true }),
    phone: t.exposeString("phone", { nullable: true }),
    fax: t.exposeString("fax", { nullable: true }),
    email: t.exposeString("email", { nullable: true }),
    address: t.exposeString("address", { nullable: true }),
    city: t.exposeString("city", { nullable: true }),
    state: t.exposeString("state", { nullable: true }),
    zip: t.exposeString("zip", { nullable: true }),
    hours: t.exposeString("hours", { nullable: true }),
    homepage: t.exposeString("homepage", { nullable: true }),
    judges: t.field({
      type: ["String"],
      resolve: (row) => {
        try {
          return row.judges ? JSON.parse(row.judges) : [];
        } catch {
          return [];
        }
      },
    }),
  }),
});

// --- Constitution ---

builder.drizzleObject("constitution", {
  name: "ConstitutionSection",
  fields: (t) => ({
    id: t.exposeInt("id"),
    articleId: t.exposeInt("articleId", { nullable: true }),
    article: t.exposeString("article", { nullable: true }),
    articleName: t.exposeString("articleName", { nullable: true }),
    sectionName: t.exposeString("sectionName", { nullable: true }),
    sectionTitle: t.exposeString("sectionTitle", { nullable: true }),
    sectionText: t.exposeString("sectionText", { nullable: true }),
    sectionCount: t.exposeInt("sectionCount", { nullable: true }),
    lastUpdate: t.exposeString("lastUpdate", { nullable: true }),
  }),
});

// --- Virginia Code ---

builder.drizzleObject("virginiaCode", {
  name: "VirginiaCode",
  fields: (t) => ({
    id: t.exposeInt("id"),
    titleNum: t.exposeString("titleNum", { nullable: true }),
    titleName: t.exposeString("titleName", { nullable: true }),
    subtitleNum: t.exposeString("subtitleNum", { nullable: true }),
    subtitleName: t.exposeString("subtitleName", { nullable: true }),
    partNum: t.exposeString("partNum", { nullable: true }),
    partName: t.exposeString("partName", { nullable: true }),
    chapterNum: t.exposeString("chapterNum", { nullable: true }),
    chapterName: t.exposeString("chapterName", { nullable: true }),
    articleNum: t.exposeString("articleNum", { nullable: true }),
    articleName: t.exposeString("articleName", { nullable: true }),
    subpartNum: t.exposeString("subpartNum", { nullable: true }),
    subpartName: t.exposeString("subpartName", { nullable: true }),
    section: t.exposeString("section", { nullable: true }),
    title: t.exposeString("title", { nullable: true }),
    body: t.exposeString("body", { nullable: true }),
  }),
});

// --- Popular Names ---

builder.drizzleObject("popularNames", {
  name: "PopularName",
  fields: (t) => ({
    id: t.exposeInt("id"),
    name: t.exposeString("name", { nullable: true }),
    titleNum: t.exposeString("titleNum", { nullable: true }),
    section: t.exposeString("section", { nullable: true }),
    body: t.exposeString("body", { nullable: true }),
  }),
});

// --- Authorities ---

builder.drizzleObject("authorities", {
  name: "Authority",
  fields: (t) => ({
    id: t.exposeInt("id"),
    name: t.exposeString("name", { nullable: true }),
    shortName: t.exposeString("shortName", { nullable: true }),
    codified: t.exposeString("codified", { nullable: true }),
    title: t.exposeString("title", { nullable: true }),
    section: t.exposeString("section", { nullable: true }),
    body: t.exposeString("body", { nullable: true }),
  }),
});

// --- Documents ---

builder.drizzleObject("documents", {
  name: "Document",
  fields: (t) => ({
    id: t.exposeInt("id"),
    dataset: t.exposeString("dataset", { nullable: true }),
    filename: t.exposeString("filename", { nullable: true }),
    title: t.exposeString("title", { nullable: true }),
    content: t.exposeString("content", { nullable: true }),
  }),
});

// --- Helper: build RQBv2 where filter from optional LIKE args ---

function likeFilter(
  filters: Record<string, string | null | undefined>,
): Record<string, any> | undefined {
  const where: Record<string, any> = {};
  let hasFilter = false;
  for (const [col, val] of Object.entries(filters)) {
    if (val) {
      where[col] = { like: `%${val}%` };
      hasFilter = true;
    }
  }
  return hasFilter ? where : undefined;
}

// --- Semantic Search helpers ---

type EmbeddingRow = {
  node_id: number;
  source: string;
  source_id: string;
  node_type: string;
  embedding: Buffer;
};

function blobToF32(blob: Buffer | Uint8Array): Float32Array {
  const buf = Buffer.from(blob);
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

function resolveEmbeddingsDbPath(): string | null {
  const datasetsDir = process.env.DATASETS_DIR;
  if (!datasetsDir) return null;
  const serverRoot = join(import.meta.dir, "../..");
  const candidates = [
    resolve(datasetsDir, "embeddings.sqlite.db"),
    resolve(serverRoot, datasetsDir, "embeddings.sqlite.db"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

let embeddingsCache: {
  path: string;
  rows: EmbeddingRow[];
} | null = null;

function loadEmbeddingRows(): EmbeddingRow[] {
  const dbPath = resolveEmbeddingsDbPath();
  if (!dbPath) return [];
  if (embeddingsCache?.path === dbPath) return embeddingsCache.rows;

  const embDb = new Database(dbPath, { readonly: true });
  try {
    const rows = embDb
      .query(
        `SELECT e.node_id, n.source, n.source_id, n.node_type, e.embedding
         FROM embeddings e
         JOIN nodes n ON n.id = e.node_id`,
      )
      .all() as EmbeddingRow[];
    embeddingsCache = { path: dbPath, rows };
    return rows;
  } finally {
    embDb.close();
  }
}

/** Try to get chunk_meta (char_start, char_end) for a node from embeddings DB. */
function getChunkMeta(
  nodeId: number,
): { char_start: number; char_end: number } | null {
  const dbPath = resolveEmbeddingsDbPath();
  if (!dbPath) return null;
  try {
    const embDb = new Database(dbPath, { readonly: true });
    try {
      const row = embDb
        .query("SELECT char_start, char_end FROM chunk_meta WHERE node_id = ?")
        .get(nodeId) as { char_start: number; char_end: number } | null;
      return row;
    } finally {
      embDb.close();
    }
  } catch {
    return null;
  }
}

/** Strip HTML tags from a string (simple regex-based for query-time use). */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveSourceText(
  virgDb: Database,
  source: string,
  sourceId: string,
  nodeId: number,
): string | null {
  try {
    switch (source) {
      case "virginia_code": {
        const row = virgDb
          .query("SELECT title, body FROM virginia_code WHERE section = ? LIMIT 1")
          .get(sourceId) as { title: string | null; body: string | null } | null;
        return row ? `${row.title ?? ""}\n${row.body ?? ""}`.trim() : null;
      }
      case "constitution": {
        const parts = sourceId.split(":");
        if (parts.length === 2) {
          const row = virgDb
            .query(
              "SELECT section_name, section_title, section_text FROM constitution WHERE article_id = ? AND section_count = ? LIMIT 1",
            )
            .get(parseInt(parts[0]), parseInt(parts[1])) as {
            section_name: string | null;
            section_title: string | null;
            section_text: string | null;
          } | null;
          return row
            ? `${row.section_name ?? ""} ${row.section_title ?? ""}\n${row.section_text ?? ""}`.trim()
            : null;
        }
        return null;
      }
      case "authorities": {
        // Try chunk_meta for chunked authorities
        const meta = getChunkMeta(nodeId);
        const row = virgDb
          .query("SELECT title, body FROM authorities WHERE short_name = ? LIMIT 1")
          .get(sourceId) as { title: string | null; body: string | null } | null;
        if (!row) return null;
        if (meta) {
          const combined = `${stripHtml(row.title ?? "")} ${stripHtml(row.body ?? "")}`;
          return combined.slice(meta.char_start, meta.char_end).trim() || combined.trim();
        }
        return `${row.title ?? ""}\n${row.body ?? ""}`.trim();
      }
      case "courts": {
        const row = virgDb
          .query("SELECT name, locality, type, district, city FROM courts WHERE id = ? LIMIT 1")
          .get(parseInt(sourceId)) as {
          name: string | null;
          locality: string | null;
          type: string | null;
          district: string | null;
          city: string | null;
        } | null;
        return row
          ? `${row.name ?? ""} - ${row.locality ?? ""} ${row.type ?? ""} ${row.district ?? ""} ${row.city ?? ""}`.trim()
          : null;
      }
      case "popular_names": {
        const row = virgDb
          .query("SELECT name, body FROM popular_names WHERE name = ? LIMIT 1")
          .get(sourceId) as { name: string | null; body: string | null } | null;
        return row ? `${row.name ?? ""}\n${row.body ?? ""}`.trim() : null;
      }
      case "documents": {
        const row = virgDb
          .query("SELECT title, content FROM documents WHERE filename = ? LIMIT 1")
          .get(sourceId) as { title: string | null; content: string | null } | null;
        if (!row) return null;

        // Try chunk_meta for precise text slicing
        const meta = getChunkMeta(nodeId);
        if (meta) {
          const combined = `${stripHtml(row.title ?? "")} ${stripHtml(row.content ?? "")}`;
          return combined.slice(meta.char_start, meta.char_end).trim() || combined.trim();
        }

        // Fallback: return first 2000 chars
        const content = row.content ?? "";
        return `${row.title ?? ""}\n${content.length > 2000 ? content.slice(0, 2000) + "..." : content}`.trim();
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// --- SemanticSearchResult type ---

const SemanticSearchResult = builder.objectRef<{
  nodeId: number;
  source: string;
  sourceId: string;
  nodeType: string;
  score: number;
  content: string | null;
}>("SemanticSearchResult");

builder.objectType(SemanticSearchResult, {
  fields: (t) => ({
    nodeId: t.exposeInt("nodeId"),
    source: t.exposeString("source"),
    sourceId: t.exposeString("sourceId"),
    nodeType: t.exposeString("nodeType"),
    score: t.exposeFloat("score"),
    content: t.exposeString("content", { nullable: true }),
  }),
});

// --- Query Type ---

builder.queryType({
  fields: (t) => ({
    // --- Courts ---
    court: t.drizzleField({
      type: "courts",
      nullable: true,
      args: { id: t.arg.int({ required: true }) },
      resolve: (query, _root, args) =>
        db.query.courts.findFirst(query({ where: { id: args.id } })),
    }),
    courts: t.drizzleField({
      type: ["courts"],
      args: {
        limit: t.arg.int(),
        offset: t.arg.int(),
        name: t.arg.string(),
        district: t.arg.string(),
        locality: t.arg.string(),
        type: t.arg.string(),
      },
      resolve: (query, _root, args) =>
        db.query.courts.findMany(
          query({
            where: likeFilter({
              name: args.name,
              district: args.district,
              locality: args.locality,
              type: args.type,
            }),
            limit: args.limit ?? undefined,
            offset: args.offset ?? undefined,
            orderBy: { name: "asc" },
          }),
        ),
    }),

    // --- Constitution ---
    constitutionSection: t.drizzleField({
      type: "constitution",
      nullable: true,
      args: { id: t.arg.int({ required: true }) },
      resolve: (query, _root, args) =>
        db.query.constitution.findFirst(
          query({ where: { id: args.id } }),
        ),
    }),
    constitutionSections: t.drizzleField({
      type: ["constitution"],
      args: {
        limit: t.arg.int(),
        offset: t.arg.int(),
        articleName: t.arg.string(),
        sectionName: t.arg.string(),
      },
      resolve: (query, _root, args) =>
        db.query.constitution.findMany(
          query({
            where: likeFilter({
              articleName: args.articleName,
              sectionName: args.sectionName,
            }),
            limit: args.limit ?? undefined,
            offset: args.offset ?? undefined,
          }),
        ),
    }),

    // --- Virginia Code ---
    virginiaCode: t.drizzleField({
      type: "virginiaCode",
      nullable: true,
      args: { id: t.arg.int({ required: true }) },
      resolve: (query, _root, args) =>
        db.query.virginiaCode.findFirst(
          query({ where: { id: args.id } }),
        ),
    }),
    virginiaCodes: t.drizzleField({
      type: ["virginiaCode"],
      args: {
        limit: t.arg.int(),
        offset: t.arg.int(),
        section: t.arg.string(),
        titleNum: t.arg.string(),
        chapterNum: t.arg.string(),
        titleName: t.arg.string(),
      },
      resolve: (query, _root, args) =>
        db.query.virginiaCode.findMany(
          query({
            where: likeFilter({
              section: args.section,
              titleNum: args.titleNum,
              chapterNum: args.chapterNum,
              titleName: args.titleName,
            }),
            limit: args.limit ?? undefined,
            offset: args.offset ?? undefined,
          }),
        ),
    }),

    // --- Popular Names ---
    popularName: t.drizzleField({
      type: "popularNames",
      nullable: true,
      args: { id: t.arg.int({ required: true }) },
      resolve: (query, _root, args) =>
        db.query.popularNames.findFirst(
          query({ where: { id: args.id } }),
        ),
    }),
    popularNames: t.drizzleField({
      type: ["popularNames"],
      args: {
        limit: t.arg.int(),
        offset: t.arg.int(),
        name: t.arg.string(),
        section: t.arg.string(),
      },
      resolve: (query, _root, args) =>
        db.query.popularNames.findMany(
          query({
            where: likeFilter({
              name: args.name,
              section: args.section,
            }),
            limit: args.limit ?? undefined,
            offset: args.offset ?? undefined,
          }),
        ),
    }),

    // --- Authorities ---
    authority: t.drizzleField({
      type: "authorities",
      nullable: true,
      args: { id: t.arg.int({ required: true }) },
      resolve: (query, _root, args) =>
        db.query.authorities.findFirst(
          query({ where: { id: args.id } }),
        ),
    }),
    authorities: t.drizzleField({
      type: ["authorities"],
      args: {
        limit: t.arg.int(),
        offset: t.arg.int(),
        name: t.arg.string(),
        section: t.arg.string(),
        codified: t.arg.string(),
      },
      resolve: (query, _root, args) =>
        db.query.authorities.findMany(
          query({
            where: likeFilter({
              name: args.name,
              section: args.section,
              codified: args.codified,
            }),
            limit: args.limit ?? undefined,
            offset: args.offset ?? undefined,
          }),
        ),
    }),

    // --- Documents ---
    document: t.drizzleField({
      type: "documents",
      nullable: true,
      args: { id: t.arg.int({ required: true }) },
      resolve: (query, _root, args) =>
        db.query.documents.findFirst(
          query({ where: { id: args.id } }),
        ),
    }),
    documents: t.drizzleField({
      type: ["documents"],
      args: {
        limit: t.arg.int(),
        offset: t.arg.int(),
        dataset: t.arg.string(),
        title: t.arg.string(),
      },
      resolve: (query, _root, args) =>
        db.query.documents.findMany(
          query({
            where: likeFilter({
              dataset: args.dataset,
              title: args.title,
            }),
            limit: args.limit ?? undefined,
            offset: args.offset ?? undefined,
          }),
        ),
    }),

    // --- Semantic Search ---
    semanticSearch: t.field({
      type: [SemanticSearchResult],
      args: {
        vector: t.arg.floatList({ required: true }),
        limit: t.arg.int(),
      },
      resolve: (_root, args) => {
        const topK = Math.min(args.limit ?? 10, 50);
        const queryVec = args.vector;
        if (queryVec.length === 0) return [];

        const rows = loadEmbeddingRows();
        if (rows.length === 0) return [];

        // Determine corpus dimension from first row
        const dim = blobToF32(rows[0].embedding).length;
        if (queryVec.length !== dim) {
          throw new Error(
            `Vector dimension mismatch: got ${queryVec.length}, corpus has ${dim}`,
          );
        }

        ensureWasmSimilarityInit();

        // Pack corpus into flat Float64Array for WASM
        const flat = new Float64Array(rows.length * dim);
        for (let i = 0; i < rows.length; i++) {
          const f32 = blobToF32(rows[i].embedding);
          for (let j = 0; j < dim; j++) flat[i * dim + j] = f32[j];
        }

        const ranked = cosine_similarity_dataspace(
          flat,
          rows.length,
          dim,
          new Float64Array(queryVec),
        );

        // Open virginia.db for source text resolution
        const datasetsDir = process.env.DATASETS_DIR;
        let virgDb: Database | null = null;
        if (datasetsDir) {
          const virgPath = resolve(datasetsDir, "virginia.db");
          if (existsSync(virgPath)) {
            virgDb = new Database(virgPath, { readonly: true });
          }
        }

        try {
          const results: Array<{
            nodeId: number;
            source: string;
            sourceId: string;
            nodeType: string;
            score: number;
            content: string | null;
          }> = [];

          // ranked is interleaved [score, index, score, index, ...]
          for (let i = 0; i < ranked.length && results.length < topK; i += 2) {
            const score = ranked[i];
            const idx = ranked[i + 1];
            const row = rows[idx];
            const content = virgDb
              ? resolveSourceText(virgDb, row.source, row.source_id, row.node_id)
              : null;

            results.push({
              nodeId: row.node_id,
              source: row.source,
              sourceId: row.source_id,
              nodeType: row.node_type,
              score,
              content,
            });
          }

          return results;
        } finally {
          virgDb?.close();
        }
      },
    }),
  }),
});
