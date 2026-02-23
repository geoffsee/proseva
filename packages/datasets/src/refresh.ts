#!/usr/bin/env bun

import { Glob } from "bun";
import { basename } from "path";

const scriptsDir = new URL("./refresh-scripts/", import.meta.url).pathname;
const scripts = Array.from(new Glob("update-*.ts").scanSync(scriptsDir)).sort();

const nameOf = (s: string) =>
  basename(s)
    .replace(/^update-/, "")
    .replace(/-dataset\.ts$/, "");

const pad = Math.max(...scripts.map((s) => nameOf(s).length));
const total = scripts.length;
let completed = 0;
let failed = 0;

const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

console.log(bold(`Refreshing ${total} datasets...\n`));

const start = performance.now();

const results = await Promise.allSettled(
  scripts.map(async (script) => {
    const name = nameOf(script);
    const t0 = performance.now();
    const proc = Bun.spawn(["bun", `${scriptsDir}/${script}`], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    const elapsed = ((performance.now() - t0) / 1000).toFixed(1);

    if (exitCode === 0) {
      completed++;
      console.log(
        `  ${green("✓")} ${name.padEnd(pad)}  ${dim(`${elapsed}s`)}  ${dim(`[${completed + failed}/${total}]`)}`
      );
    } else {
      failed++;
      const stderr = await new Response(proc.stderr).text();
      console.log(
        `  ${red("✗")} ${name.padEnd(pad)}  ${dim(`${elapsed}s`)}  ${dim(`[${completed + failed}/${total}]`)}`
      );
      if (stderr.trim()) {
        for (const line of stderr.trim().split("\n")) {
          console.log(`    ${red(line)}`);
        }
      }
    }

    return { name, exitCode };
  })
);

const elapsed = ((performance.now() - start) / 1000).toFixed(1);
console.log();

if (failed > 0) {
  console.log(
    bold(`Done in ${elapsed}s: ${green(`${completed} passed`)}, ${red(`${failed} failed`)}`)
  );
  process.exit(1);
} else {
  console.log(bold(`Done in ${elapsed}s: ${green(`all ${total} passed`)}`));
}
