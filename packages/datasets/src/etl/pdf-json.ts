import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "fs";

export async function extractTextFromPdf(path: string): Promise<string> {
  const data = new Uint8Array(fs.readFileSync(path));
  const loadingTask = pdfjs.getDocument({
    data,
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const strings = textContent.items.map((item: any) => item.str);
    fullText += strings.join("\n") + "\n";
  }
  return fullText;
}

export async function pdfToJson(pdfPath: string): Promise<{ text: string }> {
  const text = await extractTextFromPdf(pdfPath);
  return { text };
}
