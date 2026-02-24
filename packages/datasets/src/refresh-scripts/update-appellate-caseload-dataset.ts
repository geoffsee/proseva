#!/usr/bin/env bun

import { configureFetchForDataset, getDatasetResources, HEADERS } from "../lib";
import { pdfToJson } from "../etl/pdf-json";

const DIR = new URL(
  "../../data/appellate_caseload/",
  import.meta.url
).pathname;

const currentYear = new Date().getFullYear();

console.log("Fetching most recent appellate caseload reports...");

configureFetchForDataset("appellate_caseload");

let foundYear: number | null = null;
let foundResources: Array<{ url: string; localName: string }> = [];

for (const year of [currentYear, currentYear - 1]) {
  const resources = getDatasetResources("appellate_caseload", year) as Array<{
    url: string;
    localName: string;
  }>;

  const ok = await Promise.all(
    resources.map(async ({ url }) => {
      try {
        const res = await fetch(url, { headers: HEADERS, method: "HEAD" });
        return res.ok;
      } catch {
        return false;
      }
    })
  );

  const present = resources.filter((_, i) => ok[i]);
  if (present.length) {
    foundYear = year;
    foundResources = present;
    break;
  }
}

if (!foundYear || !foundResources.length) {
  console.log(
    `  no report found for ${currentYear} or ${currentYear - 1}`
  );
  console.log("Done.");
  process.exit(0);
}

for (const { url, localName } of foundResources) {
  const courtDir =
    localName.startsWith("scv_") ? "scv" : localName.startsWith("cav_") ? "cav" : "";
  const outpath = courtDir ? `${DIR}/${courtDir}/${localName}` : `${DIR}/${localName}`;

  process.stdout.write(`  ${outpath.replace(`${DIR}/`, "").padEnd(40)} `);
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      await Bun.write(outpath, buffer);
      console.log("OK");

      if (localName.endsWith(".pdf")) {
        const jsonName = localName.replace(".pdf", ".json");
        const jsonPath = outpath.replace(".pdf", ".json");
        process.stdout.write(`  converting to ${jsonName.padEnd(40)} `);
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
}

console.log("Done.");
