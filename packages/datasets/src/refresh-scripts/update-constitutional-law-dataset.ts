#!/usr/bin/env bun

import { configureFetchForDataset, getDatasetResources, HEADERS } from "../lib";
import { csvToJson } from "../etl/csv-json";

const DIR = new URL("../../data/constitutional_law/", import.meta.url).pathname;

configureFetchForDataset("constitutional_law");
const files = getDatasetResources("constitutional_law") as Array<{
  url: string;
  localName: string;
}>;

console.log(`Fetching Constitutional Law resources into ${DIR}...`);

for (const { url, localName } of files) {
  process.stdout.write(`  ${localName.padEnd(25)} `);
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const csvPath = `${DIR}/${localName}`;
      await Bun.write(csvPath, buffer);
      console.log("OK");

      if (localName.endsWith(".csv")) {
        const jsonName = localName.replace(".csv", ".json");
        const jsonPath = `${DIR}/${jsonName}`;
        process.stdout.write(`  Converting to ${jsonName}... `);
        const csvContent = new TextDecoder().decode(buffer);
        const jsonData = csvToJson(csvContent);
        await Bun.write(jsonPath, JSON.stringify(jsonData, null, 2));
        console.log("OK");
      }
    } else {
      console.log(`FAILED (${res.status})`);
    }
  } catch (e) {
    console.log(`FAILED (${e instanceof Error ? e.message : e})`);
  }
}

console.log("Done.");
