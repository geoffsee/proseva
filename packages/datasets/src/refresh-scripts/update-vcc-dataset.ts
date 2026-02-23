#!/usr/bin/env bun

const BASE_URL = "http://www.vcsc.virginia.gov/VCCs";
const DIR = new URL("../../data/vcc/", import.meta.url).pathname;

const currentYear = new Date().getFullYear();

console.log("Checking for most recent VCC Book...");

let found: number | null = null;
for (const year of [currentYear, currentYear - 1]) {
  const url = `${BASE_URL}/${year}/${year}VCCBook.pdf`;
  const res = await fetch(url, { method: "HEAD" });
  if (res.ok) {
    found = year;
    break;
  }
}

if (!found) {
  console.error(
    `Error: Could not find a VCC Book for ${currentYear} or ${currentYear - 1}.`
  );
  process.exit(1);
}

const outfile = `${found}VCCBook.pdf`;
const outpath = `${DIR}/${outfile}`;
console.log(`Fetching ${outfile} into ${DIR}...`);

const res = await fetch(`${BASE_URL}/${found}/${outfile}`);
if (!res.ok) {
  console.error(`Download failed (${res.status})`);
  process.exit(1);
}
await Bun.write(outpath, await res.arrayBuffer());

const sizeMB = (Bun.file(outpath).size / 1024 / 1024).toFixed(1);
console.log(`Done. Downloaded ${outfile} (${sizeMB}M).`);
