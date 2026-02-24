#!/usr/bin/env bun

import { configureFetchForDataset, getDatasetResources, HEADERS } from "../lib";
import { pdfToJson } from "../etl/pdf-json";

const DIR = new URL("../../data/benchbook/", import.meta.url).pathname;

console.log(`Fetching District Court Judges' Benchbook into ${DIR}...`);

configureFetchForDataset("benchbook");
const resources = getDatasetResources("benchbook") as Array<{
  url: string;
  localName: string;
}>;

for (const { url, localName } of resources) {
  process.stdout.write(`  ${localName.padEnd(30)} `);
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    console.log(`FAILED (${res.status})`);
    process.exit(1);
  }

  const outpath = `${DIR}/${localName}`;
  const buffer = await res.arrayBuffer();
  await Bun.write(outpath, buffer);
  const sizeMB = (Bun.file(outpath).size / 1024 / 1024).toFixed(1);
  console.log(`OK (${sizeMB}M)`);

  if (localName.endsWith(".pdf")) {
    const jsonName = localName.replace(".pdf", ".json");
    const jsonPath = `${DIR}/${jsonName}`;
    process.stdout.write(`  Converting to ${jsonName}... `);
    const jsonData = await pdfToJson(outpath);
    await Bun.write(jsonPath, JSON.stringify(jsonData, null, 2));
    console.log("OK");
  }
}

console.log("Done.");
