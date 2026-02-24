type ElectronBridge = {
  explorerUrl?: string;
};

const electronAPI = (window as { electronAPI?: ElectronBridge }).electronAPI;

const EXPLORER_BASE = electronAPI?.explorerUrl ?? "http://localhost:3002";

export async function explorerQuery<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  // In Electron, /explorer/graphql is intercepted by sw-bridge and routed via IPC.
  // Outside Electron, fall back to direct fetch against the explorer server.
  const url = electronAPI ? "/explorer/graphql" : `${EXPLORER_BASE}/graphql`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Explorer query failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Explorer GraphQL error: ${json.errors[0].message}`);
  }

  return json.data as T;
}
