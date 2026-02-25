import { initDb } from "./db";
import { InMemoryAdapter } from "./persistence";
import { setKeypairForceMemory } from "./encryption";

// Point graphql.ts at an in-memory path so the mock Database class is used.
process.env.DATASETS_DIR = ":memory:";

// Use in-memory KV store for ML-KEM keypair during tests.
setKeypairForceMemory(true);

// Initialize the database with an in-memory adapter before any tests run.
// Individual test files that use setupTestServer() will call freshDb() to
// reset the database per-test, but this ensures db is never undefined.
await initDb(new InMemoryAdapter());

// Suppress known harmless Node.js deprecation warnings that pollute CI output
const _originalEmit = process.emit;
// @ts-expect-error - overriding emit to filter noisy warnings
process.emit = function (event: string, ...args: unknown[]) {
  if (event === "warning") {
    const msg = (args[0] as { message?: string })?.message ?? "";
    if (msg.includes("punycode")) {
      return false;
    }
  }
  // @ts-expect-error - forwarding original call
  return _originalEmit.call(process, event, ...args);
};
