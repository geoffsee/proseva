import { basename, relative, join } from "path";
import { writeFile, mkdir, stat, mkdtemp, rm } from "fs/promises";
import { createHash } from "crypto";
import { tmpdir } from "os";
import OpenAI from "openai";
import { getConfig } from "./config";
import { ocrPdf } from "../../ocr/src/ocr";
import { db, type DocumentRecord } from "./db";
import { BlobStore, getBlobStore } from "./blob-store";

export interface DocumentEntry {
  id: string;
  filename: string;
  path: string;
  category: string;
  title: string;
  pageCount: number;
  textFile: string;
  dates: string[];
  fileSize: number;
  caseId?: string;
}

export function extractDates(text: string): string[] {
  const patterns = [
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    /\b\d{1,2}-\d{1,2}-\d{2,4}\b/g,
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
    /\b\d{4}-\d{2}-\d{2}\b/g,
  ];
  const dates = new Set<string>();
  for (const p of patterns) {
    for (const m of text.matchAll(p)) {
      dates.add(m[0]);
    }
  }
  return [...dates];
}

export function deriveCategory(filePath: string, baseDir: string): string {
  const rel = relative(baseDir, filePath);
  return rel.split("/")[0];
}

export function cleanTitle(filename: string): string {
  return basename(filename, ".pdf")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractTextLocal(
  buffer: Buffer,
): Promise<{ text: string; pageCount: number }> {
  console.log("[ingest] Attempting local OCR extraction");
  const tmpDir = await mkdtemp(join(tmpdir(), "ocr-"));
  const tmpFile = join(tmpDir, "input.pdf");
  try {
    await writeFile(tmpFile, buffer);
    const result = await ocrPdf(tmpFile);
    const text = result.pages.map((p) => p.text).join("\n\n");
    console.log(`[ingest] Local OCR complete: ${result.pages.length} pages, ${text.length} chars`);
    return { text, pageCount: result.pages.length };
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function extractTextVlm(
  buffer: Buffer,
  openai: OpenAI,
): Promise<{ text: string; pageCount: number }> {
  const model = getConfig("VLM_MODEL") || "gpt-4.1";
  console.log(`[ingest] VLM extraction using model=${model}, buffer=${(buffer.byteLength / 1024).toFixed(0)}KB`);
  const base64 = buffer.toString("base64");
  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "file",
            file: {
              filename: "document.pdf",
              file_data: `data:application/pdf;base64,${base64}`,
            },
          },
          {
            type: "text",
            text: "Extract ALL text from this PDF verbatim. Return ONLY the extracted text, nothing else. At the very end, on a new line, write PAGE_COUNT:<number> with the number of pages in the document.",
          },
        ],
      },
    ],
  });

  const raw = response.choices[0].message.content ?? "";
  const pageCountMatch = raw.match(/PAGE_COUNT:(\d+)\s*$/);
  const pageCount = pageCountMatch ? parseInt(pageCountMatch[1], 10) : 1;
  const text = raw.replace(/PAGE_COUNT:\d+\s*$/, "").trim();

  console.log(`[ingest] VLM extraction complete: ${pageCount} pages, ${text.length} chars`);
  return { text, pageCount };
}

export async function extractTextFromPdf(
  buffer: Buffer,
  openai?: OpenAI | null,
): Promise<{ text: string; pageCount: number }> {
  const ocrMode = getConfig("OCR_MODE"); // "local", "vlm", or unset (auto)
  console.log(`[ingest] extractTextFromPdf: mode=${ocrMode || "auto"}, size=${(buffer.byteLength / 1024).toFixed(0)}KB`);

  if (ocrMode === "vlm") {
    if (!openai) throw new Error("OCR_MODE=vlm requires OpenAI client");
    return extractTextVlm(buffer, openai);
  }

  if (ocrMode === "local") {
    return extractTextLocal(buffer);
  }

  // Auto: try local OCR first, fall back to VLM if available
  try {
    return await extractTextLocal(buffer);
  } catch (err) {
    console.log(`[ingest] Local OCR failed, falling back to VLM: ${err instanceof Error ? err.message : err}`);
    if (!openai) throw new Error("Local OCR failed and no OpenAI client configured");
    return extractTextVlm(buffer, openai);
  }
}

export function generateId(relativePath: string): string {
  return createHash("sha256").update(relativePath).digest("hex").slice(0, 12);
}

export async function ingestPdfBuffer(
  buffer: Buffer,
  filename: string,
  category: string,
  baseDir: string,
  openai?: OpenAI | null,
): Promise<{ entry: DocumentEntry; text: string }> {
  const categoryDir = join(baseDir, category);
  await mkdir(categoryDir, { recursive: true });

  const destPath = join(categoryDir, filename);
  await writeFile(destPath, buffer);

  const fileStat = await stat(destPath);
  const { text, pageCount } = await extractTextFromPdf(buffer, openai);

  const relPath = relative(baseDir, destPath);
  const id = generateId(relPath);

  const textsDir = join(baseDir, "texts");
  await mkdir(textsDir, { recursive: true });
  await writeFile(join(textsDir, `${id}.txt`), text);

  return {
    entry: {
      id,
      filename,
      path: relPath,
      category,
      title: cleanTitle(filename),
      pageCount,
      textFile: `texts/${id}.txt`,
      dates: extractDates(text),
      fileSize: fileStat.size,
      caseId: "",
    },
    text,
  };
}

export async function ingestPdfToBlob(
  buffer: Buffer,
  filename: string,
  category: string,
  openai?: OpenAI | null,
): Promise<{ record: DocumentRecord }> {
  console.log(`[ingest] Starting blob ingest: ${filename} (${(buffer.byteLength / 1024).toFixed(0)}KB), category=${category}`);
  const { text, pageCount } = await extractTextFromPdf(buffer, openai);

  const bytes = new Uint8Array(buffer);
  const id = crypto.randomUUID();
  const hash = BlobStore.computeHash(bytes);

  console.log(`[ingest] Storing blob id=${id}, hash=${hash.slice(0, 12)}...`);
  await getBlobStore().store(id, bytes);

  db.fileMetadata.set(id, {
    id,
    filename,
    mimeType: "application/pdf",
    size: bytes.byteLength,
    hash,
    createdAt: new Date().toISOString(),
    sourceType: "document",
  });

  const record: DocumentRecord = {
    id,
    filename,
    category,
    title: cleanTitle(filename),
    pageCount,
    dates: extractDates(text),
    fileSize: bytes.byteLength,
    hash,
    caseId: "",
    extractedText: text,
    createdAt: new Date().toISOString(),
  };

  db.documents.set(id, record);

  console.log(`[ingest] Document record created: id=${id}, title="${record.title}", pages=${pageCount}, dates=${record.dates.length}`);
  return { record };
}
