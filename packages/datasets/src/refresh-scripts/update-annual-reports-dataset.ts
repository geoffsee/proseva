#!/usr/bin/env bun

const BASE_URL = "https://www.vacourts.gov/static/courts/sjr/reports";
const DIR = new URL("../../data/annual_reports/", import.meta.url).pathname;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

const currentYear = new Date().getFullYear();

console.log(`Checking for most recent State of the Judiciary report (starting from ${currentYear})...`);

let found: { year: number; url: string; isHtml: boolean } | null = null;

// Search through years
for (let year = currentYear; year >= currentYear - 10; year--) {
  const attempts = [
    {
      url: `https://ar.vacourts.gov/${year}annualreport.html`,
      isHtml: true,
    },
    {
      url: `${BASE_URL}/${year}/state_of_the_judiciary_report.pdf`,
      isHtml: false,
    },
    {
      url: `https://www.vacourts.gov/static/courts/sjr/reports/${year}_sjr.pdf`,
      isHtml: false,
    },
  ];

  for (const attempt of attempts) {
    try {
      const res = await fetch(attempt.url, { headers: HEADERS, method: "HEAD" });
      if (res.ok) {
        found = { year, url: attempt.url, isHtml: attempt.isHtml };
        break;
      }
    } catch  {
      // Ignore fetch errors
    }
  }
  if (found) break;
}

if (!found) {
  console.error(
    `Error: Could not find a report for years ${currentYear} through ${currentYear - 10}.`
  );
  process.exit(1);
}

const ext = found.isHtml ? "html" : "pdf";
const localName = `state_of_the_judiciary_report_${found.year}.${ext}`;
console.log(`Fetching ${localName} from ${found.url} into ${DIR}...`);

const res = await fetch(found.url, { headers: HEADERS });
if (!res.ok) {
  console.error(`Download failed (${res.status})`);
  process.exit(1);
}
await Bun.write(`${DIR}/${localName}`, await res.arrayBuffer());

const sizeMB = (Bun.file(`${DIR}/${localName}`).size / 1024 / 1024).toFixed(1);
console.log(`Done. Downloaded ${localName} (${sizeMB}M).`);
