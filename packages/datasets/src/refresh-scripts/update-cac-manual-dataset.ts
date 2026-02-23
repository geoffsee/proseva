#!/usr/bin/env bun

const BASE_URL =
  "https://www.vacourts.gov/static/courtadmin/aoc/djs/resources";
const DIR = new URL("../../data/cac_manual/", import.meta.url).pathname;

const files: [string, string][] = [
  ["manuals/ctapptatty/cacmanual.pdf", "cacmanual.pdf"],
  ["manuals/ctapptatty/toc.pdf", "toc.pdf"],
  ["indigency_guidelines.pdf", "indigency_guidelines.pdf"],
];

console.log(`Fetching Court-Appointed Counsel resources into ${DIR}...`);

for (const [remotePath, localName] of files) {
  process.stdout.write(`  ${localName.padEnd(30)} `);
  try {
    const res = await fetch(`${BASE_URL}/${remotePath}`);
    if (res.ok) {
      await Bun.write(`${DIR}/${localName}`, await res.arrayBuffer());
      console.log("OK");
    } else {
      console.log(`FAILED (${res.status})`);
    }
  } catch (e) {
    console.log(`FAILED (${e instanceof Error ? e.message : e})`);
  }
  await Bun.sleep(1000);
}

console.log("Done.");
