#!/usr/bin/env bun

import { downloadResource, findMostRecentResource } from "../lib";
import { pdfToJson } from "../etl/pdf-json";

const DIR = new URL("../../data/vcc/", import.meta.url).pathname;

console.log("Checking for most recent VCC Book...");

const found = await findMostRecentResource("vcc", 2, "HEAD");
if (!found) {
  console.error(`Error: Could not find a VCC Book for the last 2 years.`);
  process.exit(1);
}

const outpath = `${DIR}/${found.localName}`;
console.log(`Fetching ${found.localName} into ${DIR}...`);
await downloadResource(found.url, outpath);

const sizeMB = (Bun.file(outpath).size / 1024 / 1024).toFixed(1);
console.log(`Done. Downloaded ${found.localName} (${sizeMB}M).`);

if (found.localName.endsWith(".pdf")) {
  const jsonName = found.localName.replace(".pdf", ".json");
  const jsonPath = `${DIR}/${jsonName}`;
  console.log(`Converting ${found.localName} to ${jsonName}...`);
  const jsonData = await pdfToJson(outpath);
  await Bun.write(jsonPath, JSON.stringify(jsonData, null, 2));
  console.log("Done.");
}
