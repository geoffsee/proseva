/**
 * Manual WASM initialization for wasm-similarity.
 *
 * Imports from the core module (which does NOT auto-init) and provides
 * an explicit init function that loads the WASM binary from a known path.
 * This is required for bun build --compile where the default readFileSync
 * from the package entry point resolves to /$bunfs/ (read-only virtual FS).
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { initSync } from "wasm-similarity/wasm_similarity_core.js";

export {
  cosine_similarity,
  cosine_similarity_dataspace,
} from "wasm-similarity/wasm_similarity_core.js";

let initialized = false;

export function ensureWasmSimilarityInit(): void {
  if (initialized) return;

  const candidates: string[] = [];

  // 1. Next to the compiled binary (production)
  candidates.push(join(dirname(process.execPath), "wasm_similarity_bg.wasm"));

  // 2. require.resolve from node_modules (development)
  try {
    candidates.push(require.resolve("wasm-similarity/wasm_similarity_bg.wasm"));
  } catch {
    // not available
  }

  // 3. Relative to source (development fallback)
  const __dir =
    import.meta.dir ??
    import.meta.dirname ??
    new URL(".", import.meta.url).pathname;
  candidates.push(
    join(__dir, "../../node_modules/wasm-similarity/wasm_similarity_bg.wasm"),
  );

  for (const wasmPath of candidates) {
    try {
      const wasmBuffer = readFileSync(wasmPath);
      initSync({ module: wasmBuffer });
      initialized = true;
      return;
    } catch {
      // try next candidate
    }
  }

  throw new Error(
    "Failed to initialize wasm-similarity: WASM file not found in any candidate path",
  );
}
