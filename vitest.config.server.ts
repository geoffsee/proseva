import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["server/src/**/*.test.ts"],
    globals: true,
    setupFiles: "./server/src/test-setup.ts",
  },
});
