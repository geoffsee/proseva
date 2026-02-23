#!/usr/bin/env bun

const BASE_URL =
  "https://www.vacourts.gov/static/courts/gd/resources/manuals/gdman";
const DIR = new URL("../../data/gdman/", import.meta.url).pathname;

const files = ["gd_manual.pdf"];

console.log(`Fetching GD Manual resources into ${DIR}...`);

for (const f of files) {
  process.stdout.write(`  ${f.padEnd(25)} `);
  try {
    const res = await fetch(`${BASE_URL}/${f}`);
    if (res.ok) {
      await Bun.write(`${DIR}/${f}`, await res.arrayBuffer());
      console.log("OK");
    } else {
      console.log(`FAILED (${res.status})`);
    }
  } catch (e) {
    console.log(`FAILED (${e instanceof Error ? e.message : e})`);
  }
}

console.log("Done.");
