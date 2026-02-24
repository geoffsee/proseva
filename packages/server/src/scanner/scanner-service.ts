import { getConfig } from "../config";
import {
  BrotherAds3300wSdk,
  inferFileExtension,
  type ScanSettings,
} from "./escl-sdk";

type PaperState = "loaded" | "empty" | "unknown";

// Hardcoded sensible defaults for scan settings.
const SCAN_SETTINGS: ScanSettings = {
  inputSource: "Feeder",
  duplex: true,
  colorMode: "RGB24",
  documentFormat: "application/pdf",
  xResolution: 300,
  yResolution: 300,
};

const POLL_INTERVAL_MS = 1500;
const SCAN_TIMEOUT_MS = 120_000;
const SCAN_POLL_MS = 750;

/**
 * Callback invoked after a document is successfully scanned.
 * Receives the raw PDF buffer and a generated filename.
 */
export type OnScanComplete = (buffer: Buffer, filename: string) => void;

// Module-level state (mirrors scheduler.ts pattern).
let pollTimer: ReturnType<typeof setInterval> | null = null;
let sdk: BrotherAds3300wSdk | null = null;
let scanInProgress = false;
let pollInProgress = false;
let lastError: string | undefined;
let previousPaperState: PaperState | undefined;
let scanCount = 0;
let configuredEndpoints: string[] = [];
let onScanComplete: OnScanComplete | null = null;

function detectPaperState(adfState: string | undefined): PaperState {
  if (!adfState) return "unknown";
  const lowered = adfState.toLowerCase();
  if (
    lowered.includes("empty") ||
    lowered.includes("nopaper") ||
    lowered.includes("notloaded")
  )
    return "empty";
  if (lowered.includes("loaded") || lowered.includes("paperpresent"))
    return "loaded";
  return "unknown";
}

function isoForFilename(date: Date): string {
  return date.toISOString().replaceAll(":", "-");
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function performScan(reason: string): Promise<void> {
  if (scanInProgress || !sdk) return;

  scanInProgress = true;
  const startedAtDate = new Date();
  const id = ++scanCount;
  console.log(`[scanner:${id}] start reason=${reason}`);

  try {
    const { document } = await sdk.scanOnce(SCAN_SETTINGS, {
      timeoutMs: SCAN_TIMEOUT_MS,
      pollIntervalMs: SCAN_POLL_MS,
    });

    const extension = inferFileExtension(document.contentType);
    const filename = `scan-${isoForFilename(startedAtDate)}-${id}.${extension}`;
    const buffer = Buffer.from(document.data);

    console.log(
      `[scanner:${id}] scanned ${document.sizeBytes} bytes -> ${filename}`,
    );
    lastError = undefined;

    if (onScanComplete) {
      try {
        onScanComplete(buffer, filename);
      } catch (cbError) {
        console.error(
          `[scanner:${id}] onScanComplete callback failed:`,
          cbError,
        );
      }
    }
  } catch (error) {
    const message = asErrorMessage(error);
    lastError = `scan failed: ${message}`;
    console.error(`[scanner:${id}] failed: ${message}`);
  } finally {
    scanInProgress = false;
  }
}

async function pollScanner(): Promise<void> {
  if (pollInProgress || !sdk) return;
  pollInProgress = true;

  try {
    const status = await sdk.getStatus();
    lastError = undefined;

    const currentPaperState = detectPaperState(status.adfState);
    if (currentPaperState !== previousPaperState) {
      console.log(
        `[scanner] adf ${previousPaperState ?? "unknown"} -> ${currentPaperState} (${status.adfState ?? "n/a"})`,
      );
    }

    const paperInserted =
      currentPaperState === "loaded" && previousPaperState !== "loaded";
    if (paperInserted && !scanInProgress) {
      await performScan("paper_loaded");
    }

    previousPaperState = currentPaperState;
  } catch (error) {
    const message = asErrorMessage(error);
    lastError = `status poll failed: ${message}`;
    console.error(`[scanner] ${message}`);
  } finally {
    pollInProgress = false;
  }
}

/**
 * Initialize the document scanner service.
 * Reads config to determine if scanning is enabled and starts polling.
 * @param options.onComplete - called after each successful scan with the PDF buffer and filename
 */
export function initScanner(options?: { onComplete?: OnScanComplete }): void {
  const enabled = getConfig("SCANNER_ENABLED") === "true";
  if (!enabled) {
    console.log("[scanner] Document scanner disabled");
    return;
  }

  const endpointsRaw = getConfig("SCANNER_ENDPOINTS") ?? "";
  const endpoints = endpointsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (endpoints.length === 0) {
    console.log("[scanner] No scanner endpoints configured");
    return;
  }

  configuredEndpoints = endpoints;
  onScanComplete = options?.onComplete ?? null;

  sdk = new BrotherAds3300wSdk({ endpoints });
  previousPaperState = undefined;
  lastError = undefined;

  pollTimer = setInterval(() => {
    void pollScanner();
  }, POLL_INTERVAL_MS);
  void pollScanner();

  console.log(
    `[scanner] Initialized - polling ${endpoints.join(", ")} every ${POLL_INTERVAL_MS}ms`,
  );
}

/**
 * Stop the document scanner service.
 */
export function stopScanner(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  sdk = null;
  scanInProgress = false;
  pollInProgress = false;
  previousPaperState = undefined;
  configuredEndpoints = [];
  onScanComplete = null;
  console.log("[scanner] Stopped");
}

/**
 * Restart the document scanner service with current configuration.
 */
export function restartScanner(): void {
  console.log("[scanner] Restarting with new configuration");
  const savedCallback = onScanComplete;
  stopScanner();
  initScanner({ onComplete: savedCallback ?? undefined });
}

/**
 * Get the current status of the scanner service.
 */
export function getScannerStatus(): {
  enabled: boolean;
  running: boolean;
  scanInProgress: boolean;
  endpoints: string[];
  lastError?: string;
  scanCount: number;
} {
  return {
    enabled: getConfig("SCANNER_ENABLED") === "true",
    running: pollTimer !== null,
    scanInProgress,
    endpoints: configuredEndpoints,
    lastError,
    scanCount,
  };
}

/**
 * Test scanner connectivity by attempting to retrieve capabilities.
 */
export async function testScannerConnection(): Promise<{
  success: boolean;
  error?: string;
  model?: string;
}> {
  const endpointsRaw = getConfig("SCANNER_ENDPOINTS") ?? "";
  const endpoints = endpointsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (endpoints.length === 0) {
    return { success: false, error: "No scanner endpoints configured" };
  }
  try {
    const testSdk = new BrotherAds3300wSdk({
      endpoints,
      requestTimeoutMs: 5000,
    });
    const caps = await testSdk.getCapabilities();
    return {
      success: true,
      model: caps.makeAndModel || caps.modelName || "Unknown model",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
