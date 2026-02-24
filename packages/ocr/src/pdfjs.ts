import fs from "fs";

type CanvasModule = {
  createCanvas: (w: number, h: number) => any;
  loadImage: (data: Uint8Array | Buffer) => Promise<any>;
};

type PdfJsModule = {
  getDocument: (opts: any) => { promise: Promise<any> };
};

async function canvasMod(): Promise<CanvasModule> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (await import("@napi-rs/canvas")) as unknown as CanvasModule;
}

async function pdfjsMod(): Promise<PdfJsModule> {
  // Use legacy build for Node/Bun environments.
  return (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfJsModule;
}

function otsuThreshold(gray: Uint8Array): number {
  const hist = new Int32Array(256);
  for (const v of gray) hist[v]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 128;

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

  return threshold;
}

function binarizeCanvas(ctx: any, width: number, height: number): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data: Uint8ClampedArray = imageData.data;

  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const off = i * 4;
    const r = data[off] ?? 0;
    const g = data[off + 1] ?? 0;
    const b = data[off + 2] ?? 0;
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  const threshold = otsuThreshold(gray);
  for (let i = 0; i < width * height; i++) {
    const val = gray[i] < threshold ? 0 : 255;
    const off = i * 4;
    data[off] = val;
    data[off + 1] = val;
    data[off + 2] = val;
    // Preserve alpha channel (data[off + 3])
  }

  ctx.putImageData(imageData, 0, 0);
}

export async function renderPdfPagesToPng(
  filePath: string,
  opts?: { dpi?: number; binarize?: boolean }
): Promise<Uint8Array[]> {
  const dpi = opts?.dpi ?? 300;
  const scale = dpi / 72;

  const bytes = fs.readFileSync(filePath);
  const pdfjs = await pdfjsMod();

  const loadingTask = pdfjs.getDocument({
    data: bytes,
    disableWorker: true,
    // Try to reduce surprise resource access when parsing PDFs.
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;

  const { createCanvas } = await canvasMod();
  const pngs: Uint8Array[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");

    await page.render({ canvasContext: ctx, viewport }).promise;
    if (opts?.binarize) {
      binarizeCanvas(ctx, canvas.width, canvas.height);
    }

    const buf: Buffer = canvas.toBuffer("image/png");
    pngs.push(new Uint8Array(buf));
  }

  return pngs;
}

export async function binarizeImageToPng(
  imageBytes: Uint8Array
): Promise<Uint8Array> {
  const { createCanvas, loadImage } = await canvasMod();
  const img = await loadImage(imageBytes);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  binarizeCanvas(ctx, canvas.width, canvas.height);
  const buf: Buffer = canvas.toBuffer("image/png");
  return new Uint8Array(buf);
}

