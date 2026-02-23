#!/usr/bin/env bun

const BASE_URL =
  "https://www.vacourts.gov/static/courts/jdr/resources/manuals/jdrman";
const DIR = new URL("../../data/jdrman/", import.meta.url).pathname;

const files = [
  "toc_jdr_manual.pdf",
  "chapter01.pdf",
  "chapter02.pdf",
  "chapter03.pdf",
  "chapter04.pdf",
  "chapter05.pdf",
  "chapter06.pdf",
  "chapter07.pdf",
  "chapter08.pdf",
  "chapter09.pdf",
  "chapter10.pdf",
  "chapter11.pdf",
  "chapter12.pdf",
  "chapter13.pdf",
  "appendix_a.pdf",
  "appendix_b.pdf",
  "appendix_c.pdf",
  "index.pdf",
  "glossary.pdf",
];

console.log(`Fetching JDR Manual resources into ${DIR}...`);

for (const f of files) {
  process.stdout.write(`  ${f.padEnd(25)} `);
  try {
    const res = await fetch(`${BASE_URL}/${f}`);
    if (res.ok) {
      await Bun.write(`${DIR}/${f}`, await res.arrayBuffer());
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
