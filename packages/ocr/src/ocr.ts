import type * as MupdfTypes from "mupdf";
import { createWorker } from "tesseract.js";
import fs from "fs";
import path from "path";

// Lazy-load mupdf so the server can start even when the WASM package is
// not resolvable (e.g. VLM-only OCR mode).  The module is cached after
// the first successful import.
let _mupdf: typeof MupdfTypes | undefined;
function mupdf(): typeof MupdfTypes {
  if (!_mupdf) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _mupdf = require("mupdf") as typeof MupdfTypes;
  }
  return _mupdf;
}

// ── Types ──────────────────────────────────────────────
export interface OcrPage {
  page: number;
  text: string;
}

export interface OcrResult {
  engine: string;
  pages: OcrPage[];
}

type Engine = "apple" | "tesseract" | "docling";

// ── Apple Vision backend ───────────────────────────────
const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const SWIFT_SRC = path.join(SCRIPT_DIR, "apple/apple-ocr.swift");
const SWIFT_BIN = path.join(SCRIPT_DIR, "apple/apple-ocr");

async function ensureAppleBinary(): Promise<boolean> {
  if (fs.existsSync(SWIFT_BIN)) return true;
  if (process.platform !== "darwin" || !fs.existsSync(SWIFT_SRC)) {
    return false;
  }

  console.error("Compiling apple-ocr...");
  const proc = Bun.spawn(
    [
      "swiftc",
      "-O",
      "-framework",
      "Vision",
      "-framework",
      "PDFKit",
      "-framework",
      "Quartz",
      SWIFT_SRC,
      "-o",
      SWIFT_BIN,
    ],
    { stdout: "inherit", stderr: "inherit" }
  );
  const code = await proc.exited;
  return code === 0;
}

function parseAppleOutput(stdout: string): OcrPage[] {
  const pages: OcrPage[] = [];
  const parts = stdout.split(/\n=== Page (\d+) ===\n/);
  // parts: [preamble, "1", text1, "2", text2, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const pageNum = parseInt(parts[i], 10);
    const text = (parts[i + 1] ?? "").trimEnd();
    pages.push({ page: pageNum, text });
  }
  return pages;
}

async function ocrApple(filePath: string): Promise<OcrResult> {
  const ok = await ensureAppleBinary();
  if (!ok) throw new Error("Apple Vision binary not available");

  const absPath = path.resolve(filePath);
  const proc = Bun.spawn([SWIFT_BIN, absPath], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;

  if (code !== 0) throw new Error(`apple-ocr exited ${code}: ${stderr}`);

  return { engine: "apple-vision", pages: parseAppleOutput(stdout) };
}

// ── Tesseract + mupdf binarization backend ─────────────
function renderPagesToPng(filePath: string): Uint8Array[] {
  const m = mupdf();
  const bytes = fs.readFileSync(filePath);
  const doc = m.Document.openDocument(bytes, "application/pdf");
  const pngs: Uint8Array[] = [];
  const scale = 300 / 72;

  for (let i = 0; i < doc.countPages(); i++) {
    const page = doc.loadPage(i);
    const pix = page.toPixmap(
      m.Matrix.scale(scale, scale),
      m.ColorSpace.DeviceRGB,
      false
    );
    pngs.push(pix.asPNG());
    pix.destroy();
    page.destroy();
  }
  doc.destroy();
  return pngs;
}

function binarize(png: Uint8Array): Uint8Array {
  const m = mupdf();
  const pix = new m.Image(new m.Buffer(png)).toPixmap();
  const w = pix.getWidth();
  const h = pix.getHeight();
  const channels = pix.getNumberOfComponents();
  const raw = pix.getPixels();

  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const off = i * channels;
    gray[i] =
      channels >= 3
        ? Math.round(0.299 * raw[off] + 0.587 * raw[off + 1] + 0.114 * raw[off + 2])
        : raw[off];
  }

  // Otsu threshold
  const hist = new Int32Array(256);
  for (const v of gray) hist[v]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0,
    wB = 0,
    maxVar = 0,
    threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }

  const outPix = new m.Pixmap(m.ColorSpace.DeviceRGB, [0, 0, w, h], false);
  const outData = outPix.getPixels();
  for (let i = 0; i < w * h; i++) {
    const val = gray[i] < threshold ? 0 : 255;
    outData[i * 3] = val;
    outData[i * 3 + 1] = val;
    outData[i * 3 + 2] = val;
  }
  const result = outPix.asPNG();
  outPix.destroy();
  pix.destroy();
  return result;
}

async function ocrTesseract(filePath: string): Promise<OcrResult> {
  const pngs = renderPagesToPng(filePath);
  const worker = await createWorker("eng");
  const pages: OcrPage[] = [];

  for (let i = 0; i < pngs.length; i++) {
    const input = Buffer.from(binarize(pngs[i]));
    const {
      data: { text },
    } = await worker.recognize(input);
    pages.push({ page: i + 1, text: text.trimEnd() });
  }

  await worker.terminate();
  return { engine: "tesseract+binarize", pages };
}

// ── Engine selection ───────────────────────────────────
async function detectEngine(): Promise<Engine> {
  console.warn("[ingest] Detecting OCR engine: auto-detecting...");
  console.warn(`[ingest] Using engine for platform: ${process.platform}`)
  if (process.platform === "darwin") {
    const ok = await ensureAppleBinary();
    if (ok) return "apple";
  }
  return "tesseract";
}

// ── Public API ─────────────────────────────────────────
export async function ocrPdf(
  filePath: string,
  opts?: { engine?: Engine }
): Promise<OcrResult> {
  const engine = opts?.engine ?? (await detectEngine());

  console.warn(`OCR engine: ${engine}`);

  switch (engine) {
    case "apple":
      return ocrApple(filePath);
    case "tesseract":
      return ocrTesseract(filePath);
    case "docling":
      throw new Error(
        "Docling engine: use transformers/index.ts directly (--split --binarize)"
      );
    default:
      throw new Error(`Unknown engine: ${engine}`);
  }
}

// ── CLI ────────────────────────────────────────────────
if (import.meta.main) {
  const args = process.argv.slice(2);
  let engine: Engine | undefined;
  const files: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--engine" && args[i + 1]) {
      engine = args[++i] as Engine;
    } else if (!args[i].startsWith("--")) {
      files.push(args[i]);
    }
  }

  if (files.length === 0) {
    const glob = new Bun.Glob("test-data/*.pdf");
    for (const f of glob.scanSync({ cwd: SCRIPT_DIR })) {
      files.push(path.join(SCRIPT_DIR, f));
    }
  }

  if (files.length === 0) {
    console.error("Usage: bun run ocr.ts [--engine apple|tesseract|docling] <file ...>");
    process.exit(1);
  }

  for (const file of files) {
    const result = await ocrPdf(file, engine ? { engine } : undefined);
    console.log(`--- ${file} [${result.engine}] ---`);
    for (const p of result.pages) {
      if (result.pages.length > 1) console.log(`\n=== Page ${p.page} ===`);
      console.log(p.text);
    }
  }
}
