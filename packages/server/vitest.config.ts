import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "bun:sqlite": resolve(
        import.meta.dirname ?? __dirname,
        "src/__mocks__/bun-sqlite.ts",
      ),
      "drizzle-orm/bun-sqlite": resolve(
        import.meta.dirname ?? __dirname,
        "src/__mocks__/drizzle-bun-sqlite.ts",
      ),
      "idb-repo": resolve(
        import.meta.dirname ?? __dirname,
        "../../node_modules/idb-repo/dist/index-node.js",
      ),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    globals: true,
    setupFiles: "./src/test-setup.ts",
  },
});
