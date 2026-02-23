#!/usr/bin/env bun

const BASE_URL = "https://www.vacourts.gov/static/courts/sjr/reports";
const DIR = new URL("../../data/annual_reports/", import.meta.url).pathname;

const currentYear = new Date().getFullYear();

console.log("Checking for most recent State of the Judiciary report...");

let found: number | null = null;
for (const year of [currentYear, currentYear - 1]) {
  const res = await fetch(
    `${BASE_URL}/${year}/state_of_the_judiciary_report.pdf`,
    { method: "HEAD" }
  );
  if (res.ok) {
    found = year;
    break;
  }
}

if (!found) {
  console.error(
    `Error: Could not find a report for ${currentYear} or ${currentYear - 1}.`
  );
  process.exit(1);
}

const localName = `state_of_the_judiciary_report_${found}.pdf`;
console.log(`Fetching ${localName} into ${DIR}...`);

const res = await fetch(
  `${BASE_URL}/${found}/state_of_the_judiciary_report.pdf`
);
if (!res.ok) {
  console.error(`Download failed (${res.status})`);
  process.exit(1);
}
await Bun.write(`${DIR}/${localName}`, await res.arrayBuffer());

const sizeMB = (Bun.file(`${DIR}/${localName}`).size / 1024 / 1024).toFixed(1);
console.log(`Done. Downloaded ${localName} (${sizeMB}M).`);
