import { app, BrowserWindow, dialog, shell, ipcMain } from "electron";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { SERVER_PORT, SERVER_URL, EXPLORER_PORT, EXPLORER_URL, toServerUrl } from "./url-routing";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the project root (3 levels up from dist: dist -> src -> electron -> packages -> root)
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");

const isDev = !app.isPackaged;
const DEV_URL = "http://localhost:5173";
// Default to proxying requests to the spawned server process.
// In-process mode is for debugging only and can conflict with startup/runtime state.
const USE_INPROC_SERVER = process.env.ELECTRON_INPROC_SERVER === "1";

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let explorerProcess: ChildProcess | null = null;

// --- Single instance lock ---
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// --- Data directory setup ---
function getDataDir(): string {
  if (isDev) {
    // In dev, use .proseva-data at project root
    return path.join(PROJECT_ROOT, ".proseva-data");
  }
  return path.join(app.getPath("userData"), "data");
}

function getResourcePath(...segments: string[]): string {
  if (isDev) {
    return path.join(PROJECT_ROOT, ...segments);
  }
  return path.join(process.resourcesPath, ...segments);
}

function initDataDir(): void {
  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

}

// --- Server management ---
function startServer(): ChildProcess {
  const dataDir = getDataDir();
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    PROSEVA_DATA_DIR: dataDir,
    PORT: String(SERVER_PORT),
    EXPLORER_URL: EXPLORER_URL,
  };

  if (isDev) {
    console.log("[electron] Starting dev server with bun...");
    const serverEntry = path.join(PROJECT_ROOT, "packages", "server", "src", "index.ts");
    return spawn("bun", ["run", serverEntry], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  // Production: run compiled server binary.
  // External packages (mupdf) live in dist-server/_modules but the
  // Bun compiled binary resolves imports from its virtual FS path (/$bunfs/root/).
  // NODE_PATH tells the runtime where to find those packages on disk.
  const distServerDir = getResourcePath("dist-server");
  const serverBin = path.join(distServerDir, "proseva-server");
  env.NODE_PATH = path.join(distServerDir, "_modules");
  console.log("[electron] Starting compiled server:", serverBin);
  return spawn(serverBin, [], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function waitForServer(maxRetries = 30, delayMs = 500): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Any HTTP response (including 401) means the server is up
      await fetch(`${SERVER_URL}/api/health`);
      console.log("[electron] Server is ready");
      return true;
    } catch {
      // Server not ready yet (connection refused)
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  console.error("[electron] Server failed to start after retries");
  return false;
}

// --- Explorer management ---
function getExplorerDbPaths(): { embeddings: string; virginia: string } {
  if (isDev) {
    return {
      embeddings: path.join(PROJECT_ROOT, "packages", "datasets", "data", "embeddings.sqlite.db"),
      virginia: path.join(PROJECT_ROOT, "packages", "datasets", "data", "virginia.db"),
    };
  }
  return {
    embeddings: path.join(process.resourcesPath, "explorer-data", "embeddings.sqlite.db"),
    virginia: path.join(process.resourcesPath, "explorer-data", "virginia.db"),
  };
}

function startExplorer(): ChildProcess | null {
  const dbPaths = getExplorerDbPaths();
  if (!fs.existsSync(dbPaths.embeddings)) {
    console.warn("[explorer] Embeddings DB not found, skipping explorer:", dbPaths.embeddings);
    return null;
  }

  const args = [
    "--embeddings", dbPaths.embeddings,
    "--port", String(EXPLORER_PORT),
  ];
  if (fs.existsSync(dbPaths.virginia)) {
    args.push("--virginia", dbPaths.virginia);
  }

  if (isDev) {
    console.log("[electron] Starting dev explorer with bun...");
    const explorerEntry = path.join(PROJECT_ROOT, "packages", "embeddings", "explorer", "server.ts");
    return spawn("bun", ["run", explorerEntry, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  const explorerBin = path.join(getResourcePath("dist-server"), "proseva-explorer");
  console.log("[electron] Starting compiled explorer:", explorerBin);
  return spawn(explorerBin, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function waitForExplorer(maxRetries = 20, delayMs = 500): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fetch(`${EXPLORER_URL}/graphql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "{ __typename }" }),
      });
      console.log("[electron] Explorer is ready");
      return true;
    } catch {
      // Explorer not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  console.warn("[electron] Explorer failed to start after retries");
  return false;
}

// --- Window creation ---
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    const guiDist = path.join(PROJECT_ROOT, "packages", "gui", "dist", "index.html");
    mainWindow.loadFile(guiDist);
  } else {
    mainWindow.loadFile(path.join(process.resourcesPath, "dist", "index.html"));
  }

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

type BridgeRequest = {
  url?: string;
  path?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

type BridgeResponse = {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  text: string;
  json?: unknown;
};

async function handleRequest(req: BridgeRequest | Request): Promise<Response> {
  // Note: do not statically import server code here. Electron's `tsc -p electron/tsconfig.json`
  // must not pull `server/**` into this compilation unit.
  let request: Request;

  if (typeof (req as Request)?.url === "string") {
    const r = req as Request;
    const u = new URL(r.url);
    request = new Request(toServerUrl(u.pathname + u.search), {
      method: r.method,
      headers: r.headers,
      body: r.method === "GET" || r.method === "HEAD" ? undefined : (r as any).body,
    });
  } else {
    const r = req as BridgeRequest;
    const url = toServerUrl(r.url ?? r.path ?? "/");
    const method = (r.method ?? "GET").toUpperCase();

    const headers = new Headers(r.headers ?? {});
    let body: any;

    if (r.body !== undefined && method !== "GET" && method !== "HEAD") {
      if (
        typeof r.body === "string" ||
        r.body instanceof ArrayBuffer ||
        ArrayBuffer.isView(r.body)
      ) {
        body = r.body as any;
      } else {
        if (!headers.has("content-type")) {
          headers.set("content-type", "application/json");
        }
        body = JSON.stringify(r.body);
      }
    }

    request = new Request(url, { method, headers, body });
  }

  if (USE_INPROC_SERVER) {
    // Dev-only: run router in-process using the precompiled JS output.
    // This intentionally uses a dynamic import so Electron's tsc build doesn't typecheck server sources.
    const modUrl = new URL("../dist-server/index.server.js", import.meta.url);
    const mod = (await import(modUrl.href)) as any;
    const ProSeVaServer = mod?.ProSeVaServer;
    if (ProSeVaServer?.fetch) return ProSeVaServer.fetch(request);
    throw new Error("ProSeVaServer.fetch not found (ELECTRON_INPROC_SERVER=1)");
  }

  // Default: proxy to the already-running HTTP server process.
  return fetch(request);
}

// --- App lifecycle ---
app.whenReady().then(async () => {
  // just for kicking the tires
  ipcMain.handle("ipcMain-bridge-http", async (_event, payload) => {
    const response = await handleRequest(payload as BridgeRequest);
    const text = await response.text();

    let json: unknown = undefined;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      // not JSON
    }

    const headers = Object.fromEntries(response.headers.entries());
    headers["x-ipc-bridge"] = "1";

    const out: BridgeResponse = {
      ok: response.ok,
      status: response.status,
      headers,
      text,
      json,
    };
    return out;
  });
  initDataDir();

  serverProcess = startServer();

  const serverErrors: string[] = [];
  serverProcess.stdout?.on("data", (data: Buffer) => {
    console.log(`[server] ${data.toString().trim()}`);
  });
  serverProcess.stderr?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    console.error(`[server] ${msg}`);
    serverErrors.push(msg);
  });
  serverProcess.on("exit", (code) => {
    console.log(`[server] Process exited with code ${code}`);
  });

  // Start explorer (non-fatal if it fails)
  explorerProcess = startExplorer();
  if (explorerProcess) {
    explorerProcess.stdout?.on("data", (data: Buffer) => {
      console.log(`[explorer] ${data.toString().trim()}`);
    });
    explorerProcess.stderr?.on("data", (data: Buffer) => {
      console.error(`[explorer] ${data.toString().trim()}`);
    });
    explorerProcess.on("exit", (code) => {
      console.log(`[explorer] Process exited with code ${code}`);
    });
  }

  // Wait for server (required) and explorer (optional) in parallel
  const serverReadyPromise = waitForServer();
  const explorerReadyPromise = explorerProcess ? waitForExplorer() : Promise.resolve(false);
  const [serverReady, explorerReady] = await Promise.all([serverReadyPromise, explorerReadyPromise]);

  if (!serverReady) {
    console.error("[electron] Could not start server, quitting.");
    const detail = serverErrors.length
      ? serverErrors.join("\n").slice(-1500)
      : "The server did not respond in time. Check the logs for details.";
    dialog.showErrorBox(
      "Pro Se VA — Server Failed to Start",
      `The backend server could not be started.\n\n${detail}`,
    );
    app.quit();
    return;
  }

  if (!explorerReady) {
    console.warn("[electron] Explorer is not available — continuing without it.");
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (serverProcess && !serverProcess.killed) {
    console.log("[electron] Shutting down server...");
    serverProcess.kill("SIGTERM");
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill("SIGKILL");
      }
    }, 3000);
  }
  if (explorerProcess && !explorerProcess.killed) {
    console.log("[electron] Shutting down explorer...");
    explorerProcess.kill("SIGTERM");
    setTimeout(() => {
      if (explorerProcess && !explorerProcess.killed) {
        explorerProcess.kill("SIGKILL");
      }
    }, 3000);
  }
});
