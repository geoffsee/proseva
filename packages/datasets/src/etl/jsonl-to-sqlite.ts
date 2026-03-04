#!/usr/bin/env bun

/**
 * Reconstruct virginia.db from virginia.sqlite.jsonl.
 * Inverse of sqlite-to-jsonl.ts.
 */

import { Database } from "bun:sqlite";
import { join } from "path";
import { createReadStream } from "fs";
import { createInterface } from "readline";

const DATA_DIR = "data";
const DB_PATH = join(DATA_DIR, "virginia.db");
const JSONL_PATH = join(DATA_DIR, "virginia.sqlite.jsonl");

// Delete existing DB to start fresh
try {
  await Bun.file(DB_PATH).delete();
} catch {}

const db = new Database(DB_PATH);
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA synchronous = NORMAL");

// Schema definitions (same as json-to-sqlite.ts)
const SCHEMA: Record<string, string> = {
  courts: `CREATE TABLE IF NOT EXISTS courts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    locality TEXT,
    type TEXT,
    district TEXT,
    clerk TEXT,
    phone TEXT,
    phones TEXT,
    fax TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    hours TEXT,
    homepage TEXT,
    judges TEXT
  )`,
  constitution: `CREATE TABLE IF NOT EXISTS constitution (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER,
    article TEXT,
    article_name TEXT,
    section_name TEXT,
    section_title TEXT,
    section_text TEXT,
    section_count INTEGER,
    last_update TEXT
  )`,
  virginia_code: `CREATE TABLE IF NOT EXISTS virginia_code (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title_num TEXT,
    title_name TEXT,
    subtitle_num TEXT,
    subtitle_name TEXT,
    part_num TEXT,
    part_name TEXT,
    chapter_num TEXT,
    chapter_name TEXT,
    article_num TEXT,
    article_name TEXT,
    subpart_num TEXT,
    subpart_name TEXT,
    section TEXT,
    title TEXT,
    body TEXT
  )`,
  popular_names: `CREATE TABLE IF NOT EXISTS popular_names (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    title_num TEXT,
    section TEXT,
    body TEXT
  )`,
  authorities: `CREATE TABLE IF NOT EXISTS authorities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    short_name TEXT,
    codified TEXT,
    title TEXT,
    section TEXT,
    body TEXT
  )`,
  documents: `CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset TEXT,
    filename TEXT,
    title TEXT,
    content TEXT
  )`,
};

// Create all tables
for (const ddl of Object.values(SCHEMA)) {
  db.run(ddl);
}

// Read JSONL and insert rows
const rl = createInterface({
  input: createReadStream(JSONL_PATH),
  crlfDelay: Infinity,
});

// Buffer rows by table for transactional inserts
const buffers = new Map<string, Record<string, unknown>[]>();

for await (const line of rl) {
  if (!line.trim()) continue;
  const { table, row } = JSON.parse(line) as {
    table: string;
    row: Record<string, unknown>;
  };
  let buf = buffers.get(table);
  if (!buf) {
    buf = [];
    buffers.set(table, buf);
  }
  buf.push(row);
}

let totalRows = 0;

for (const [table, rows] of buffers) {
  if (rows.length === 0) continue;

  // Derive columns from first row
  const columns = Object.keys(rows[0]);
  const placeholders = columns.map((c) => `$${c}`).join(", ");
  const colNames = columns.map((c) => `"${c}"`).join(", ");
  const stmt = db.prepare(
    `INSERT INTO "${table}" (${colNames}) VALUES (${placeholders})`,
  );

  db.transaction(() => {
    for (const row of rows) {
      const params: Record<string, unknown> = {};
      for (const col of columns) {
        params[`$${col}`] = row[col] ?? null;
      }
      stmt.run(params);
    }
  })();

  console.log(`  ${table}: ${rows.length} rows`);
  totalRows += rows.length;
}

// Build indexes (same as json-to-sqlite.ts)
db.run("CREATE INDEX IF NOT EXISTS idx_virginia_code_section ON virginia_code(section)");
db.run("CREATE INDEX IF NOT EXISTS idx_courts_name ON courts(name)");
db.run("CREATE INDEX IF NOT EXISTS idx_documents_dataset ON documents(dataset)");

db.close();
console.log(`Imported ${totalRows} rows into ${DB_PATH}`);
