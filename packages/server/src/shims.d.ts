declare module "wasm-similarity/wasm_similarity_core.js" {
  export function initSync(...args: unknown[]): void;
  export function cosine_similarity(...args: unknown[]): Float64Array;
  export function cosine_similarity_dataspace(...args: unknown[]): Float64Array;
}
