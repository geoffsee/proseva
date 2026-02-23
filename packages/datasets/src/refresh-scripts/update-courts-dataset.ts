#!/usr/bin/env bun

import { readFileSync } from "fs";
import * as mupdf from "mupdf";
import { resolve } from "path";

// ── Configuration ───────────────────────────────────────────────────────────

const PDF_URL = "https://www.vacourts.gov/static/directories/dist.pdf";
const DEFAULT_PDF = "/tmp/va-dist-courts.pdf";
const DEFAULT_JSON = new URL(
  "../../data/courts/va-courts.json",
  import.meta.url
).pathname;

const pdfPath = resolve(Bun.argv[2] ?? DEFAULT_PDF);
const jsonPath = resolve(Bun.argv[3] ?? DEFAULT_JSON);

// ── Patterns ────────────────────────────────────────────────────────────────

const RE_COURT_NAME = /^(.+?)\s+(GD & JDR|GD|JDR)$/;
const RE_JUDICIAL_DISTRICT = /^(.+\s+Judicial District)$/;
const RE_PHONE = /^(\d{3}[/\-]\d{3}[/\-]\d{4})$/;
const RE_LABELED_PHONE = /^(\w+):\s*(\d{3}[/\-]\d{3}[/\-]\d{4})$/;
const RE_FAX = /^Fax\s*-\s*(.+)$/;
const RE_CITY_STATE_ZIP = /^(.+?),\s*VA\s+(\d{5}(?:-\d{4})?)$/;
const RE_HOURS = /^Clerk'?s Office Hours:\s*(.+)$/;
const RE_HOMEPAGE = /^Homepage:(.+)$/;
const RE_EMAIL_LABELED = /^E-?Mail:\s*(\S+@\S+)$/i;
const RE_EMAIL_BARE = /^\S+@vacourts\.gov$/;
const RE_EMAIL_LINE = /^email:\s*$/i;
const RE_JUDGE = /^Hon\.\s+(.+)$/;
const RE_PAGE_HEADER =
  /^(COURT\/DISTRICT\/ADDRESS|JUDGE\(S\)|CLERK\/CONTACT INFORMATION|District Courts Directory|Page\s+\d+\s+of\s+\d+|\d{2}-\w{3}-\d{4}\s+\d{2}:\d{2}:\d{2})$/;
const RE_PO_BOX = /^P\.?\s*O\.?\s*Box\s+\d+/i;
const RE_PHYSICAL_ADDR = /^Physical Address:\s*(.*)$/i;
const RE_MAILING_ADDR = /^Mailing Address:\s*(.*)$/i;

const COURT_TYPES: Record<string, string> = {
  GD: "General District",
  JDR: "Juvenile & Domestic Relations",
  "GD & JDR": "Combined District",
};

const ADDRESS_KEYWORDS = [
  "Street",
  "Avenue",
  "Road",
  "Blvd",
  "Drive",
  "Suite",
  "Floor",
  "Courthouse",
  "Mall",
  "Center",
  "Plaza",
  "Building",
  "Rd.",
  "St.",
  "Ave.",
];

// ── Types ───────────────────────────────────────────────────────────────────

interface Court {
  name: string;
  locality: string;
  type: string;
  district: string | null;
  clerk: string | null;
  phone: string | null;
  phones: Record<string, string>;
  fax: string | null;
  email: string | null;
  address: string | string[] | null;
  city: string | null;
  state: string;
  zip: string | null;
  hours: string | null;
  homepage: string | null;
  judges: string[];
}

// ── PDF Text Extraction ─────────────────────────────────────────────────────

function extractText(pdfPath: string): string {
  const buf = new Uint8Array(readFileSync(pdfPath));
  const doc = mupdf.Document.openDocument(buf, "application/pdf");
  const pages: string[] = [];
  for (let i = 0; i < doc.countPages(); i++) {
    const page = doc.loadPage(i);
    const st = page.toStructuredText("preserve-whitespace");
    pages.push(st.asText());
  }
  return pages.join("\n");
}

// ── Parser ──────────────────────────────────────────────────────────────────

function splitIntoBlocks(text: string): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (RE_PAGE_HEADER.test(line)) continue;
    if (!line) continue;
    current.push(line);
    if (RE_HOMEPAGE.test(line)) {
      blocks.push(current);
      current = [];
    }
  }
  return blocks;
}

function parseBlock(lines: string[]): Court | null {
  if (!lines.length) return null;
  const m = RE_COURT_NAME.exec(lines[0]!);
  if (!m) return null;

  const locality = m[1]!.trim();
  const courtCode = m[2]!.trim();
  const courtType = COURT_TYPES[courtCode] ?? courtCode;

  const court: Court = {
    name: `${locality} ${courtCode}`,
    locality,
    type: courtType,
    district: null,
    clerk: null,
    phone: null,
    phones: {},
    fax: null,
    email: null,
    address: [],
    city: null,
    state: "VA",
    zip: null,
    hours: null,
    homepage: null,
    judges: [],
  };

  let expectEmailNext = false;

  for (const line of lines.slice(1)) {
    let matched = false;

    const patterns: [RegExp, (m: RegExpExecArray) => void][] = [
      [RE_JUDICIAL_DISTRICT, (m) => (court.district = m[1]!)],
      [RE_HOMEPAGE, (m) => (court.homepage = m[1]!.trim())],
      [RE_HOURS, (m) => (court.hours = m[1]!.trim())],
      [RE_FAX, (m) => (court.fax = m[1]!.trim())],
      [
        RE_LABELED_PHONE,
        (m) => {
          court.phones[m[1]!] = m[2]!;
          if (!court.phone) court.phone = m[2]!;
        },
      ],
      [
        RE_PHONE,
        (m) => {
          if (!court.phone) court.phone = m[1]!;
          else court.phones["other"] = m[1]!;
        },
      ],
      [RE_EMAIL_LABELED, (m) => (court.email = m[1]!.trim())],
      [RE_EMAIL_BARE, () => (court.email = line.trim())],
      [RE_JUDGE, (m) => court.judges.push(m[1]!.trim())],
      [
        RE_CITY_STATE_ZIP,
        (m) => {
          court.city = m[1]!.trim();
          court.zip = m[2]!.trim();
        },
      ],
    ];

    for (const [pat, action] of patterns) {
      const result = pat.exec(line);
      if (result) {
        action(result);
        matched = true;
        break;
      }
    }

    if (matched) continue;

    if (RE_EMAIL_LINE.test(line)) {
      expectEmailNext = true;
      continue;
    }
    if (expectEmailNext && line.includes("@")) {
      court.email = line.trim();
      expectEmailNext = false;
      continue;
    }
    expectEmailNext = false;

    if (
      court.clerk === null &&
      court.district === null &&
      !RE_PO_BOX.test(line)
    ) {
      const skipPatterns = [
        RE_PAGE_HEADER,
        RE_HOMEPAGE,
        RE_HOURS,
        RE_FAX,
        RE_PHONE,
        RE_LABELED_PHONE,
        RE_EMAIL_LABELED,
        RE_EMAIL_BARE,
        RE_JUDGE,
        RE_CITY_STATE_ZIP,
      ];
      if (!skipPatterns.some((p) => p.test(line))) {
        court.clerk = line;
        continue;
      }
    }

    if (
      RE_PO_BOX.test(line) ||
      /^\d+\s+/.test(line) ||
      ADDRESS_KEYWORDS.some((w) => line.includes(w))
    ) {
      (court.address as string[]).push(line);
      continue;
    }

    const mPhys = RE_PHYSICAL_ADDR.exec(line);
    const mMail = RE_MAILING_ADDR.exec(line);
    if (mPhys || mMail) {
      const addr = ((mPhys ?? mMail)![1] ?? "").trim();
      if (addr) (court.address as string[]).push(line);
      continue;
    }
  }

  // Clean up
  if (!Object.keys(court.phones).length) delete (court as any).phones;
  if (!court.email) court.email = null;
  if (!(court.address as string[]).length) {
    court.address = null;
  } else {
    court.address = (court.address as string[]).join(", ");
  }

  return court;
}

// ── Main ────────────────────────────────────────────────────────────────────

// Download PDF if missing
if (!(await Bun.file(pdfPath).exists())) {
  console.log("PDF not found → downloading from vacourts.gov...");
  const res = await fetch(PDF_URL);
  if (!res.ok) {
    console.error(`Download failed (${res.status})`);
    process.exit(1);
  }
  await Bun.write(pdfPath, await res.arrayBuffer());
}

console.log(
  `Parsing ${pdfPath.split("/").pop()} → ${jsonPath.split("/").pop()}`
);

const text = extractText(pdfPath);
const blocks = splitIntoBlocks(text);
const courts = blocks.map(parseBlock).filter((c): c is Court => c !== null);

await Bun.write(jsonPath, JSON.stringify(courts, null, 2) + "\n");
console.error(`Wrote ${courts.length} courts → ${jsonPath}`);
