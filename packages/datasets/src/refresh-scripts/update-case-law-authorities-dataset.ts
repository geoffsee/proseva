#!/usr/bin/env bun

// law.lis.virginia.gov has a broken certificate chain
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE_URL = "https://law.lis.virginia.gov";
const DIR = new URL(
  "../../data/case_law_authorities/",
  import.meta.url
).pathname;

const files: [string, string][] = [
  ["/CSV/Authorities.csv", "Authorities.csv"],
  ["/CSV/Charters.csv", "Charters.csv"],
  ["/CSV/Compacts.csv", "Compacts.csv"],
  ["/CSV/UnCodifiedActs.csv", "UnCodifiedActs.csv"],
];

console.log(`Fetching Case Law Authorities resources into ${DIR}...`);

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
  await Bun.sleep(1000);
}

console.log("Done.");
