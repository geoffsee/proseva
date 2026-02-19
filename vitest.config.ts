import { defineConfig } from "vitest/config";

/**
 * Root vitest configuration for the ProSeVA monorepo
 *
 * This configuration enables testing the entire monorepo with a single command,
 * discovering and running tests from all workspace packages without chaining
 * shell commands.
 *
 * USAGE:
 *
 *   # Run all tests once
 *   bun run test
 *
 *   # Run tests in watch mode
 *   bun run test:watch
 *
 *   # Run tests with UI dashboard
 *   bun run test:ui
 *
 *   # Run tests with coverage report
 *   bun run test:coverage
 *
 *   # Run specific package tests from root
 *   vitest run packages/server
 *   vitest run packages/gui
 *
 *   # Individual package tests (from package directory)
 *   cd packages/server && bun run test
 *   cd packages/gui && bun run test
 *
 * WORKSPACE STRUCTURE:
 *
 * The workspace configuration references each package's vitest.config.ts
 * to ensure their specific setup files, aliases, and configurations are
 * properly applied. This preserves:
 *
 * - packages/server: Node environment, test setup with db initialization
 * - packages/gui: Browser environment (happy-dom), React plugin, coverage thresholds
 * - packages/sdk: Node environment, lightweight setup
 */
export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        extends: "./packages/server/vitest.config.ts",
        test: {
          name: "server",
          root: "./packages/server",
        },
      },
      {
        extends: "./packages/gui/vitest.config.ts",
        test: {
          name: "gui",
          root: "./packages/gui",
        },
      },
      {
        test: {
          name: "sdk",
          root: "./packages/sdk",
          include: ["src/**/*.test.ts"],
          globals: true,
          environment: "node",
        },
      },
    ],
  },
});
