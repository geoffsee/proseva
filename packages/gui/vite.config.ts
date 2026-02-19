/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const WASM_PQC_SUBTLE_ASSET_NAME = "wasm_pqc_subtle_bg.wasm";
const WASM_CONTENT_TYPE = "application/wasm";

function resolveWasmPqcSubtlePath() {
  const candidates = [
    path.resolve(
      __dirname,
      "../../node_modules/idb-repo/node_modules/wasm-pqc-subtle",
      WASM_PQC_SUBTLE_ASSET_NAME,
    ),
    path.resolve(
      __dirname,
      "../../node_modules/wasm-pqc-subtle",
      WASM_PQC_SUBTLE_ASSET_NAME,
    ),
  ];

  const found = candidates.find((filePath) => fs.existsSync(filePath));
  if (!found) {
    throw new Error(
      `Unable to find ${WASM_PQC_SUBTLE_ASSET_NAME} for build output.`,
    );
  }

  return found;
}

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      "idb-repo": path.resolve(
        __dirname,
        "../../node_modules/idb-repo/dist/index-browser.js",
      ),
      "@proseva/sdk": path.resolve(__dirname, "../sdk/src/index.ts"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  plugins: [
    react(),
    {
      name: "serve-wasm-pqc-subtle-dev",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const requestPath = req.url?.split("?")[0] ?? "";
          if (!requestPath.endsWith(`/${WASM_PQC_SUBTLE_ASSET_NAME}`)) {
            return next();
          }

          try {
            const wasmPath = resolveWasmPqcSubtlePath();
            res.statusCode = 200;
            res.setHeader("Content-Type", WASM_CONTENT_TYPE);
            res.end(fs.readFileSync(wasmPath));
            return;
          } catch {
            res.statusCode = 404;
            res.end("WASM asset not found");
            return;
          }
        });
      },
    },
    {
      name: "emit-wasm-pqc-subtle-asset",
      apply: "build",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: `assets/${WASM_PQC_SUBTLE_ASSET_NAME}`,
          source: fs.readFileSync(resolveWasmPqcSubtlePath()),
        });
      },
    },
    {
      name: "idb-repo-wasm-vite-ignore",
      transform(code, id) {
        if (!id.includes("idb-repo/dist/index-browser.js")) return null;

        const from = 'new URL("wasm_pqc_subtle_bg.wasm",import.meta.url)';
        const to =
          'new URL(/* @vite-ignore */ "wasm_pqc_subtle_bg.wasm",import.meta.url)';

        if (!code.includes(from)) return null;
        return {
          code: code.replace(from, to),
          map: null,
        };
      },
    },
    {
      name: "serve-case-documents",
      configureServer(server) {
        const base = path.resolve(__dirname, "app-data");
        server.middlewares.use("/index-documents.json", (_req, res) => {
          res.setHeader("Content-Type", "application/json");
          import("fs").then((fs) => {
            try {
              const content = fs.readFileSync(
                path.join(base, "index.json"),
                "utf-8",
              );
              res.end(content);
            } catch {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: "Index not found" }));
            }
          });
        });
        server.middlewares.use("/texts/", (req, res, next) => {
          const file = req.url?.replace(/^\//, "");
          if (!file) return next();
          const filePath = path.join(base, "texts", file);
          import("fs").then((fs) => {
            try {
              if (fs.existsSync(filePath)) {
                res.setHeader("Content-Type", "text/plain");
                res.end(fs.readFileSync(filePath, "utf-8"));
              } else {
                res.statusCode = 404;
                res.end("Not found");
              }
            } catch {
              res.statusCode = 500;
              res.end("Error reading file");
            }
          });
        });
      },
    },
  ],
});
