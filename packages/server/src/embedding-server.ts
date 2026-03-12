import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

let embeddingProcess: ChildProcess | null = null;

// Model download state
let modelDownloading = false;
let modelDownloadProgress = 0; // 0-100
let modelDownloadError: string | null = null;
let onProgressCallback: ((progress: number) => void) | null = null;
let onReadyCallback: (() => void) | null = null;

/**
 * Resolve how to start the embedding server.
 * Production: compiled binary next to the server executable.
 * Dev: fall back to `cargo run` from the embeddings package directory.
 */
function resolveSpawnArgs(): { cmd: string; args: string[]; cwd?: string } | null {
  // Production: compiled binary next to proseva-server
  const candidate = join(dirname(process.execPath), "embedding-server");
  if (existsSync(candidate)) {
    return { cmd: candidate, args: [] };
  }

  // Dev: find the embeddings package relative to this source file and use cargo
  if (!import.meta.dir) return null;
  const embeddingsDir = resolve(import.meta.dir, "../../embeddings");
  const cargoToml = join(embeddingsDir, "Cargo.toml");
  if (existsSync(cargoToml)) {
    return {
      cmd: "cargo",
      args: ["run", "--release", "--bin", "embedding-server", "--"],
      cwd: embeddingsDir,
    };
  }

  return null;
}

function parsePort(endpoint: string | undefined): number {
  if (!endpoint) return 8000;
  try {
    return new URL(endpoint).port
      ? parseInt(new URL(endpoint).port, 10)
      : 8000;
  } catch {
    return 8000;
  }
}

/**
 * Start the embedding server as a child process.
 * In production, runs the compiled binary. In dev, runs cargo.
 * No-ops when neither is available or the process is already running.
 */
export function startEmbeddingServer(): void {
  if (embeddingProcess) return;

  const spawn_info = resolveSpawnArgs();
  if (!spawn_info) {
    console.log(
      "[startup] Embedding server: no binary or Cargo.toml found, skipping spawn",
    );
    return;
  }

  const port = parsePort(process.env.EMBEDDINGS_ENDPOINT);
  const { cmd, args, cwd } = spawn_info;
  const fullArgs = [...args, "--port", String(port)];

  console.log(
    `[startup] Embedding server: starting ${cmd} ${fullArgs.join(" ")}${cwd ? ` (cwd=${cwd})` : ""}`,
  );
  embeddingProcess = spawn(cmd, fullArgs, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });

  embeddingProcess.stdout?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg.includes("listening")) {
      console.log(
        `[startup] Embedding server ready (pid=${embeddingProcess?.pid}, port=${port})`,
      );
      modelDownloading = false;
      modelDownloadProgress = 100;
      modelDownloadError = null;
      onReadyCallback?.();
      onReadyCallback = null;
      onProgressCallback = null;
    }

    // Track download/init progress from Rust output
    if (msg.includes("Downloading") || msg.includes("extracting")) {
      modelDownloading = true;
      // Parse percentage if present (e.g. "50%", "50.0%")
      const pctMatch = msg.match(/(\d+(?:\.\d+)?)%/);
      if (pctMatch) {
        modelDownloadProgress = Math.min(parseFloat(pctMatch[1]), 99);
        onProgressCallback?.(modelDownloadProgress);
      }
    }
    if (msg.includes("Model ready")) {
      modelDownloadProgress = 80; // Model downloaded, workers still initializing
      onProgressCallback?.(modelDownloadProgress);
    }
    if (msg.includes("workers initialized")) {
      modelDownloadProgress = 95;
      onProgressCallback?.(modelDownloadProgress);
    }

    console.log(`[embedding-server] ${msg}`);
  });
  embeddingProcess.stderr?.on("data", (data: Buffer) => {
    console.error(`[embedding-server] ${data.toString().trim()}`);
  });
  embeddingProcess.on("exit", (code, signal) => {
    console.log(
      `[embedding-server] Process exited code=${code} signal=${signal}`,
    );
    if (modelDownloading) {
      modelDownloading = false;
      modelDownloadError = `Embedding server exited unexpectedly (code=${code}, signal=${signal})`;
    }
    embeddingProcess = null;
  });
  embeddingProcess.on("error", (err) => {
    console.error(`[embedding-server] Failed to start: ${err.message}`);
    if (modelDownloading) {
      modelDownloading = false;
      modelDownloadError = err.message;
    }
    embeddingProcess = null;
  });
}

export type EmbeddingServerStatus = "up" | "down";

export function embeddingServerStatus(): EmbeddingServerStatus {
  return embeddingProcess !== null && !embeddingProcess.killed ? "up" : "down";
}

/**
 * Resolve the model cache directory, mirroring the Rust logic.
 */
function resolveModelCacheDir(): string {
  if (process.env.FASTEMBED_CACHE_DIR) return process.env.FASTEMBED_CACHE_DIR;
  if (process.env.HF_HOME) return process.env.HF_HOME;
  return join(homedir(), ".cache", "huggingface", "hub");
}

/**
 * Check whether the embedding model has been downloaded to the local cache.
 * fastembed stores models under `models--{org}--{name}/` in the cache dir.
 */
export function isEmbeddingModelDownloaded(): boolean {
  const cacheDir = resolveModelCacheDir();
  const modelDir = join(cacheDir, "models--onnx-community--embeddinggemma-300m-ONNX");
  // The model directory must exist AND contain a snapshots subdirectory with content
  if (!existsSync(modelDir)) return false;
  const snapshotsDir = join(modelDir, "snapshots");
  if (!existsSync(snapshotsDir)) return false;
  // Check that at least one snapshot exists
  try {
    const entries = readdirSync(snapshotsDir);
    return entries.length > 0;
  } catch {
    return false;
  }
}

export interface EmbeddingModelStatus {
  modelDownloaded: boolean;
  serverStatus: EmbeddingServerStatus;
  downloading: boolean;
  downloadProgress: number;
  error: string | null;
}

export function getEmbeddingModelStatus(): EmbeddingModelStatus {
  return {
    modelDownloaded: isEmbeddingModelDownloaded(),
    serverStatus: embeddingServerStatus(),
    downloading: modelDownloading,
    downloadProgress: modelDownloadProgress,
    error: modelDownloadError,
  };
}

/**
 * Trigger model download by starting the embedding server.
 * Tracks progress from stdout and calls callbacks.
 */
export function triggerModelDownload(
  onProgress?: (progress: number) => void,
  onReady?: () => void,
): { alreadyDownloaded: boolean } {
  if (isEmbeddingModelDownloaded() && embeddingServerStatus() === "up") {
    return { alreadyDownloaded: true };
  }

  modelDownloading = true;
  modelDownloadProgress = 0;
  modelDownloadError = null;
  onProgressCallback = onProgress ?? null;
  onReadyCallback = onReady ?? null;

  // If server is already running, just wait for it
  if (embeddingProcess) {
    return { alreadyDownloaded: false };
  }

  // Start the server which will download the model
  startEmbeddingServer();
  return { alreadyDownloaded: false };
}

/**
 * Gracefully stop the embedding server (SIGTERM, then SIGKILL after 3 s).
 */
export function stopEmbeddingServer(): void {
  if (!embeddingProcess || embeddingProcess.killed) return;

  const pid = embeddingProcess.pid;
  console.log(`[embedding-server] Shutting down pid=${pid}...`);
  embeddingProcess.kill("SIGTERM");
  const proc = embeddingProcess;
  setTimeout(() => {
    if (proc && !proc.killed) {
      proc.kill("SIGKILL");
    }
  }, 3000);
}
