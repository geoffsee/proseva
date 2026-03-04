#!/usr/bin/env bun

/**
 * Export virginia.db tables to virginia.sqlite.jsonl.
 * Each line: {"table":"<name>","row":{...}}
 */

import { Database } from "bun:sqlite";
import { join } from "path";

const DATA_DIR = "data";
const DB_PATH = join(DATA_DIR, "virginia.db");
const JSONL_PATH = join(DATA_DIR, "virginia.sqlite.jsonl");

const db = new Database(DB_PATH, { readonly: true });

const tables = db
  .query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all() as { name: string }[];

const writer = Bun.file(JSONL_PATH).writer();
let totalRows = 0;

for (const { name } of tables) {
  const rows = db.query(`SELECT * FROM "${name}"`).all() as Record<string, unknown>[];
  for (const row of rows) {
    writer.write(JSON.stringify({ table: name, row }) + "\n");
    totalRows++;
  }
  console.log(`  ${name}: ${rows.length} rows`);
}

writer.flush();
writer.end();
db.close();

console.log(`Exported ${totalRows} rows to ${JSONL_PATH}`);
