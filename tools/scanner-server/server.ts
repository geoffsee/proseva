#!/usr/bin/env bun
/**
 * Fake eSCL scanner server that watches a directory for files.
 *
 * Drop a PDF (or any file) into the watch directory and the server will:
 *   1. Detect the new file
 *   2. Set ADF state to "loaded" (triggers ProSeVA scanner poll)
 *   3. Serve that file as the scanned document
 *   4. Move it to processed/ after delivery
 *
 * Environment variables:
 *   PORT       - HTTP port (default: 8085)
 *   WATCH_DIR  - Directory to watch for incoming files (default: /watch)
 *   POLL_MS    - How often to check for new files in ms (default: 500)
 *   DELAY_MS   - Simulated scan processing delay in ms (default: 1500)
 */

import { readdir, rename, mkdir, stat, readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { existsSync } from "node:fs";

const PORT = Number(process.env.PORT ?? 8085);
const WATCH_DIR = process.env.WATCH_DIR ?? "/watch";
const PROCESSED_DIR = join(WATCH_DIR, "processed");
const POLL_MS = Number(process.env.POLL_MS ?? 500);
const DELAY_MS = Number(process.env.DELAY_MS ?? 1500);

// ─── State ───────────────────────────────────────────────────────────

let adfState: "ScannerAdfLoaded" | "ScannerAdfEmpty" = "ScannerAdfEmpty";
let scannerState: "Idle" | "Processing" = "Idle";
let nextJobId = 1;

interface Job {
  id: string;
  state: "Processing" | "Completed" | "Canceled";
  documentReady: boolean;
  file: QueuedFile | null;
}

interface QueuedFile {
  path: string;
  name: string;
  data: Uint8Array;
  contentType: string;
}

const jobs = new Map<string, Job>();
const fileQueue: QueuedFile[] = [];
const knownFiles = new Set<string>();

// ─── Content type mapping ────────────────────────────────────────────

function contentTypeFromExt(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  switch (ext) {
    case ".pdf": return "application/pdf";
    case ".jpg": case ".jpeg": return "image/jpeg";
    case ".png": return "image/png";
    case ".tiff": case ".tif": return "image/tiff";
    default: return "application/pdf";
  }
}

// ─── File watcher ────────────────────────────────────────────────────

async function ensureDirs() {
  await mkdir(WATCH_DIR, { recursive: true });
  await mkdir(PROCESSED_DIR, { recursive: true });
}

async function scanWatchDir() {
  try {
    const entries = await readdir(WATCH_DIR);
    for (const entry of entries) {
      if (entry === "processed" || entry.startsWith(".")) continue;

      const filePath = join(WATCH_DIR, entry);

      // Skip if already known
      if (knownFiles.has(filePath)) continue;

      // Skip directories
      const info = await stat(filePath).catch(() => null);
      if (!info || info.isDirectory()) continue;

      // Wait briefly for the file to finish writing
      await Bun.sleep(200);
      const info2 = await stat(filePath).catch(() => null);
      if (!info2 || info2.size !== info.size) continue;

      knownFiles.add(filePath);

      const data = new Uint8Array(await readFile(filePath));
      const contentType = contentTypeFromExt(filePath);

      const queued: QueuedFile = { path: filePath, name: entry, data, contentType };
      fileQueue.push(queued);

      console.log(`[watcher] Queued: ${entry} (${data.byteLength} bytes, ${contentType})`);

      // Signal paper loaded if not already scanning
      if (adfState === "ScannerAdfEmpty" && scannerState === "Idle") {
        adfState = "ScannerAdfLoaded";
        console.log("[watcher] ADF → loaded (file detected)");
      }
    }
  } catch (err) {
    // Watch dir may not exist yet on first tick
  }
}

// ─── XML Responses ───────────────────────────────────────────────────

function capabilitiesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<scan:ScannerCapabilities xmlns:scan="http://schemas.hp.com/imaging/escl/2011/05/03"
                          xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm">
  <pwg:Version>2.63</pwg:Version>
  <pwg:MakeAndModel>Brother ADS-3300W (FAKE)</pwg:MakeAndModel>
  <scan:ModelName>ADS-3300W-FAKE</scan:ModelName>
  <scan:UUID>fake-scanner-uuid-0001</scan:UUID>
  <scan:AdminURI>http://localhost:${PORT}</scan:AdminURI>
  <scan:Platen>
    <scan:PlatenInputCaps>
      <scan:MinWidth>1</scan:MinWidth>
      <scan:MaxWidth>2550</scan:MaxWidth>
      <scan:MinHeight>1</scan:MinHeight>
      <scan:MaxHeight>3508</scan:MaxHeight>
      <scan:SettingProfiles>
        <scan:SettingProfile>
          <scan:ColorModes>
            <scan:ColorMode>RGB24</scan:ColorMode>
            <scan:ColorMode>Grayscale8</scan:ColorMode>
            <scan:ColorMode>BlackAndWhite1</scan:ColorMode>
          </scan:ColorModes>
          <scan:DocumentFormats>
            <pwg:DocumentFormat>application/pdf</pwg:DocumentFormat>
            <pwg:DocumentFormat>image/jpeg</pwg:DocumentFormat>
            <pwg:DocumentFormat>image/png</pwg:DocumentFormat>
          </scan:DocumentFormats>
          <scan:SupportedResolutions>
            <scan:DiscreteResolutions>
              <scan:DiscreteResolution>
                <scan:XResolution>150</scan:XResolution>
                <scan:YResolution>150</scan:YResolution>
              </scan:DiscreteResolution>
              <scan:DiscreteResolution>
                <scan:XResolution>300</scan:XResolution>
                <scan:YResolution>300</scan:YResolution>
              </scan:DiscreteResolution>
              <scan:DiscreteResolution>
                <scan:XResolution>600</scan:XResolution>
                <scan:YResolution>600</scan:YResolution>
              </scan:DiscreteResolution>
            </scan:DiscreteResolutions>
          </scan:SupportedResolutions>
        </scan:SettingProfile>
      </scan:SettingProfiles>
    </scan:PlatenInputCaps>
  </scan:Platen>
  <scan:Adf>
    <scan:AdfSimplexInputCaps>
      <scan:MinWidth>1</scan:MinWidth>
      <scan:MaxWidth>2550</scan:MaxWidth>
      <scan:MinHeight>1</scan:MinHeight>
      <scan:MaxHeight>3508</scan:MaxHeight>
    </scan:AdfSimplexInputCaps>
    <scan:AdfDuplexInputCaps>
      <scan:MinWidth>1</scan:MinWidth>
      <scan:MaxWidth>2550</scan:MaxWidth>
      <scan:MinHeight>1</scan:MinHeight>
      <scan:MaxHeight>3508</scan:MaxHeight>
    </scan:AdfDuplexInputCaps>
  </scan:Adf>
  <scan:InputSources>
    <scan:InputSource>Platen</scan:InputSource>
    <scan:InputSource>Feeder</scan:InputSource>
  </scan:InputSources>
</scan:ScannerCapabilities>`;
}

function statusXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<scan:ScannerStatus xmlns:scan="http://schemas.hp.com/imaging/escl/2011/05/03"
                    xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm">
  <pwg:Version>2.63</pwg:Version>
  <scan:ScannerState>${scannerState}</scan:ScannerState>
  <scan:AdfState>${adfState}</scan:AdfState>
</scan:ScannerStatus>`;
}

// ─── HTTP Server ─────────────────────────────────────────────────────

function log(method: string, path: string, status: number, extra?: string) {
  const ts = new Date().toISOString().slice(11, 23);
  const extraStr = extra ? ` ${extra}` : "";
  console.log(`[${ts}] ${method} ${path} → ${status}${extraStr}`);
}

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // GET /eSCL/ScannerCapabilities
    if (method === "GET" && path === "/eSCL/ScannerCapabilities") {
      log(method, path, 200);
      return new Response(capabilitiesXml(), {
        headers: { "content-type": "application/xml" },
      });
    }

    // GET /eSCL/ScannerStatus
    if (method === "GET" && path === "/eSCL/ScannerStatus") {
      log(method, path, 200, `adf=${adfState}`);
      return new Response(statusXml(), {
        headers: { "content-type": "application/xml" },
      });
    }

    // POST /eSCL/ScanJobs
    if (method === "POST" && path === "/eSCL/ScanJobs") {
      const jobId = String(nextJobId++);
      const file = fileQueue.shift() ?? null;
      const job: Job = { id: jobId, state: "Processing", documentReady: false, file };
      jobs.set(jobId, job);

      scannerState = "Processing";

      // Simulate processing delay, then mark ready
      setTimeout(async () => {
        const j = jobs.get(jobId);
        if (j && j.state === "Processing") {
          j.documentReady = true;
          j.state = "Completed";
          scannerState = "Idle";

          // Move source file to processed/
          if (j.file) {
            const dest = join(PROCESSED_DIR, j.file.name);
            try {
              await rename(j.file.path, dest);
              console.log(`[job:${jobId}] Moved ${j.file.name} → processed/`);
            } catch {
              console.log(`[job:${jobId}] Could not move ${j.file.name} (may already be gone)`);
            }
            knownFiles.delete(j.file.path);
          }

          // If queue is empty, ADF goes back to empty
          if (fileQueue.length === 0) {
            adfState = "ScannerAdfEmpty";
            console.log(`[job:${jobId}] Document ready (ADF → empty, queue empty)`);
          } else {
            console.log(`[job:${jobId}] Document ready (${fileQueue.length} more in queue)`);
          }
        }
      }, DELAY_MS);

      const location = `/eSCL/ScanJobs/${jobId}`;
      log(method, path, 201, `job=${jobId} file=${file?.name ?? "(generated)"}`);
      return new Response(null, {
        status: 201,
        headers: { location },
      });
    }

    // GET /eSCL/ScanJobs/{id}/NextDocument
    const nextDocMatch = path.match(/^\/eSCL\/ScanJobs\/(\d+)\/NextDocument$/);
    if (method === "GET" && nextDocMatch) {
      const jobId = nextDocMatch[1];
      const job = jobs.get(jobId);

      if (!job) {
        log(method, path, 404, "no such job");
        return new Response("Job not found", { status: 404 });
      }

      if (!job.documentReady) {
        log(method, path, 503, "not ready yet");
        return new Response("Document not ready", { status: 503 });
      }

      let data: Uint8Array;
      let contentType: string;

      if (job.file) {
        data = job.file.data;
        contentType = job.file.contentType;
      } else {
        data = generateFallbackPdf();
        contentType = "application/pdf";
      }

      log(method, path, 200, `${data.byteLength} bytes (${contentType})`);
      jobs.delete(jobId);

      return new Response(data, {
        headers: { "content-type": contentType },
      });
    }

    // DELETE /eSCL/ScanJobs/{id}
    const deleteMatch = path.match(/^\/eSCL\/ScanJobs\/(\d+)$/);
    if (method === "DELETE" && deleteMatch) {
      const jobId = deleteMatch[1];
      jobs.delete(jobId);
      scannerState = "Idle";
      log(method, path, 204, `job=${jobId}`);
      return new Response(null, { status: 204 });
    }

    log(method, path, 404);
    return new Response("Not found", { status: 404 });
  },
});

// ─── Fallback PDF (when no file queued) ──────────────────────────────

function generateFallbackPdf(): Uint8Array {
  const timestamp = new Date().toISOString();
  const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 110>>stream
BT /F1 24 Tf 100 700 Td (Fake Scanned Document) Tj /F1 12 Tf 100 670 Td (${timestamp}) Tj ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f \r
0000000009 00000 n \r
0000000052 00000 n \r
0000000101 00000 n \r
0000000230 00000 n \r
0000000392 00000 n \r
trailer<</Size 6/Root 1 0 R>>
startxref
452
%%EOF`;
  return new TextEncoder().encode(pdf);
}

// ─── Start ───────────────────────────────────────────────────────────

await ensureDirs();

setInterval(scanWatchDir, POLL_MS);

console.log("================================================");
console.log("  Fake eSCL Scanner Server (file-watch mode)");
console.log(`  HTTP:  http://0.0.0.0:${PORT}`);
console.log(`  Watch: ${WATCH_DIR}`);
console.log(`  Done:  ${PROCESSED_DIR}`);
console.log(`  Poll:  every ${POLL_MS}ms`);
console.log(`  Delay: ${DELAY_MS}ms simulated scan time`);
console.log("================================================");
console.log("");
console.log("Drop files into the watch directory to trigger scans.");
console.log("");
