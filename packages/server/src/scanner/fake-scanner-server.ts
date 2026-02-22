#!/usr/bin/env bun
/**
 * Fake eSCL scanner server for testing the scanner feature.
 *
 * Usage:
 *   bun packages/server/src/scanner/fake-scanner-server.ts [--port 8085]
 *
 * Controls (type in terminal while running):
 *   p  - Toggle paper in ADF (empty ↔ loaded)
 *   s  - Show current state
 *   q  - Quit
 *
 * Point ProSeVA scanner config to http://localhost:8085
 */

const PORT = Number(process.argv.includes("--port") ? process.argv[process.argv.indexOf("--port") + 1] : 8085);

// ─── State ───────────────────────────────────────────────────────────

let adfState: "ScannerAdfLoaded" | "ScannerAdfEmpty" = "ScannerAdfEmpty";
let scannerState: "Idle" | "Processing" = "Idle";
let nextJobId = 1;
const jobs = new Map<string, { id: string; state: "Processing" | "Completed" | "Canceled"; documentReady: boolean }>();

// ─── Minimal PDF ─────────────────────────────────────────────────────

function generateFakePdf(): Uint8Array {
  // A minimal valid PDF with one page containing the text "Fake Scan"
  const timestamp = new Date().toISOString();
  const content = `1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 120 >>
stream
BT
/F1 24 Tf
100 700 Td
(Fake Scanned Document) Tj
/F1 12 Tf
100 670 Td
(Generated: ${timestamp}) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
`;

  const objects = content;
  const xrefOffset = objects.length;

  const pdf = `%PDF-1.4
${objects}xref
0 6
0000000000 65535 f \r
0000000009 00000 n \r
0000000058 00000 n \r
0000000115 00000 n \r
0000000266 00000 n \r
0000000438 00000 n \r
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${xrefOffset}
%%EOF`;

  return new TextEncoder().encode(pdf);
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
  console.log(`  [${ts}] ${method} ${path} → ${status}${extraStr}`);
}

const server = Bun.serve({
  port: PORT,
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
      const job = { id: jobId, state: "Processing" as const, documentReady: false };
      jobs.set(jobId, job);

      scannerState = "Processing";

      // Simulate scan processing: document ready after 2 seconds
      setTimeout(() => {
        const j = jobs.get(jobId);
        if (j && j.state === "Processing") {
          j.documentReady = true;
          j.state = "Completed";
          scannerState = "Idle";
          // After scan, set ADF back to empty (paper consumed)
          adfState = "ScannerAdfEmpty";
          console.log(`  [job:${jobId}] Document ready (ADF → empty)`);
        }
      }, 2000);

      const location = `http://localhost:${PORT}/eSCL/ScanJobs/${jobId}`;
      log(method, path, 201, `job=${jobId}`);
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

      const pdf = generateFakePdf();
      log(method, path, 200, `${pdf.byteLength} bytes`);

      // Clean up job after delivery
      jobs.delete(jobId);

      return new Response(pdf as BlobPart, {
        headers: { "content-type": "application/pdf" },
      });
    }

    // DELETE /eSCL/ScanJobs/{id}
    const deleteMatch = path.match(/^\/eSCL\/ScanJobs\/(\d+)$/);
    if (method === "DELETE" && deleteMatch) {
      const jobId = deleteMatch[1];
      const job = jobs.get(jobId);
      if (job) {
        job.state = "Canceled";
        jobs.delete(jobId);
      }
      scannerState = "Idle";
      log(method, path, 204, `job=${jobId}`);
      return new Response(null, { status: 204 });
    }

    log(method, path, 404);
    return new Response("Not found", { status: 404 });
  },
});

// ─── Interactive Controls ────────────────────────────────────────────

function printState() {
  console.log(`\n  State: scanner=${scannerState} adf=${adfState} jobs=${jobs.size}\n`);
}

function printHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  Fake eSCL Scanner Server                                ║
║  Listening on http://localhost:${String(PORT).padEnd(5)}                    ║
╠══════════════════════════════════════════════════════════╣
║  Controls:                                               ║
║    p  - Toggle paper in ADF (triggers scan)              ║
║    s  - Show current state                               ║
║    q  - Quit                                             ║
╚══════════════════════════════════════════════════════════╝
`);
  printState();
}

printHelp();

// Read stdin for interactive control
process.stdin.setRawMode?.(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");
process.stdin.on("data", (key: string) => {
  if (key === "q" || key === "\u0003") {
    // q or Ctrl+C
    console.log("\nShutting down...");
    server.stop();
    process.exit(0);
  }

  if (key === "p") {
    if (adfState === "ScannerAdfEmpty") {
      adfState = "ScannerAdfLoaded";
      console.log("\n  >>> Paper LOADED into ADF (will trigger scan on next poll)");
    } else {
      adfState = "ScannerAdfEmpty";
      console.log("\n  >>> Paper REMOVED from ADF");
    }
    printState();
  }

  if (key === "s") {
    printState();
  }
});
