import { useCallback, useMemo, useRef, useState } from "react";
import { useServerEvent } from "./useServerEvents";

type ChatProcessStage =
  | "request-start"
  | "tool-context-start"
  | "tool-context-done"
  | "tool-context-skipped"
  | "tool-context-failed"
  | "tool-loop-start"
  | "tool-iteration"
  | "tool-call-start"
  | "tool-call-done"
  | "force-tool"
  | "tool-loop-complete"
  | "tool-summary-start"
  | "tool-summary-tool-start"
  | "tool-summary-tool-done"
  | "tool-summary-done"
  | "tool-summary-failed"
  | "final-context-ready"
  | "final-generation-start"
  | "final-generation-done"
  | "error";

type ChatProcessSource = {
  source: string;
  source_id?: string;
  node_type?: string;
  score?: number;
  preview?: string;
};

type ChatProcessEventPayload = {
  source: "chat";
  runId: string;
  stage: ChatProcessStage;
  message: string;
  at: string;
  data?: {
    tool?: string;
    sources?: ChatProcessSource[];
  } & Record<string, unknown>;
};

type TimelineEvent = {
  id: string;
  stage: ChatProcessStage;
  message: string;
  at: string;
  tool?: string;
  detail?: string;
};

type DisplaySource = {
  key: string;
  label: string;
  score?: number;
  preview?: string;
};

const MAX_EVENTS = 16;
const MAX_SOURCES = 8;

const stagesThatEndRun = new Set<ChatProcessStage>([
  "final-generation-done",
  "error",
]);

const stagesThatStartRun = new Set<ChatProcessStage>([
  "request-start",
  "tool-loop-start",
  "final-generation-start",
]);

const toDetailText = (
  stage: ChatProcessStage,
  data?: Record<string, unknown>,
): string | undefined => {
  if (!data) return undefined;
  const tool = typeof data.tool === "string" ? data.tool : undefined;
  const iteration =
    typeof data.iteration === "number" ? `Iteration ${data.iteration}` : "";
  const resultCount =
    typeof data.result_count === "number"
      ? `${data.result_count} result${data.result_count === 1 ? "" : "s"}`
      : "";

  if (stage === "tool-call-start") {
    return [iteration, tool].filter(Boolean).join(" • ") || undefined;
  }
  if (stage === "tool-call-done" || stage === "tool-summary-tool-done") {
    return [tool, resultCount].filter(Boolean).join(" • ") || undefined;
  }
  if (stage === "tool-iteration") {
    const tools = Array.isArray(data.tools)
      ? `${data.tools.length} tool call${data.tools.length === 1 ? "" : "s"}`
      : "";
    return [iteration, tools].filter(Boolean).join(" • ") || undefined;
  }
  return undefined;
};

const toDisplaySource = (source: ChatProcessSource): DisplaySource => {
  const sourceId = source.source_id ? `:${source.source_id}` : "";
  const nodeType = source.node_type ? ` (${source.node_type})` : "";
  const label = `${source.source}${sourceId}${nodeType}`;
  return {
    key: `${source.source}|${source.source_id ?? ""}|${source.node_type ?? ""}`,
    label,
    score: typeof source.score === "number" ? source.score : undefined,
    preview: source.preview,
  };
};

const parsePayload = (data?: unknown): ChatProcessEventPayload | null => {
  if (!data || typeof data !== "object") return null;
  const payload = data as Partial<ChatProcessEventPayload>;
  if (payload.source !== "chat") return null;
  if (typeof payload.runId !== "string" || payload.runId.length === 0) {
    return null;
  }
  if (typeof payload.stage !== "string" || typeof payload.message !== "string") {
    return null;
  }
  return payload as ChatProcessEventPayload;
};

export function useChatProcessTimeline(source: "chat") {
  const activeRunIdRef = useRef<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [sourceMap, setSourceMap] = useState<Record<string, DisplaySource>>({});
  const [toolSummaryText, setToolSummaryText] = useState<string | null>(null);

  const listener = useCallback(
    (raw?: unknown) => {
      const event = parsePayload(raw);
      if (!event || event.source !== source) return;
      const currentRunId = activeRunIdRef.current;

      const isNewRun = event.stage === "request-start";
      if (isNewRun) {
        activeRunIdRef.current = event.runId;
        setActiveRunId(event.runId);
        setEvents([]);
        setSourceMap({});
        setToolSummaryText(null);
      }

      if (currentRunId && event.runId !== currentRunId && !isNewRun) {
        return;
      }

      if (!currentRunId) {
        activeRunIdRef.current = event.runId;
        setActiveRunId(event.runId);
      }

      const detail = toDetailText(event.stage, event.data);
      setEvents((prev) => {
        const next = [
          ...prev,
          {
            id: `${event.runId}:${event.stage}:${event.at}:${prev.length}`,
            stage: event.stage,
            message: event.message,
            at: event.at,
            tool: typeof event.data?.tool === "string" ? event.data.tool : undefined,
            detail,
          },
        ];
        return next.slice(-MAX_EVENTS);
      });

      const sources = Array.isArray(event.data?.sources)
        ? event.data.sources
        : undefined;
      if (sources && sources.length > 0) {
        setSourceMap((prev) => {
          const next = { ...prev };
          for (const item of sources) {
            if (!item || typeof item !== "object" || typeof item.source !== "string") {
              continue;
            }
            const display = toDisplaySource(item);
            const existing = next[display.key];
            if (!existing) {
              next[display.key] = display;
              continue;
            }
            const existingScore = existing.score ?? Number.NEGATIVE_INFINITY;
            const incomingScore = display.score ?? Number.NEGATIVE_INFINITY;
            if (incomingScore >= existingScore) {
              next[display.key] = display;
            }
          }
          return next;
        });
      }

      if (
        event.stage === "tool-summary-done" &&
        typeof event.data?.summary_text === "string"
      ) {
        setToolSummaryText(event.data.summary_text);
      }

      if (stagesThatStartRun.has(event.stage)) {
        setIsRunning(true);
      }
      if (stagesThatEndRun.has(event.stage)) {
        setIsRunning(false);
      }
    },
    [source],
  );

  useServerEvent("chat-process", listener);

  const sources = useMemo(() => {
    return Object.values(sourceMap)
      .sort(
        (a, b) =>
          (b.score ?? Number.NEGATIVE_INFINITY) -
          (a.score ?? Number.NEGATIVE_INFINITY),
      )
      .slice(0, MAX_SOURCES);
  }, [sourceMap]);

  const currentMessage = events[events.length - 1]?.message ?? null;

  return {
    activeRunId,
    currentMessage,
    events,
    isRunning,
    sources,
    toolSummaryText,
  };
}
