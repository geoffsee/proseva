#!/usr/bin/env bun

const BASE_URL = "https://www.vacourts.gov/static";
const DIR = new URL("../../data/other/", import.meta.url).pathname;

const files: [string, string][] = [
  [
    "courtadmin/aoc/djs/resources/ust/ust_table.pdf",
    "ust_table.pdf",
  ],
  [
    "resources/small_claims_court_procedures.pdf",
    "small_claims_court_procedures.pdf",
  ],
  [
    "courts/vacourtfacility/complete.pdf",
    "courthouse_facility_guidelines.pdf",
  ],
  ["directories/dist.pdf", "district_courts_directory.pdf"],
  ["courts/scv/rulesofcourt.pdf", "rulesofcourt.pdf"],
];

console.log(`Fetching miscellaneous resources into ${DIR}...`);

for (const [remotePath, localName] of files) {
  process.stdout.write(`  ${localName.padEnd(40)} `);
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
