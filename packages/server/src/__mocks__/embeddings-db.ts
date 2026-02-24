/**
 * Mock for the embedded embeddings.sqlite.db import used in vitest (Node.js).
 * Returns an in-memory database with empty embeddings schema tables.
 */
import BetterSqlite3 from "better-sqlite3";

const db = new BetterSqlite3(":memory:");

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
  )
`);

export default {
  query: (sql: string) => ({
    all: (...params: unknown[]) => db.prepare(sql).all(...params),
    get: (...params: unknown[]) => db.prepare(sql).get(...params),
    run: (...params: unknown[]) => db.prepare(sql).run(...params),
  }),
};
