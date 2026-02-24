import {
  AutoProcessor,
  AutoModelForVision2Seq,
  RawImage,
  TextStreamer,
} from "@huggingface/transformers";
import { renderPdfPagesToPng } from "../pdfjs";

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

    const pages = await renderPdfPagesToPng(file, { dpi: 300, binarize: doBinarize });
    console.log(`--- ${file} (${pages.length} pages) ---`);

    for (let p = 0; p < pages.length; p++) {
      console.log(`\n=== Page ${p + 1} ===`);

      const blob = new Blob([pages[p]], { type: "image/png" });
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
