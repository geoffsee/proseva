#!/usr/bin/env bun

import { getDatasetResources, HEADERS } from "../lib";
import { parseVirginiaCourts } from "../etl/courts-json";
import { extractTextFromPdf } from "../etl/pdf-json";

const { pdfUrl } = getDatasetResources("courts") as {
  pdfUrl: string;
  parser?: unknown;
};

const DIR = new URL("../../data/courts", import.meta.url).pathname;
const pdfPath = `${DIR}/district_courts_directory.pdf`;
const jsonPath = `${DIR}/courts.json`;

const res = await fetch(pdfUrl, { headers: HEADERS });
if (!res.ok) {
  console.error(`Download failed (${res.status})`);
  process.exit(1);
}

await Bun.write(pdfPath, await res.arrayBuffer());

const text = await extractTextFromPdf(pdfPath);
const courtsJson = parseVirginiaCourts(text);
await Bun.write(jsonPath, JSON.stringify(courtsJson));
console.error(`Wrote ${courtsJson.length} courts → ${jsonPath}`);
