#!/usr/bin/env bun

import { configureFetchForDataset, getDatasetResources, HEADERS } from "../lib";
import { pdfToJson } from "../etl/pdf-json";

const DIR = new URL("../../data/caseload_stats/", import.meta.url).pathname;

configureFetchForDataset("caseload_stats");
const files = getDatasetResources("caseload_stats") as Array<{
  url: string;
  localName: string;
}>;

console.log(`Fetching caseload statistics into ${DIR}...`);

for (const { url, localName } of files) {
  process.stdout.write(`  ${localName.padEnd(25)} `);
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const outpath = `${DIR}/${localName}`;
      await Bun.write(outpath, buffer);
      console.log("OK");

      if (localName.endsWith(".pdf")) {
        const jsonName = localName.replace(".pdf", ".json");
        const jsonPath = `${DIR}/${jsonName}`;
        process.stdout.write(`  Converting to ${jsonName}... `);
        const jsonData = await pdfToJson(outpath);
        await Bun.write(jsonPath, JSON.stringify(jsonData, null, 2));
        console.log("OK");
      }
    } else {
      console.log(`FAILED (${res.status})`);
    }
  } catch (e) {
    console.log(`FAILED (${e instanceof Error ? e.message : e})`);
  }
  await Bun.sleep(1000);
}

console.log("Done.");
