#!/usr/bin/env bun

import { configureFetchForDataset, getDatasetResources, HEADERS } from "../lib";
import { csvToJson } from "../etl/csv-json";

const DIR = new URL("../../data/virginia_code/", import.meta.url).pathname;

configureFetchForDataset("virginia_code");

const files = getDatasetResources("virginia_code") as Array<{
  url: string;
  localName: string;
}>;

console.log(
  `Fetching Code of Virginia resources (${files.length} files) into ${DIR}...`
);

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
  await Bun.sleep(1000);
}

console.log("Done.");
