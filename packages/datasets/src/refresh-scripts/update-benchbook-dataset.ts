#!/usr/bin/env bun

const DATASET_URL =
  "https://www.vacourts.gov/static/courts/gd/resources/manuals/districtcourtbenchbook.pdf";
const DIR = new URL("../../data/benchbook/", import.meta.url).pathname;

console.log(`Fetching District Court Judges' Benchbook into ${DIR}...`);

const res = await fetch(DATASET_URL);
if (!res.ok) {
  console.error(`Download failed (${res.status})`);
  process.exit(1);
}

const outpath = `${DIR}/districtcourtbenchbook.pdf`;
await Bun.write(outpath, await res.arrayBuffer());

const sizeMB = (Bun.file(outpath).size / 1024 / 1024).toFixed(1);
console.log(`Done. Downloaded districtcourtbenchbook.pdf (${sizeMB}M).`);
