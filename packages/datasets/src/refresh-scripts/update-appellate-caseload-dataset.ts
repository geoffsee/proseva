#!/usr/bin/env bun

const BASE_URL =
  "https://www.vacourts.gov/static/courtadmin/aoc/djs/programs/cpss/csi/stats";
const DIR = new URL(
  "../../data/appellate_caseload/",
  import.meta.url
).pathname;

const currentYear = new Date().getFullYear();

const courts: [string, string][] = [
  ["scv", "scv"],
  ["cav", "cav"],
];

console.log("Fetching most recent appellate caseload reports...");

for (const [courtDir, prefix] of courts) {
  let found: number | null = null;
  for (const year of [currentYear, currentYear - 1]) {
    const file = `${prefix}_caseload_rpt_${year}.pdf`;
    const res = await fetch(`${BASE_URL}/${courtDir}/${file}`, {
      method: "HEAD",
    });
    if (res.ok) {
      found = year;
      break;
    }
  }

  if (!found) {
    console.log(
      `  ${courtDir}: no report found for ${currentYear} or ${currentYear - 1}`
    );
    continue;
  }

  const file = `${prefix}_caseload_rpt_${found}.pdf`;
  process.stdout.write(`  ${courtDir}/${file.padEnd(35)} `);
  try {
    const res = await fetch(`${BASE_URL}/${courtDir}/${file}`);
    if (res.ok) {
      await Bun.write(`${DIR}/${courtDir}/${file}`, await res.arrayBuffer());
      console.log("OK");
    } else {
      console.log(`FAILED (${res.status})`);
    }
  } catch (e) {
    console.log(`FAILED (${e instanceof Error ? e.message : e})`);
  }
}

console.log("Done.");
