import { createWorker } from "tesseract.js";
import fs from "fs";
import { binarizeImageToPng, renderPdfPagesToPng } from "../pdfjs";

async function ocrFile(path: string, preprocess: boolean) {
  const isPdf = path.toLowerCase().endsWith(".pdf");
  const worker = await createWorker("eng");

  if (isPdf) {
    const pages = await renderPdfPagesToPng(path, {
      dpi: 300,
      binarize: preprocess,
    });
    console.log(
      `--- ${path} (${pages.length} page${pages.length > 1 ? "s" : ""}) ---`,
    );
    for (let i = 0; i < pages.length; i++) {
      console.log(`\n=== Page ${i + 1} ===`);
      const {
        data: { text },
      } = await worker.recognize(pages[i]);
      console.log(text);
    }
  } else {
    console.log(`--- ${path} ---`);
    const bytes = fs.readFileSync(path);
    const input = preprocess
      ? await binarizeImageToPng(new Uint8Array(bytes))
      : new Uint8Array(bytes);
    const {
      data: { text },
    } = await worker.recognize(input);
    console.log(text);
  }

  await worker.terminate();
}

// CLI
const args = process.argv.slice(2);
const preprocess = args.includes("--binarize");
const files = args.filter((a) => !a.startsWith("--"));

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
