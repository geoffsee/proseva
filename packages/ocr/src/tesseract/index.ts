import * as mupdf from "mupdf";
import { createWorker, type Worker } from "tesseract.js";
import fs from "fs";

const DPI = 300;
const SCALE = DPI / 72;

// --- PDF rendering via mupdf ---
function renderPagesToPng(path: string): Uint8Array[] {
  const bytes = fs.readFileSync(path);
  const doc = mupdf.Document.openDocument(bytes, "application/pdf");
  const pngs: Uint8Array[] = [];

  for (let i = 0; i < doc.countPages(); i++) {
    const page = doc.loadPage(i);
    const pix = page.toPixmap(
      mupdf.Matrix.scale(SCALE, SCALE),
      mupdf.ColorSpace.DeviceRGB,
      false
    );
    pngs.push(pix.asPNG());
    pix.destroy();
    page.destroy();
  }
  doc.destroy();
  return pngs;
}

// --- Binarize: convert to grayscale + Otsu threshold → black text on white ---
function binarize(png: Uint8Array): Uint8Array {
  // Decode PNG to raw pixels via mupdf Pixmap
  const pix = new mupdf.Image(new mupdf.Buffer(png)).toPixmap();
  const w = pix.getWidth();
  const h = pix.getHeight();
  const channels = pix.getNumberOfComponents();
  const raw = pix.getPixels();

  // Convert to grayscale
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const off = i * channels;
    gray[i] = channels >= 3
      ? Math.round(0.299 * raw[off] + 0.587 * raw[off + 1] + 0.114 * raw[off + 2])
      : raw[off];
  }

  // Otsu threshold
  const hist = new Int32Array(256);
  for (const v of gray) hist[v]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0, wB = 0, maxVar = 0, threshold = 128;
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

  // Apply threshold and write back as grayscale PNG
  // Create a new RGB pixmap with binarized values
  const outPix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, w, h], false);
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

async function ocrFile(path: string, preprocess: boolean) {
  const isPdf = path.toLowerCase().endsWith(".pdf");
  const worker = await createWorker("eng");

  if (isPdf) {
    const pages = renderPagesToPng(path);
    console.log(`--- ${path} (${pages.length} page${pages.length > 1 ? "s" : ""}) ---`);
    for (let i = 0; i < pages.length; i++) {
      console.log(`\n=== Page ${i + 1} ===`);
      const input = preprocess ? binarize(pages[i]) : pages[i];
      if (preprocess) {
        fs.writeFileSync(`test-data/binarized-p${i + 1}.png`, input);
      }
      const { data: { text } } = await worker.recognize(input);
      console.log(text);
    }
  } else {
    console.log(`--- ${path} ---`);
    const bytes = fs.readFileSync(path);
    const input = preprocess ? binarize(new Uint8Array(bytes)) : new Uint8Array(bytes);
    const { data: { text } } = await worker.recognize(input);
    console.log(text);
  }

  await worker.terminate();
}

// CLI
const args = process.argv.slice(2);
const preprocess = args.includes("--binarize");
const files = args.filter(a => !a.startsWith("--"));

if (files.length === 0) {
  const glob = new Bun.Glob("../test-data/*.pdf");
  for (const f of glob.scanSync({ cwd: import.meta.dir })) {
    files.push(`${import.meta.dir}/${f}`);
  }
}

if (files.length === 0) {
  console.error("Usage: bun run tesseract/index.ts [--binarize] <file ...>");
  process.exit(1);
}

console.log(preprocess ? "Mode: binarized" : "Mode: raw");
for (const f of files) {
  await ocrFile(f, preprocess);
}
