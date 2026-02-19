export type ElectronBridge = {
  isElectron?: boolean;
  serverUrl?: string;
  send?: (channel: string, data: unknown) => Promise<unknown>;
};

export type ProsevaTransport = {
  baseUrl: string;
  fetch: typeof fetch;
};

export type ProsevaTransportOptions = {
  /**
   * Base URL used for all requests.
   *
   * Defaults to `"/api"` which matches the app server routes.
   */
  baseUrl?: string;

  /**
   * Fallback fetch implementation when not using Electron IPC transport.
   * Defaults to a dynamic wrapper around `globalThis.fetch`.
   */
  fetch?: typeof fetch;

  /**
   * Electron IPC transport options.
   *
   * When `globalThis.electronAPI.send` is present and `baseUrl` is not absolute,
   * the SDK will route requests through the main process using this channel.
   */
  electron?: {
    channel?: string;
    electronAPI?: ElectronBridge;
  };
};

type BridgeRequest = {
  path?: string;
  url?: string;
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

function isAbsoluteUrl(url: string): boolean {
  // Treat any scheme (e.g. http:, https:, file:) as absolute.
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url);
}

function getGlobalFetch(): typeof fetch {
  const f = (globalThis as any)?.fetch as typeof fetch | undefined;
  if (!f) {
    throw new Error(
      "globalThis.fetch is not available. Provide ProsevaTransportOptions.fetch (or createProsevaClient({ fetch })).",
    );
  }
  // Always call the latest `globalThis.fetch` (important when Electron patches window.fetch at runtime).
  return ((input, init) => (globalThis as any).fetch(input as any, init as any)) as typeof fetch;
}

function getElectronAPI(
  explicit?: ElectronBridge,
): ElectronBridge | undefined {
  if (explicit) return explicit;
  return (globalThis as any)?.electronAPI as ElectronBridge | undefined;
}

export function createElectronIpcFetch(options: {
  channel?: string;
  electronAPI?: ElectronBridge;
  fallbackFetch?: typeof fetch;
} = {}): typeof fetch {
  const channel = options.channel ?? "ipcMain-bridge-http";
  const fallbackFetch = options.fallbackFetch ?? getGlobalFetch();

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const bridge = getElectronAPI(options.electronAPI);
    if (!bridge?.send) return fallbackFetch(input as any, init as any);

    if (init?.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    const req = new Request(input as any, init as any);
    const u = new URL(req.url);

    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    let body: unknown = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      // Send the raw bytes so multipart/form-data and other binary payloads survive IPC transport.
      // Note: this buffers the full request in memory.
      if (req.body) {
        body = await req.clone().arrayBuffer();
      }
    }

    const payload: BridgeRequest = {
      // Prefer path so file:// origins don’t leak into the main process bridge.
      path: `${u.pathname}${u.search}`,
      method: req.method,
      headers,
      body,
    };

    const bridgeRes = (await bridge.send(channel, payload)) as
      | BridgeResponse
      | undefined;

    if (
      !bridgeRes ||
      typeof bridgeRes.status !== "number" ||
      typeof bridgeRes.text !== "string" ||
      !bridgeRes.headers
    ) {
      throw new Error("Invalid Electron IPC bridge response.");
    }

    return new Response(bridgeRes.text, {
      status: bridgeRes.status,
      headers: bridgeRes.headers,
    });
  };
}

export function createProsevaTransport(
  options: ProsevaTransportOptions = {},
): ProsevaTransport {
  const baseUrl = options.baseUrl ?? "/api";
  const baseFetch = options.fetch ?? getGlobalFetch();

  const electronAPI = getElectronAPI(options.electron?.electronAPI);
  const canUseElectronIpc = typeof electronAPI?.send === "function";

  // Only auto-enable IPC when baseUrl is relative. If a consumer passes an absolute URL
  // (e.g. hosted API), they almost certainly want a normal fetch transport.
  if (canUseElectronIpc && !isAbsoluteUrl(baseUrl)) {
    return {
      baseUrl,
      fetch: createElectronIpcFetch({
        channel: options.electron?.channel,
        electronAPI,
        fallbackFetch: baseFetch,
      }),
    };
  }

  return { baseUrl, fetch: baseFetch };
}
