import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import {
  initSync,
  cosine_similarity,
  cosine_similarity_dataspace,
} from "wasm-similarity/wasm_similarity_core.js";

beforeAll(() => {
  const candidates: string[] = [];
  try {
    candidates.push(require.resolve("wasm-similarity/wasm_similarity_bg.wasm"));
  } catch {}
  const dir = dirname(new URL(import.meta.url).pathname);
  candidates.push(join(dir, "../node_modules/wasm-similarity/wasm_similarity_bg.wasm"));
  candidates.push(join(dir, "../../node_modules/wasm-similarity/wasm_similarity_bg.wasm"));
  for (const wasmPath of candidates) {
    try {
      const wasmBuffer = readFileSync(wasmPath);
      initSync({ module: wasmBuffer });
      return;
    } catch {}
  }
  throw new Error("Failed to initialize wasm-similarity for tests");
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
    expect(result[1]).toBe(0); // index of [1,0,0]
    expect(result[0]).toBeCloseTo(1);
    expect(result[3]).toBe(2); // index of [0.9, 0.1, 0]
  });

  it("supports SearchKnowledge-style top-K ranking", () => {
    const records = [
      { source: "a.pdf", content: "relevant doc", embedding: [1, 0, 0] },
      { source: "b.pdf", content: "somewhat relevant", embedding: [0.7, 0.7, 0] },
      { source: "c.pdf", content: "irrelevant doc", embedding: [0, 0, 1] },
    ];

    const queryVec = [1, 0, 0];
    const topK = 2;
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
});
