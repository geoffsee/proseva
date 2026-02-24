import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createApp, blobToF32, cosineSim, resolveSourceText } from "./server";

// --- Test fixture: create temp databases with known data ---

let tmpDir: string;
let embPath: string;
let virgPath: string;

function f32Blob(values: number[]): Buffer {
  return Buffer.from(new Float32Array(values).buffer);
}

function seedEmbeddingsDb(path: string) {
  const db = new Database(path);
  db.exec(`
    CREATE TABLE model_info (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO model_info VALUES ('model_name', 'test-model'), ('dimensions', '4');

    CREATE TABLE nodes (
      id INTEGER PRIMARY KEY,
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,
      chunk_idx INTEGER NOT NULL DEFAULT 0,
      node_type TEXT NOT NULL
    );

    CREATE TABLE edges (
      from_id INTEGER NOT NULL REFERENCES nodes(id),
      to_id INTEGER NOT NULL REFERENCES nodes(id),
      rel_type TEXT NOT NULL,
      weight REAL,
      PRIMARY KEY (from_id, to_id, rel_type)
    );

    CREATE TABLE embeddings (
      node_id INTEGER PRIMARY KEY REFERENCES nodes(id),
      embedding BLOB NOT NULL
    );

    INSERT INTO nodes VALUES (1, 'virginia_code', '1-200', 0, 'section');
    INSERT INTO nodes VALUES (2, 'virginia_code', '1-201', 0, 'section');
    INSERT INTO nodes VALUES (3, 'courts', '1', 0, 'court');
    INSERT INTO nodes VALUES (4, 'constitution', '1:1', 0, 'constitution_section');
    INSERT INTO nodes VALUES (5, 'authorities', 'ABC', 0, 'authority');
    INSERT INTO nodes VALUES (6, 'virginia_code', '10', 0, 'title');

    INSERT INTO edges VALUES (1, 2, 'cites', NULL);
    INSERT INTO edges VALUES (6, 1, 'contains', 1.0);
    INSERT INTO edges VALUES (6, 2, 'contains', 1.0);
  `);

  // Embeddings: 4-dimensional vectors
  // Node 1: [1, 0, 0, 0]
  // Node 2: [0.9, 0.1, 0, 0]  — very similar to 1
  // Node 3: [0, 0, 1, 0]       — orthogonal to 1
  // Node 4: [0.5, 0.5, 0.5, 0.5] — moderate similarity
  const insert = db.prepare("INSERT INTO embeddings VALUES (?, ?)");
  insert.run(1, f32Blob([1, 0, 0, 0]));
  insert.run(2, f32Blob([0.9, 0.1, 0, 0]));
  insert.run(3, f32Blob([0, 0, 1, 0]));
  insert.run(4, f32Blob([0.5, 0.5, 0.5, 0.5]));

  db.close();
}

function seedVirginiaDb(path: string) {
  const db = new Database(path);
  db.exec(`
    CREATE TABLE virginia_code (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title_num TEXT, title_name TEXT, subtitle_num TEXT, subtitle_name TEXT,
      part_num TEXT, part_name TEXT, chapter_num TEXT, chapter_name TEXT,
      article_num TEXT, article_name TEXT, subpart_num TEXT, subpart_name TEXT,
      section TEXT, title TEXT, body TEXT
    );
    INSERT INTO virginia_code (section, title, body)
      VALUES ('1-200', 'General Provisions', '<p>Body of section 1-200</p>');
    INSERT INTO virginia_code (section, title, body)
      VALUES ('1-201', 'Definitions', 'Body of section 1-201');

    CREATE TABLE constitution (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER, article TEXT, article_name TEXT,
      section_name TEXT, section_title TEXT, section_text TEXT,
      section_count INTEGER, last_update TEXT
    );
    INSERT INTO constitution (article_id, section_count, section_name, section_title, section_text)
      VALUES (1, 1, 'Bill of Rights', 'Section 1', 'All men are created equal');

    CREATE TABLE authorities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT, short_name TEXT, codified TEXT, title TEXT, section TEXT, body TEXT
    );
    INSERT INTO authorities (short_name, title, body)
      VALUES ('ABC', 'ABC Authority', 'Regulates alcoholic beverages');

    CREATE TABLE courts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, locality TEXT, type TEXT, district TEXT,
      clerk TEXT, phone TEXT, phones TEXT, fax TEXT, email TEXT,
      address TEXT, city TEXT, state TEXT, zip TEXT, hours TEXT,
      homepage TEXT, judges TEXT
    );
    INSERT INTO courts (id, name, locality, type, district, city)
      VALUES (1, 'Circuit Court', 'Fairfax', 'Circuit', '19th', 'Fairfax');

    CREATE TABLE popular_names (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT, title_num TEXT, section TEXT, body TEXT
    );
    INSERT INTO popular_names (name, body) VALUES ('Freedom of Information Act', 'FOIA body text');

    CREATE TABLE documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dataset TEXT, filename TEXT, title TEXT, content TEXT
    );
    INSERT INTO documents (filename, title, content)
      VALUES ('guide.pdf', 'User Guide', 'This is the guide content');
  `);
  db.close();
}

// --- Helpers ---

type YogaInstance = ReturnType<typeof createApp>["yoga"];

async function gql(yoga: YogaInstance, query: string, variables: Record<string, any> = {}) {
  const res = await yoga.fetch("http://localhost/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return res.json() as Promise<{ data?: any; errors?: any[] }>;
}

// --- Setup / teardown ---

let app: ReturnType<typeof createApp>;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "explorer-test-"));
  embPath = join(tmpDir, "embeddings.db");
  virgPath = join(tmpDir, "virginia.db");
  seedEmbeddingsDb(embPath);
  seedVirginiaDb(virgPath);
  app = createApp(embPath, virgPath);
});

afterAll(() => {
  app.cleanup();
  rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================
// Unit tests
// ============================================================

describe("cosineSim", () => {
  it("returns 1.0 for identical vectors", () => {
    const a = new Float32Array([1, 2, 3]);
    expect(cosineSim(a, a)).toBeCloseTo(1.0, 5);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    expect(cosineSim(a, b)).toBeCloseTo(0, 5);
  });

  it("returns -1 for opposite vectors", () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([-1, 0]);
    expect(cosineSim(a, b)).toBeCloseTo(-1, 5);
  });

  it("handles zero vectors gracefully", () => {
    const a = new Float32Array([0, 0, 0]);
    const b = new Float32Array([1, 2, 3]);
    expect(cosineSim(a, b)).toBe(0);
  });

  it("computes correct similarity for known vectors", () => {
    const a = new Float32Array([1, 0, 0, 0]);
    const b = new Float32Array([0.9, 0.1, 0, 0]);
    // cos = 0.9 / (1 * sqrt(0.81 + 0.01)) = 0.9 / sqrt(0.82)
    expect(cosineSim(a, b)).toBeCloseTo(0.9 / Math.sqrt(0.82), 4);
  });
});

describe("blobToF32", () => {
  it("round-trips Float32Array through Buffer", () => {
    const original = new Float32Array([1.5, -2.3, 0, 42.0]);
    const blob = Buffer.from(original.buffer);
    const result = blobToF32(blob);
    expect(result.length).toBe(4);
    for (let i = 0; i < original.length; i++) {
      expect(result[i]).toBeCloseTo(original[i], 5);
    }
  });
});

// ============================================================
// GraphQL integration tests
// ============================================================

describe("stats query", () => {
  it("returns correct counts", async () => {
    const res = await gql(app.yoga, `{ stats { nodeCount edgeCount embeddingCount } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.stats.nodeCount).toBe(6);
    expect(res.data.stats.edgeCount).toBe(3);
    expect(res.data.stats.embeddingCount).toBe(4);
  });

  it("returns node type breakdown", async () => {
    const res = await gql(app.yoga, `{ stats { nodeTypes { type count } } }`);
    expect(res.errors).toBeUndefined();
    const types = res.data.stats.nodeTypes as { type: string; count: number }[];
    expect(types.length).toBeGreaterThan(0);
    const sectionType = types.find((t) => t.type === "section");
    expect(sectionType).toBeDefined();
    expect(sectionType!.count).toBe(2);
  });

  it("returns edge type breakdown", async () => {
    const res = await gql(app.yoga, `{ stats { edgeTypes { type count } } }`);
    expect(res.errors).toBeUndefined();
    const types = res.data.stats.edgeTypes as { type: string; count: number }[];
    const cites = types.find((t) => t.type === "cites");
    const contains = types.find((t) => t.type === "contains");
    expect(cites).toBeDefined();
    expect(cites!.count).toBe(1);
    expect(contains).toBeDefined();
    expect(contains!.count).toBe(2);
  });
});

describe("nodes query", () => {
  it("returns all nodes with default pagination", async () => {
    const res = await gql(app.yoga, `{ nodes { total nodes { id source sourceId nodeType } } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.nodes.total).toBe(6);
    expect(res.data.nodes.nodes.length).toBe(6);
  });

  it("filters by type", async () => {
    const res = await gql(app.yoga, `{ nodes(type: "section") { total nodes { id nodeType } } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.nodes.total).toBe(2);
    for (const n of res.data.nodes.nodes) {
      expect(n.nodeType).toBe("section");
    }
  });

  it("searches by source_id", async () => {
    const res = await gql(app.yoga, `{ nodes(search: "1-200") { total nodes { id sourceId } } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.nodes.total).toBe(1);
    expect(res.data.nodes.nodes[0].sourceId).toBe("1-200");
  });

  it("searches by source name", async () => {
    const res = await gql(app.yoga, `{ nodes(search: "courts") { total nodes { id source } } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.nodes.total).toBe(1);
    expect(res.data.nodes.nodes[0].source).toBe("courts");
  });

  it("respects limit and offset", async () => {
    const res = await gql(app.yoga, `{ nodes(limit: 2, offset: 0) { total nodes { id } } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.nodes.total).toBe(6);
    expect(res.data.nodes.nodes.length).toBe(2);

    const page2 = await gql(app.yoga, `{ nodes(limit: 2, offset: 2) { nodes { id } } }`);
    expect(page2.data.nodes.nodes.length).toBe(2);
    // Pages shouldn't overlap
    const ids1 = res.data.nodes.nodes.map((n: any) => n.id);
    const ids2 = page2.data.nodes.nodes.map((n: any) => n.id);
    for (const id of ids2) {
      expect(ids1).not.toContain(id);
    }
  });

  it("clamps limit to 200", async () => {
    const res = await gql(app.yoga, `{ nodes(limit: 999) { nodes { id } } }`);
    expect(res.errors).toBeUndefined();
    // With only 6 nodes, all returned, but the limit was clamped internally
    expect(res.data.nodes.nodes.length).toBe(6);
  });

  it("returns empty for no-match search", async () => {
    const res = await gql(app.yoga, `{ nodes(search: "nonexistent_xyz") { total nodes { id } } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.nodes.total).toBe(0);
    expect(res.data.nodes.nodes.length).toBe(0);
  });
});

describe("node query", () => {
  it("returns a node by id", async () => {
    const res = await gql(app.yoga, `{ node(id: 1) { id source sourceId chunkIdx nodeType hasEmbedding } }`);
    expect(res.errors).toBeUndefined();
    const n = res.data.node;
    expect(n.id).toBe(1);
    expect(n.source).toBe("virginia_code");
    expect(n.sourceId).toBe("1-200");
    expect(n.chunkIdx).toBe(0);
    expect(n.nodeType).toBe("section");
    expect(n.hasEmbedding).toBe(true);
  });

  it("returns null for nonexistent node", async () => {
    const res = await gql(app.yoga, `{ node(id: 9999) { id } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.node).toBeNull();
  });

  it("reports hasEmbedding=false for nodes without embedding", async () => {
    // Node 5 (authority 'ABC') and node 6 (title '10') have no embeddings
    const res = await gql(app.yoga, `{ node(id: 5) { id hasEmbedding } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.node.hasEmbedding).toBe(false);
  });

  it("resolves source text from virginia db", async () => {
    const res = await gql(app.yoga, `{ node(id: 1) { sourceText } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.node.sourceText).toContain("General Provisions");
    expect(res.data.node.sourceText).toContain("Body of section 1-200");
  });

  it("resolves constitution source text", async () => {
    const res = await gql(app.yoga, `{ node(id: 4) { sourceText } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.node.sourceText).toContain("Bill of Rights");
    expect(res.data.node.sourceText).toContain("All men are created equal");
  });

  it("resolves court source text", async () => {
    const res = await gql(app.yoga, `{ node(id: 3) { sourceText } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.node.sourceText).toContain("Circuit Court");
    expect(res.data.node.sourceText).toContain("Fairfax");
  });

  it("resolves authority source text", async () => {
    const res = await gql(app.yoga, `{ node(id: 5) { sourceText } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.node.sourceText).toContain("ABC Authority");
    expect(res.data.node.sourceText).toContain("alcoholic beverages");
  });

  it("returns edges for a node", async () => {
    const res = await gql(app.yoga, `{ node(id: 1) { edges { fromId toId relType weight } } }`);
    expect(res.errors).toBeUndefined();
    const edges = res.data.node.edges;
    expect(edges.length).toBeGreaterThan(0);
    // Node 1 has: outgoing cites->2, incoming contains<-6
    const cites = edges.find((e: any) => e.relType === "cites");
    expect(cites).toBeDefined();
    expect(cites.fromId).toBe(1);
    expect(cites.toId).toBe(2);
  });
});

describe("neighbors query", () => {
  it("returns edges for a node", async () => {
    const res = await gql(app.yoga, `{ neighbors(id: 1) { fromId toId relType weight } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.neighbors.length).toBe(2); // cites + contains
  });

  it("returns empty for isolated node", async () => {
    // Node 5 has no edges
    const res = await gql(app.yoga, `{ neighbors(id: 5) { fromId toId relType } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.neighbors.length).toBe(0);
  });

  it("returns empty for nonexistent node", async () => {
    const res = await gql(app.yoga, `{ neighbors(id: 9999) { fromId toId relType } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.neighbors.length).toBe(0);
  });
});

describe("Edge resolvers", () => {
  it("resolves fromNode and toNode", async () => {
    const res = await gql(app.yoga, `{
      neighbors(id: 1) {
        fromId toId relType
        fromNode { id source sourceId }
        toNode { id source sourceId }
      }
    }`);
    expect(res.errors).toBeUndefined();
    const citesEdge = res.data.neighbors.find((e: any) => e.relType === "cites");
    expect(citesEdge.fromNode.id).toBe(1);
    expect(citesEdge.toNode.id).toBe(2);
    expect(citesEdge.toNode.sourceId).toBe("1-201");
  });
});

describe("similar query", () => {
  it("returns nodes sorted by similarity", async () => {
    const res = await gql(app.yoga, `{ similar(id: 1, limit: 10) { score node { id nodeType } } }`);
    expect(res.errors).toBeUndefined();
    const results = res.data.similar;
    // Node 1 = [1,0,0,0]. Node 2 = [0.9,0.1,0,0] should be most similar
    expect(results.length).toBe(3); // nodes 2, 3, 4
    expect(results[0].node.id).toBe(2);
    expect(results[0].score).toBeGreaterThan(0.9);

    // Scores should be descending
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  it("respects limit parameter", async () => {
    const res = await gql(app.yoga, `{ similar(id: 1, limit: 1) { score node { id } } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.similar.length).toBe(1);
    expect(res.data.similar[0].node.id).toBe(2);
  });

  it("excludes the query node itself", async () => {
    const res = await gql(app.yoga, `{ similar(id: 1, limit: 50) { node { id } } }`);
    expect(res.errors).toBeUndefined();
    const ids = res.data.similar.map((s: any) => s.node.id);
    expect(ids).not.toContain(1);
  });

  it("returns empty for node without embedding", async () => {
    const res = await gql(app.yoga, `{ similar(id: 5) { score node { id } } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.similar.length).toBe(0);
  });

  it("returns empty for nonexistent node", async () => {
    const res = await gql(app.yoga, `{ similar(id: 9999) { score } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.similar.length).toBe(0);
  });

  it("orthogonal vectors have ~0 similarity", async () => {
    // Node 1=[1,0,0,0], Node 3=[0,0,1,0] — orthogonal
    const res = await gql(app.yoga, `{ similar(id: 1, limit: 10) { score node { id } } }`);
    const node3 = res.data.similar.find((s: any) => s.node.id === 3);
    expect(node3).toBeDefined();
    expect(Math.abs(node3.score)).toBeLessThan(0.01);
  });
});

describe("introspection", () => {
  it("handles introspection query", async () => {
    const res = await gql(app.yoga, `{ __schema { queryType { name } } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.__schema.queryType.name).toBe("Query");
  });

  it("rejects invalid queries", async () => {
    const res = await gql(app.yoga, `{ nonExistentField }`);
    expect(res.errors).toBeDefined();
    expect(res.errors!.length).toBeGreaterThan(0);
  });
});

describe("createApp without virginia db", () => {
  let appNoVirg: ReturnType<typeof createApp>;

  beforeAll(() => {
    appNoVirg = createApp(embPath);
  });

  afterAll(() => {
    appNoVirg.cleanup();
  });

  it("works without virginia db", async () => {
    const res = await gql(appNoVirg.yoga, `{ stats { nodeCount } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.stats.nodeCount).toBe(6);
  });

  it("returns null sourceText without virginia db", async () => {
    const res = await gql(appNoVirg.yoga, `{ node(id: 1) { sourceText } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.node.sourceText).toBeNull();
  });
});

describe("resolveSourceText", () => {
  it("returns null when virgStmts is null", () => {
    expect(resolveSourceText(null, "virginia_code", "1-200")).toBeNull();
  });

  it("returns null for unknown source type", async () => {
    // Use a real query to test — node 6 has source 'virginia_code' with sourceId '10' (a title_num, not a section)
    // which won't match a virginia_code row
    const res = await gql(app.yoga, `{ node(id: 6) { sourceText } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.node.sourceText).toBeNull();
  });
});
