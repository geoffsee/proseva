import { defineConfig } from "vitest/config";
import { resolve } from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "idb-repo": resolve(
        import.meta.dirname ?? __dirname,
        "../../node_modules/idb-repo/dist/index-browser.js",
      ),
      "@proseva/sdk": resolve(
        import.meta.dirname ?? __dirname,
        "../sdk/src/index.ts",
      ),
    },
  },
  test: {
    exclude: ["node_modules/**", "e2e/**"],
    environment: "happy-dom",
    globals: true,
    setupFiles: "./src/test-setup.ts",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json"],
      reportsDirectory: "./coverage",
      exclude: [
        "node_modules/**",
        "src/test-*.ts",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/test-utils.tsx",
        "src/main.tsx",
        "src/index.css",
        "**/*.d.ts",
        "**/types.ts",
        "vite.config.ts",
        "vitest.config.ts",
        "server/**",
        "scripts/**",
      ],
      include: ["src/**/*.{ts,tsx}"],
      all: true,
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70,
    },
  },
});
