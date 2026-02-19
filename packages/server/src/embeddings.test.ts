import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  cosine_similarity,
  cosine_similarity_dataspace,
  ensureWasmSimilarityInit,
} from "./wasm-similarity-init";
import { Database, type Embedding } from "./db";
import { InMemoryAdapter } from "./persistence";

beforeAll(() => {
  ensureWasmSimilarityInit();
});

describe("cosine_similarity (wasm-similarity)", () => {
  it("returns 1 for identical vectors", () => {
    const v = new Float64Array([1, 2, 3]);
    expect(cosine_similarity(v, v)).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = new Float64Array([1, 0]);
    const b = new Float64Array([0, 1]);
    expect(cosine_similarity(a, b)).toBeCloseTo(0);
  });

  it("returns -1 for opposite vectors", () => {
    const a = new Float64Array([1, 0]);
    const b = new Float64Array([-1, 0]);
    expect(cosine_similarity(a, b)).toBeCloseTo(-1);
  });

  it("computes correct similarity for arbitrary vectors", () => {
    const a = new Float64Array([1, 2, 3]);
    const b = new Float64Array([4, 5, 6]);
    const expected = 32 / (Math.sqrt(14) * Math.sqrt(77));
    expect(cosine_similarity(a, b)).toBeCloseTo(expected);
  });
});

describe("cosine_similarity_dataspace", () => {
  it("ranks vectors by similarity to a query", () => {
    const vectors = [
      [1, 0, 0],
      [0, 0, 1],
      [0.9, 0.1, 0],
    ];
    const dim = 3;
    const flat = new Float64Array(vectors.flat());
    const query = new Float64Array([1, 0, 0]);

    const result = cosine_similarity_dataspace(
      flat,
      vectors.length,
      dim,
      query,
    );

    // Result is interleaved [score, index, score, index, ...]
    // First result should be the most similar (index 0, score ~1)
    expect(result[1]).toBe(0); // index of [1,0,0]
    expect(result[0]).toBeCloseTo(1);
    // Second should be [0.9, 0.1, 0]
    expect(result[3]).toBe(2);
  });
});

describe("embeddings collection in Database", () => {
  let db: Database;

  beforeEach(async () => {
    db = await Database.create(new InMemoryAdapter());
  });

  it("starts empty", () => {
    expect(db.embeddings.size).toBe(0);
  });

  it("stores and retrieves embeddings", () => {
    const entry: Embedding = {
      id: "emb-1",
      source: "motion.pdf",
      content: "The plaintiff filed a motion to dismiss.",
      embedding: [0.1, 0.2, 0.3],
    };
    db.embeddings.set(entry.id, entry);
    db.persist();

    expect(db.embeddings.get("emb-1")).toEqual(entry);
  });

  it("persists and reloads embeddings via adapter", async () => {
    const adapter = new InMemoryAdapter();
    const db1 = await Database.create(adapter);

    db1.embeddings.set("emb-1", {
      id: "emb-1",
      source: "doc.pdf",
      content: "Test content",
      embedding: [0.5, 0.6],
    });
    await db1.flush();

    const db2 = await Database.create(adapter);
    expect(db2.embeddings.size).toBe(1);
    expect(db2.embeddings.get("emb-1")!.content).toBe("Test content");
  });

  it("supports SearchKnowledge-style ranking via dataspace", () => {
    const entries: Embedding[] = [
      {
        id: "1",
        source: "a.pdf",
        content: "relevant doc",
        embedding: [1, 0, 0],
      },
      {
        id: "2",
        source: "b.pdf",
        content: "somewhat relevant",
        embedding: [0.7, 0.7, 0],
      },
      {
        id: "3",
        source: "c.pdf",
        content: "irrelevant doc",
        embedding: [0, 0, 1],
      },
    ];
    for (const e of entries) db.embeddings.set(e.id, e);

    const queryVec = [1, 0, 0];
    const topK = 2;

    // Replicate the SearchKnowledge logic from index.ts
    const records = Array.from(db.embeddings.values());
    const dim = queryVec.length;
    const flat = new Float64Array(records.length * dim);
    for (let i = 0; i < records.length; i++) {
      flat.set(records[i].embedding, i * dim);
    }
    const ranked = cosine_similarity_dataspace(
      flat,
      records.length,
      dim,
      new Float64Array(queryVec),
    );
    const scored = [];
    for (let i = 0; i < ranked.length && scored.length < topK; i += 2) {
      const idx = ranked[i + 1];
      scored.push({
        source: records[idx].source,
        content: records[idx].content,
        score: ranked[i],
      });
    }

    expect(scored).toHaveLength(2);
    expect(scored[0].source).toBe("a.pdf");
    expect(scored[0].score).toBeCloseTo(1);
    expect(scored[1].source).toBe("b.pdf");
  });

  it("returns empty results when no embeddings exist", () => {
    const records = Array.from(db.embeddings.values());
    expect(records).toHaveLength(0);
  });

  it("deletes embeddings", () => {
    db.embeddings.set("emb-1", {
      id: "emb-1",
      source: "doc.pdf",
      content: "content",
      embedding: [1, 2],
    });
    expect(db.embeddings.size).toBe(1);

    db.embeddings.delete("emb-1");
    db.persist();
    expect(db.embeddings.size).toBe(0);
  });
});
