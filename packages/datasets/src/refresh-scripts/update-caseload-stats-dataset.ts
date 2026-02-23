#!/usr/bin/env bun

const BASE_URL =
  "https://www.vacourts.gov/static/courtadmin/aoc/djs/programs/cpss/csi";
const DIR = new URL("../../data/caseload_stats/", import.meta.url).pathname;

const files: [string, string][] = [
  ["stats/cc_filings.pdf", "cc_filings.pdf"],
  ["stats/cc_disps.pdf", "cc_disps.pdf"],
  ["stats/gdc_filings.pdf", "gdc_filings.pdf"],
  ["stats/gdc_disps.pdf", "gdc_disps.pdf"],
  ["stats/jdr_filings.pdf", "jdr_filings.pdf"],
  ["stats/jdr_disps.pdf", "jdr_disps.pdf"],
  ["public_qrg.pdf", "public_qrg.pdf"],
];

console.log(`Fetching caseload statistics into ${DIR}...`);

for (const [remotePath, localName] of files) {
  process.stdout.write(`  ${localName.padEnd(25)} `);
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
