import * as mupdf from "mupdf";
import {
  AutoProcessor,
  AutoModelForVision2Seq,
  RawImage,
  TextStreamer,
} from "@huggingface/transformers";
import fs from "fs";

const DPI = 300;
const SCALE = DPI / 72;

// --- PDF rendering via mupdf ---
function renderPages(path: string): { width: number; height: number; png: Uint8Array }[] {
  const bytes = fs.readFileSync(path);
  const doc = mupdf.Document.openDocument(bytes, "application/pdf");
  const pages: { width: number; height: number; png: Uint8Array }[] = [];

  for (let i = 0; i < doc.countPages(); i++) {
    const page = doc.loadPage(i);
    const pix = page.toPixmap(
      mupdf.Matrix.scale(SCALE, SCALE),
      mupdf.ColorSpace.DeviceRGB,
      false
    );
    pages.push({
      width: pix.getWidth(),
      height: pix.getHeight(),
      png: pix.asPNG(),
    });
    pix.destroy();
    page.destroy();
  }
  doc.destroy();
  return pages;
}

// --- Otsu binarization via mupdf ---
function binarize(png: Uint8Array): Uint8Array {
  const pix = new mupdf.Image(new mupdf.Buffer(png)).toPixmap();
  const w = pix.getWidth();
  const h = pix.getHeight();
  const channels = pix.getNumberOfComponents();
  const raw = pix.getPixels();

  // Convert to grayscale
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

  // Apply threshold → RGB PNG
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

// --- Main ---
async function main() {
  const args = process.argv.slice(2);
  const imageSplit = args.includes("--split");
  const doBinarize = args.includes("--binarize");
  const files = args.filter((a) => !a.startsWith("--"));

  if (files.length === 0) {
    const glob = new Bun.Glob("../test-data/*.pdf");
    for (const f of glob.scanSync({ cwd: import.meta.dir })) {
      files.push(`${import.meta.dir}/${f}`);
    }
  }

  if (files.length === 0) {
    console.error("Usage: bun run transformers/index.ts [--split] [--binarize] <file ...>");
    process.exit(1);
  }

  console.log("Loading granite-docling-258M...");
  const model_id = "onnx-community/granite-docling-258M-ONNX";
  const processor = await AutoProcessor.from_pretrained(model_id);
  const model = await AutoModelForVision2Seq.from_pretrained(model_id, {
    dtype: "fp32",
  });
  console.log(`Model loaded. split=${imageSplit} binarize=${doBinarize}\n`);

  const messages = [
    {
      role: "user",
      content: [
        { type: "image" },
        { type: "text", text: "Convert this page to docling." },
      ],
    },
  ];

  const prompt = processor.apply_chat_template(messages, {
    add_generation_prompt: true,
  });

  for (const file of files) {
    const isPdf = file.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      console.log(`Skipping non-PDF: ${file}`);
      continue;
    }

    const pages = renderPages(file);
    console.log(`--- ${file} (${pages.length} pages) ---`);

    for (let p = 0; p < pages.length; p++) {
      console.log(`\n=== Page ${p + 1} ===`);

      const pngData = doBinarize ? binarize(pages[p].png) : pages[p].png;
      const blob = new Blob([pngData], { type: "image/png" });
      const image = await RawImage.fromBlob(blob);

      const inputs = await processor(prompt, [image], {
        do_image_splitting: imageSplit,
      });

      console.log("Generating...");
      const streamer = new TextStreamer(processor.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: false,
      });

      const generated_ids = await model.generate({
        ...inputs,
        max_new_tokens: 8192,
        repetition_penalty: 1.2,
        streamer,
      });

      const generated_texts = processor.batch_decode(
        generated_ids.slice(null, [inputs.input_ids.dims.at(-1), null]),
        { skip_special_tokens: true }
      );

      console.log("\n--- DocTags output ---");
      console.log(generated_texts[0]);
    }
  }
}

main();
