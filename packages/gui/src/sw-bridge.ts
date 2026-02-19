type ElectronBridge = {
  send?: (channel: string, data: unknown) => Promise<unknown>;
};

type BridgeResponse = {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  text: string;
  json?: unknown;
};

const electronAPI = (window as { electronAPI?: ElectronBridge }).electronAPI;
const originalFetch = window.fetch;

window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
  const req = new Request(input, init);
  const url = new URL(req.url, location.origin);

  // Only intercept API calls when the Electron preload bridge is present.
  if (!url.pathname.startsWith("/api/") || !electronAPI?.send) {
    return originalFetch(input, init);
  }

  // Read the request body (if any) as text for transport over IPC.
  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      body = await req.clone().text();
    } catch {
      body = undefined;
    }
  }

  // Invoke the main-process handler to perform the request.
  const bridgeRes = (await electronAPI.send("ipcMain-bridge-http", {
    url: req.url,
    method: req.method,
    headers: Object.fromEntries(req.headers.entries()),
    body,
  })) as BridgeResponse | undefined;

  if (!bridgeRes) {
    // Fallback: if IPC failed, let the browser attempt the request.
    return originalFetch(input, init);
  }

  return new Response(bridgeRes.text, {
    status: bridgeRes.status,
    headers: bridgeRes.headers,
  });
};
