import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

let embeddingProcess: ChildProcess | null = null;

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
    embeddingProcess = null;
  });
  embeddingProcess.on("error", (err) => {
    console.error(`[embedding-server] Failed to start: ${err.message}`);
    embeddingProcess = null;
  });
}

export type EmbeddingServerStatus = "up" | "down";

export function embeddingServerStatus(): EmbeddingServerStatus {
  return embeddingProcess !== null && !embeddingProcess.killed ? "up" : "down";
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
