import { argon2id_hash, argon2_verify, initSync } from "wasm-pqc-subtle";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const __dir =
  import.meta.dir ??
  import.meta.dirname ??
  new URL(".", import.meta.url).pathname;

let wasmInitialized = false;

/**
 * Ensures that the WASM module from wasm-pqc-subtle is initialized.
 */
export function ensureWasmInit(): void {
  if (wasmInitialized) return;
  try {
    let wasmPath: string;
    try {
      // First, try to resolve from node_modules using require.resolve
      // @ts-expect-error - require.resolve might not be available in all environments
      const resolvedPath =
        require.resolve("wasm-pqc-subtle/wasm_pqc_subtle_bg.wasm");
      wasmPath = resolvedPath;
    } catch {
      // Fallback to relative path
      wasmPath = join(
        __dir,
        "../../node_modules/wasm-pqc-subtle/wasm_pqc_subtle_bg.wasm",
      );
    }

    const wasmBuffer = readFileSync(wasmPath);
    initSync({ module: wasmBuffer });
    wasmInitialized = true;
  } catch (err) {
    console.error("Failed to initialize WASM module:", err);
    throw err;
  }
}

/**
 * Hashes a passphrase using Argon2id.
 * @param passphrase The passphrase to hash.
 * @returns A PHC-formatted hash string.
 */
export async function hashPassphrase(passphrase: string): Promise<string> {
  ensureWasmInit();
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(passphrase);
  return argon2id_hash(passwordBytes);
}

/**
 * Verifies a passphrase against an Argon2 hash.
 * @param passphrase The passphrase to verify.
 * @param hash The PHC-formatted Argon2 hash.
 * @returns True if the passphrase matches the hash.
 */
export async function verifyPassphrase(
  passphrase: string,
  hash: string,
): Promise<boolean> {
  ensureWasmInit();
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(passphrase);
  try {
    return argon2_verify(passwordBytes, hash);
  } catch (err) {
    console.error("Argon2 verification failed:", err);
    return false;
  }
}
