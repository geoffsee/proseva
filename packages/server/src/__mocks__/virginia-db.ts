/**
 * Mock for the embedded virginia.db SQLite import used in vitest (Node.js).
 * Returns an in-memory database with an empty courts table.
 */
import BetterSqlite3 from "better-sqlite3";

const db = new BetterSqlite3(":memory:");

db.exec(`
  CREATE TABLE courts (
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
  )
`);

export default {
  query: (sql: string) => ({
    all: (...params: unknown[]) => db.prepare(sql).all(...params),
    get: (...params: unknown[]) => db.prepare(sql).get(...params),
    run: (...params: unknown[]) => db.prepare(sql).run(...params),
  }),
};
