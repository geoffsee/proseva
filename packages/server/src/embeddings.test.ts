import { describe, it, expect, beforeEach } from "vitest";
import { Database, type Embedding } from "./db";
import { InMemoryAdapter } from "./persistence";

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
