/**
 * Shim for drizzle-orm/bun-sqlite used when running tests under Vitest (Node.js).
 * Delegates to drizzle-orm/better-sqlite3 which has the same API surface.
 */
export { drizzle } from "drizzle-orm/better-sqlite3";
