#!/usr/bin/env bun

import { configureFetchForDataset, getDatasetResources, HEADERS } from "../lib";

const DIR = new URL("../../data/other/", import.meta.url).pathname;

configureFetchForDataset("other");
const files = getDatasetResources("other") as Array<{
  url: string;
  localName: string;
}>;

console.log(`Fetching miscellaneous resources into ${DIR}...`);

for (const { url, localName } of files) {
  process.stdout.write(`  ${localName.padEnd(40)} `);
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) {
      await Bun.write(`${DIR}/${localName}`, await res.arrayBuffer());
      console.log("OK");
    } else {
      console.log(`FAILED (${res.status})`);
    }
  } catch (e) {
    console.log(`FAILED (${e instanceof Error ? e.message : e})`);
  }
  await Bun.sleep(1000);
}

console.log("Done.");
