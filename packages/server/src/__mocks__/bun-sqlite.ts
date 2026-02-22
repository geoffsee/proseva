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

  constructor(path?: string, _opts?: { create?: boolean }) {
    this.db = new BetterSqlite3(
      path === ":memory:" || !path ? ":memory:" : path,
    );
  }

  prepare(sql: string) {
    const stmt = this.db.prepare(normalizeParams(sql));
    return {
      run: (...params: unknown[]) => {
        const info = stmt.run(...params.map(coerceParam));
        return { changes: info.changes };
      },
      all: (...params: unknown[]) => stmt.all(...params.map(coerceParam)),
      finalize: () => {},
    };
  }

  close() {
    this.db.close();
  }
}
