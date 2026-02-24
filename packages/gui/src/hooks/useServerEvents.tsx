import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";

type Listener = () => void;

interface ServerEventsContextValue {
  subscribe: (event: string, listener: Listener) => () => void;
}

const ServerEventsContext = createContext<ServerEventsContextValue | null>(
  null,
);

function getWsUrl(): string {
  const electronAPI = (window as Record<string, unknown>).electronAPI as
    | { serverUrl?: string }
    | undefined;
  if (electronAPI?.serverUrl) {
    const url = new URL(electronAPI.serverUrl);
    return `${url.protocol === "https:" ? "wss" : "ws"}://${url.host}/ws`;
  }
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws`;
}

export function ServerEventsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const listenersRef = useRef(new Map<string, Set<Listener>>());
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      if (disposed) return;
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const { event } = JSON.parse(e.data) as { event: string };
          const set = listenersRef.current.get(event);
          if (set) set.forEach((fn) => fn());
        } catch {
          /* ignore malformed */
        }
      };

      ws.onclose = () => {
        if (!disposed) reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const subscribe = useCallback((event: string, listener: Listener) => {
    const map = listenersRef.current;
    if (!map.has(event)) map.set(event, new Set());
    map.get(event)!.add(listener);
    return () => {
      map.get(event)?.delete(listener);
    };
  }, []);

  const value = useMemo(() => ({ subscribe }), [subscribe]);

  return (
    <ServerEventsContext.Provider value={value}>
      {children}
    </ServerEventsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useServerEvent(event: string, listener: Listener) {
  const ctx = useContext(ServerEventsContext);
  const listenerRef = useRef(listener);

  useEffect(() => {
    listenerRef.current = listener;
    if (!ctx) return;
    return ctx.subscribe(event, () => listenerRef.current());
  }, [ctx, event]);
}
