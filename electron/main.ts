import { app, BrowserWindow, shell } from "electron";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const SERVER_PORT = 3001;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;
const DEV_URL = "http://localhost:5173";

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

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
    // In dev, use the project's server/data directory
    return path.join(__dirname, "..", "server", "data");
  }
  return path.join(app.getPath("userData"), "data");
}

function getResourcePath(...segments: string[]): string {
  if (isDev) {
    return path.join(__dirname, "..", ...segments);
  }
  return path.join(process.resourcesPath, ...segments);
}

function initDataDir(): void {
  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Copy seed db.json on first run if no db.json exists
  const dbPath = path.join(dataDir, "db.json");
  if (!fs.existsSync(dbPath)) {
    const seedPath = getResourcePath("server", "data", "db.json");
    if (fs.existsSync(seedPath)) {
      fs.copyFileSync(seedPath, dbPath);
      console.log("[electron] Copied seed db.json to", dbPath);
    } else {
      // Create minimal empty db
      fs.writeFileSync(dbPath, JSON.stringify({}, null, 2));
      console.log("[electron] Created empty db.json at", dbPath);
    }
  }
}

// --- Server management ---
function startServer(): ChildProcess {
  const dataDir = getDataDir();
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    PROSEVA_DATA_DIR: dataDir,
    PORT: String(SERVER_PORT),
  };

  if (isDev) {
    console.log("[electron] Starting dev server with bun...");
    const serverEntry = path.join(__dirname, "..", "server", "src", "index.ts");
    return spawn("bun", ["run", serverEntry], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  // Production: run compiled server binary
  const staticDir = getResourcePath("dist");
  env.PROSEVA_STATIC_DIR = staticDir;

  const serverBin = getResourcePath("dist-server", "proseva-server");
  console.log("[electron] Starting compiled server:", serverBin);
  return spawn(serverBin, [], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function waitForServer(maxRetries = 30, delayMs = 500): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${SERVER_URL}/api/cases`);
      if (response.ok || response.status === 200) {
        console.log("[electron] Server is ready");
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  console.error("[electron] Server failed to start after retries");
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

  const loadURL = isDev ? DEV_URL : SERVER_URL;
  mainWindow.loadURL(loadURL);

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

// --- App lifecycle ---
app.whenReady().then(async () => {
  initDataDir();

  serverProcess = startServer();

  serverProcess.stdout?.on("data", (data: Buffer) => {
    console.log(`[server] ${data.toString().trim()}`);
  });
  serverProcess.stderr?.on("data", (data: Buffer) => {
    console.error(`[server] ${data.toString().trim()}`);
  });
  serverProcess.on("exit", (code) => {
    console.log(`[server] Process exited with code ${code}`);
  });

  const ready = await waitForServer();
  if (!ready) {
    console.error("[electron] Could not start server, quitting.");
    app.quit();
    return;
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
    // Give it a moment then force kill
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill("SIGKILL");
      }
    }, 3000);
  }
});
