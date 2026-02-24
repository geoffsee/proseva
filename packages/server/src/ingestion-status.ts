import { join, basename } from "path";
import { readFile, readdir, stat } from "fs/promises";
import OpenAI from "openai";
import { db } from "./db";
import { getConfig } from "./config";
import { ingestPdfToBlob, deriveCategory } from "./ingest";
import { autoPopulateFromDocument } from "./ingestion-agent";

export type IngestionStatus = {
  active: boolean;
  directory: string;
  running: boolean;
  lastRunStarted: string | null;
  lastRunFinished: string | null;
  added: number;
  skipped: number;
  errors: number;
};

export const ingestionStatus: IngestionStatus = {
  active: Boolean(getConfig("AUTO_INGEST_DIR")),
  directory: getConfig("AUTO_INGEST_DIR") ?? "",
  running: false,
  lastRunStarted: null,
  lastRunFinished: null,
  added: 0,
  skipped: 0,
  errors: 0,
};

export async function listPdfFilesRecursive(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listPdfFilesRecursive(full)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
      files.push(full);
    }
  }
  return files;
}

export async function maybeAutoIngestFromEnv(): Promise<void> {
  const sourceDir = getConfig("AUTO_INGEST_DIR");
  if (!sourceDir) return;

  ingestionStatus.active = true;
  ingestionStatus.directory = sourceDir;
  ingestionStatus.running = true;
  ingestionStatus.added = 0;
  ingestionStatus.skipped = 0;
  ingestionStatus.errors = 0;
  ingestionStatus.lastRunStarted = new Date().toISOString();

  const existingSignatures = new Set(
    [...db.documents.values()].map((e) => `${e.filename}|${e.fileSize}`),
  );

  let openai: OpenAI;
  try {
    openai = new OpenAI({
      apiKey: getConfig("OPENAI_API_KEY"),
      baseURL: getConfig("OPENAI_ENDPOINT"),
    });
  } catch (err) {
    console.error("[auto-ingest] OpenAI client init failed:", err);
    ingestionStatus.running = false;
    ingestionStatus.lastRunFinished = new Date().toISOString();
    return;
  }
  let pdfFiles: string[];
  try {
    pdfFiles = await listPdfFilesRecursive(sourceDir);
  } catch (err) {
    console.error(`[auto-ingest] Failed to read directory ${sourceDir}:`, err);
    ingestionStatus.running = false;
    ingestionStatus.lastRunFinished = new Date().toISOString();
    return;
  }

  let added = 0;

  for (const filePath of pdfFiles) {
    const fileStats = await stat(filePath);
    const filename = basename(filePath);
    const signature = `${filename}|${fileStats.size}`;
    if (existingSignatures.has(signature)) {
      ingestionStatus.skipped += 1;
      continue;
    }

    const derivedCategory = deriveCategory(filePath, sourceDir);
    const category =
      derivedCategory && derivedCategory !== filename
        ? derivedCategory
        : "_bulk_import";

    const buffer = await readFile(filePath);
    const { record } = await ingestPdfToBlob(
      buffer,
      filename,
      category,
      openai,
    );

    try {
      const { caseId } = await autoPopulateFromDocument({
        openai,
        entry: record,
        text: record.extractedText,
      });
      if (caseId) {
        record.caseId = caseId;
        db.documents.set(record.id, record);
      }
    } catch (err) {
      console.error("Structured auto-ingest failed (auto ingester)", err);
      ingestionStatus.errors += 1;
    }

    existingSignatures.add(signature);
    added += 1;
    ingestionStatus.added += 1;
  }

  if (added > 0) {
    db.persist();
    console.log(`[auto-ingest] Added ${added} documents from ${sourceDir}`);
  } else {
    console.log("[auto-ingest] No new documents found in source directory");
  }

  ingestionStatus.running = false;
  ingestionStatus.lastRunFinished = new Date().toISOString();
}
