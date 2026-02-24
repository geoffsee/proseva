#!/usr/bin/env bun

import { Database } from "bun:sqlite";
import { Glob } from "bun";
import { join, basename } from "path";

const DATA_DIR = "data";
const DB_PATH = join(DATA_DIR, "virginia.db");

// Delete existing DB to start fresh
try {
  await Bun.file(DB_PATH).delete();
} catch (e) {}

const db = new Database(DB_PATH);

// --- 1. COURTS ---
db.run(`
  CREATE TABLE IF NOT EXISTS courts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    locality TEXT,
    type TEXT,
    district TEXT,
    clerk TEXT,
    phone TEXT,
    fax TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    hours TEXT,
    homepage TEXT,
    judges TEXT -- JSON array as text
  )
`);

// --- 2. CONSTITUTION ---
db.run(`
  CREATE TABLE IF NOT EXISTS constitution (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER,
    article TEXT,
    article_name TEXT,
    section_name TEXT,
    section_title TEXT,
    section_text TEXT,
    section_count INTEGER,
    last_update TEXT
  )
`);

// --- 3. VIRGINIA CODE ---
db.run(`
  CREATE TABLE IF NOT EXISTS virginia_code (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title_num TEXT,
    title_name TEXT,
    subtitle_num TEXT,
    subtitle_name TEXT,
    part_num TEXT,
    part_name TEXT,
    chapter_num TEXT,
    chapter_name TEXT,
    article_num TEXT,
    article_name TEXT,
    subpart_num TEXT,
    subpart_name TEXT,
    section TEXT,
    title TEXT,
    body TEXT
  )
`);

// --- 4. POPULAR NAMES ---
db.run(`
  CREATE TABLE IF NOT EXISTS popular_names (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    title_num TEXT,
    section TEXT,
    body TEXT
  )
`);

// --- 5. CASE LAW AUTHORITIES ---
db.run(`
  CREATE TABLE IF NOT EXISTS authorities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    short_name TEXT,
    codified TEXT,
    title TEXT,
    section TEXT,
    body TEXT
  )
`);

// --- 6. GENERIC DOCUMENTS (Manuals, Reports, Benchbook, etc.) ---
db.run(`
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset TEXT,
    filename TEXT,
    title TEXT,
    content TEXT
  )
`);

console.log(`Initialized database at ${DB_PATH}`);

// --- HELPER TO INSERT DATA ---

const insertCourt = db.prepare(`
  INSERT INTO courts (name, locality, type, district, clerk, phone, fax, email, address, city, state, zip, hours, homepage, judges)
  VALUES ($name, $locality, $type, $district, $clerk, $phone, $fax, $email, $address, $city, $state, $zip, $hours, $homepage, $judges)
`);

const insertConstitution = db.prepare(`
  INSERT INTO constitution (article_id, article, article_name, section_name, section_title, section_text, section_count, last_update)
  VALUES ($ArticleId, $Article, $ArticleName, $SectionName, $SectionTitle, $SectionText, $SectionCount, $LastUpdate)
`);

const insertVirginiaCode = db.prepare(`
  INSERT INTO virginia_code (title_num, title_name, subtitle_num, subtitle_name, part_num, part_name, chapter_num, chapter_name, article_num, article_name, subpart_num, subpart_name, section, title, body)
  VALUES ($TitleNum, $TitleName, $SubTitleNum, $SubTitleName, $PartNum, $PartName, $ChapterNum, $ChapterName, $ArticleNum, $ArticleName, $SubPartNum, $SubPartName, $Section, $Title, $Body)
`);

const insertPopularName = db.prepare(`
  INSERT INTO popular_names (name, title_num, section, body)
  VALUES ($Name, $TitleNum, $Section, $Body)
`);

const insertAuthority = db.prepare(`
  INSERT INTO authorities (name, short_name, codified, title, section, body)
  VALUES ($Name, $ShortName, $Codified, $Title, $Section, $Body)
`);

const insertDocument = db.prepare(`
  INSERT INTO documents (dataset, filename, title, content)
  VALUES ($dataset, $filename, $title, $content)
`);

// --- DATA IMPORT ---

// 1. Courts
const courtsJsonFile = Bun.file(join(DATA_DIR, "courts/courts.json"));
if (await courtsJsonFile.exists()) {
  console.log("Importing Courts...");
  const courts = await courtsJsonFile.json();
  db.transaction(() => {
    for (const c of courts) {
      insertCourt.run({
        $name: c.name,
        $locality: c.locality,
        $type: c.type,
        $district: c.district,
        $clerk: c.clerk,
        $phone: c.phone,
        $fax: c.fax,
        $email: c.email,
        $address: c.address,
        $city: c.city,
        $state: c.state,
        $zip: c.zip,
        $hours: c.hours,
        $homepage: c.homepage,
        $judges: JSON.stringify(c.judges),
      });
    }
  })();
}

// 2. Constitution
const constitutionJsonFile = Bun.file(join(DATA_DIR, "constitutional_law/Constitution.json"));
if (await constitutionJsonFile.exists()) {
  console.log("Importing Constitution...");
  const constitution = await constitutionJsonFile.json();
  db.transaction(() => {
    for (const section of constitution) {
      insertConstitution.run({
        $ArticleId: section.ArticleId,
        $Article: section.Article,
        $ArticleName: section.ArticleName,
        $SectionName: section.SectionName,
        $SectionTitle: section.SectionTitle,
        $SectionText: section.SectionText,
        $SectionCount: section.SectionCount,
        $LastUpdate: section.LastUpdate,
      });
    }
  })();
}

// 3. Virginia Code & Popular Names
const virginiaCodeDir = join(DATA_DIR, "virginia_code");
const codeFiles = Array.from(new Glob("CoVTitle_*.json").scanSync(virginiaCodeDir));
for (const filename of codeFiles) {
  console.log(`Importing ${filename}...`);
  const codeData = await Bun.file(join(virginiaCodeDir, filename)).json();
  db.transaction(() => {
    for (const section of codeData) {
      insertVirginiaCode.run({
        $TitleNum: section.TitleNum?.toString(),
        $TitleName: section.TitleName,
        $SubTitleNum: section.SubTitleNum?.toString(),
        $SubTitleName: section.SubTitleName,
        $PartNum: section.PartNum?.toString(),
        $PartName: section.PartName,
        $ChapterNum: section.ChapterNum?.toString(),
        $ChapterName: section.ChapterName,
        $ArticleNum: section.ArticleNum?.toString(),
        $ArticleName: section.ArticleName,
        $SubPartNum: section.SubPartNum?.toString(),
        $SubPartName: section.SubPartName,
        $Section: section.Section,
        $Title: section.Title,
        $Body: section.Body,
      });
    }
  })();
}

const popularNamesFile = Bun.file(join(virginiaCodeDir, "PopularNames.json"));
if (await popularNamesFile.exists()) {
  console.log("Importing Popular Names...");
  const popularNames = await popularNamesFile.json();
  db.transaction(() => {
    for (const pn of popularNames) {
      insertPopularName.run({
        $Name: pn.Name,
        $TitleNum: pn.TitleNum?.toString(),
        $Section: pn.Section,
        $Body: pn.Body,
      });
    }
  })();
}

// 4. Case Law Authorities
const authoritiesDir = join(DATA_DIR, "case_law_authorities");
const authFiles = Array.from(new Glob("*.json").scanSync(authoritiesDir));
for (const filename of authFiles) {
  console.log(`Importing Case Law Authority: ${filename}...`);
  const authData = await Bun.file(join(authoritiesDir, filename)).json();
  db.transaction(() => {
    for (const entry of authData) {
      insertAuthority.run({
        $Name: entry.Name,
        $ShortName: entry.ShortName,
        $Codified: entry.Codified,
        $Title: entry.Title,
        $Section: entry.Section,
        $Body: entry.Body,
      });
    }
  })();
}

// 5. Generic Documents (Manuals, Reports, Benchbook, stats, etc.)
const datasetsToScan = [
  "annual_reports",
  "appellate_caseload",
  "benchbook",
  "cac_manual",
  "caseload_stats",
  "gdman",
  "jdrman",
  "other",
  "vcc"
];

for (const dataset of datasetsToScan) {
  const dir = join(DATA_DIR, dataset);
  const jsonFiles = Array.from(new Glob("**/*.json").scanSync({ cwd: dir, absolute: true }));
  
  for (const jsonPath of jsonFiles) {
    const filename = basename(jsonPath);
    console.log(`Importing Document: ${dataset}/${filename}...`);
    const data = await Bun.file(jsonPath).json();
    let content = "";
    if (typeof data === "object" && data !== null) {
      if ("text" in data) {
          content = data.text;
      } else {
          content = JSON.stringify(data);
      }
    } else {
      content = String(data);
    }
    insertDocument.run({
      $dataset: dataset,
      $filename: filename,
      $title: filename,
      $content: content,
    });
  }
}

console.log("Import complete.");
console.log("Building indexes...");

db.run("CREATE INDEX idx_virginia_code_section ON virginia_code(section)");
db.run("CREATE INDEX idx_courts_name ON courts(name)");
db.run("CREATE INDEX idx_documents_dataset ON documents(dataset)");

console.log("Indexes built.");
db.close();
console.log("Done.");
