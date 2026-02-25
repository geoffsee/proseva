/**
 * Shim for bun:sqlite used when running server tests under Vitest (Node.js).
 *
 * Delegates to better-sqlite3 which has a nearly identical API to bun:sqlite,
 * with two key differences:
 *   1. better-sqlite3 only accepts Buffer for BLOBs (not Uint8Array)
 *   2. better-sqlite3 doesn't support ?NNN positional params with spread args
 */
import BetterSqlite3 from "better-sqlite3";

function coerceParam(v: unknown): unknown {
  if (v instanceof Uint8Array && !(v instanceof Buffer)) {
    return Buffer.from(v);
  }
  return v;
}

/** Convert ?1, ?2 positional markers to plain ? for better-sqlite3 */
function normalizeParams(sql: string): string {
  return sql.replace(/\?(\d+)/g, "?");
}

export class Database {
  private db: BetterSqlite3.Database;

  constructor(dbPath?: string, _opts?: { create?: boolean; readonly?: boolean }) {
    // In tests, paths whose parent directory doesn't exist (e.g. ":memory:/virginia.db")
    // fall back to in-memory. Real temp-dir paths are passed through so
    // encryption tests can write and re-open actual files.
    let resolvedPath = ":memory:";
    if (dbPath && dbPath !== ":memory:") {
      try {
        const fs = require("fs");
        const pathMod = require("path");
        if (fs.existsSync(pathMod.dirname(dbPath))) resolvedPath = dbPath;
      } catch { /* fallback to :memory: */ }
    }
    this.db = new BetterSqlite3(resolvedPath);

    // Auto-seed all virginia.db tables when opening virginia.db (test mock)
    if (dbPath && dbPath.endsWith("virginia.db")) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS courts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          locality TEXT, type TEXT, district TEXT, clerk TEXT,
          phone TEXT, fax TEXT, email TEXT,
          address TEXT, city TEXT, state TEXT, zip TEXT,
          hours TEXT, homepage TEXT, judges TEXT
        );
        CREATE TABLE IF NOT EXISTS constitution (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          article_id INTEGER, article TEXT, article_name TEXT,
          section_name TEXT, section_title TEXT, section_text TEXT,
          section_count INTEGER, last_update TEXT
        );
        CREATE TABLE IF NOT EXISTS virginia_code (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title_num TEXT, title_name TEXT, subtitle_num TEXT, subtitle_name TEXT,
          part_num TEXT, part_name TEXT, chapter_num TEXT, chapter_name TEXT,
          article_num TEXT, article_name TEXT, subpart_num TEXT, subpart_name TEXT,
          section TEXT, title TEXT, body TEXT
        );
        CREATE TABLE IF NOT EXISTS popular_names (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT, title_num TEXT, section TEXT, body TEXT
        );
        CREATE TABLE IF NOT EXISTS authorities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT, short_name TEXT, codified TEXT,
          title TEXT, section TEXT, body TEXT
        );
        CREATE TABLE IF NOT EXISTS documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          dataset TEXT, filename TEXT, title TEXT, content TEXT
        );
      `);
    }
  }

  query(sql: string) {
    return this.prepare(sql);
  }

  prepare(sql: string) {
    const stmt = this.db.prepare(normalizeParams(sql));
    return {
      run: (...params: unknown[]) => {
        const info = stmt.run(...params.map(coerceParam));
        return { changes: info.changes };
      },
      all: (...params: unknown[]) => stmt.all(...params.map(coerceParam)),
      get: (...params: unknown[]) => stmt.get(...params.map(coerceParam)),
      finalize: () => {},
    };
  }

  close() {
    this.db.close();
  }
}
