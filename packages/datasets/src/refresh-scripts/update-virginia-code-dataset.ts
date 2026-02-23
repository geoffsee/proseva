#!/usr/bin/env bun

// law.lis.virginia.gov has a broken certificate chain
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE_URL = "https://law.lis.virginia.gov";
const DIR = new URL("../../data/virginia_code/", import.meta.url).pathname;

const TITLE_NUMBERS = [
  "1", "2.2", "3.2", "4.1", "5.1", "6.2",
  "8.01", "8.1A", "8.2", "8.2A", "8.3A", "8.4", "8.4A", "8.5A",
  "8.7", "8.8A", "8.9A", "8.10", "8.11", "8.12", "8.13",
  "9.1", "10.1", "11", "12.1", "13.1", "15.2", "16.1", "17.1",
  "18.2", "19.2", "20", "21", "22.1", "23.1", "24.2", "25.1",
  "27", "28.2", "29.1", "30", "32.1", "33.2", "34", "35.1",
  "36", "37.2", "38.2", "40.1", "41.1", "42.1", "43", "44",
  "45.2", "46.2", "47.1", "48", "49", "50", "51.1", "51.5",
  "52", "53.1", "54.1", "55.1", "56", "57", "58.1", "59.1",
  "60.2", "61.1", "62.1", "63.2", "64.2", "65.2", "66",
];

const files: [string, string][] = [
  ["/CSV/PopularNames.csv", "PopularNames.csv"],
  ...TITLE_NUMBERS.map(
    (n): [string, string] => [`/CSV/CoVTitle_${n}.csv`, `CoVTitle_${n}.csv`]
  ),
];

console.log(
  `Fetching Code of Virginia resources (${files.length} files) into ${DIR}...`
);

for (const [remotePath, localName] of files) {
  process.stdout.write(`  ${localName.padEnd(25)} `);
  try {
    const res = await fetch(`${BASE_URL}${remotePath}`);
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
