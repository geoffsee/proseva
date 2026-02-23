#!/usr/bin/env bun

// law.lis.virginia.gov has a broken certificate chain
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE_URL = "https://law.lis.virginia.gov";
const DIR = new URL("../../data/constitutional_law/", import.meta.url).pathname;

const files: [string, string][] = [
  ["/CSV/Constitution.csv", "Constitution.csv"],
];

console.log(`Fetching Constitutional Law resources into ${DIR}...`);

for (const [remotePath, localName] of files) {
  process.stdout.write(`  ${localName.padEnd(25)} `);
  try {
    const res = await fetch(`${BASE_URL}${remotePath}`);
    if (res.ok) {
      await Bun.write(`${DIR}/${localName}`, await res.arrayBuffer());
      console.log("OK");
    } else {
      console.log(`FAILED (${res.status})`);
    }
  } catch (e) {
    console.log(`FAILED (${e instanceof Error ? e.message : e})`);
  }
}

console.log("Done.");
