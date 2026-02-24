import type { ServerWebSocket } from "bun";

const wsClients = new Set<ServerWebSocket>();

export function broadcast(event: string, data?: unknown) {
  const msg = JSON.stringify({ event, data });
  for (const ws of wsClients) {
    ws.send(msg);
  }
}

export { wsClients };
