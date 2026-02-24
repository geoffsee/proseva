import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Global mock for virginiaCourtsApi — prevents real fetch calls from
// useVirginiaCourts in any component test that doesn't provide its own mock.
vi.mock("./lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/api")>();
  return {
    ...actual,
    virginiaCourtsApi: {
      list: vi.fn().mockResolvedValue([]),
    },
  };
});

// Suppress known harmless Node.js process warnings that pollute CI output
const _originalEmit = process.emit;
// @ts-expect-error - overriding emit to filter noisy warnings
process.emit = function (event: string, ...args: unknown[]) {
  if (event === "warning") {
    const msg = (args[0] as { message?: string })?.message ?? "";
    if (msg.includes("--localstorage-file") || msg.includes("punycode")) {
      return false;
    }
  }
  // @ts-expect-error - forwarding original call
  return _originalEmit.call(process, event, ...args);
};
