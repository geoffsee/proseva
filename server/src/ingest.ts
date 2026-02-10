import { basename, relative, join } from "path";
import { readFile, writeFile, mkdir, stat } from "fs/promises";
import { createHash } from "crypto";
import OpenAI from "openai";

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

export async function extractTextFromPdf(
  buffer: Buffer,
  openai: OpenAI,
): Promise<{ text: string; pageCount: number }> {
  const base64 = buffer.toString("base64");
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
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

  return { text, pageCount };
}

export function generateId(relativePath: string): string {
  return createHash("sha256").update(relativePath).digest("hex").slice(0, 12);
}

export async function ingestPdfBuffer(
  buffer: Buffer,
  filename: string,
  category: string,
  baseDir: string,
  openai: OpenAI,
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
