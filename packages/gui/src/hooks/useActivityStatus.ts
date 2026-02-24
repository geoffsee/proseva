import { useState, useCallback } from "react";
import { useServerEvent } from "./useServerEvents";

interface ActivityStatusData {
  source: "chat" | "research";
  phase: "tool-start" | "tool-done" | "generating" | "idle";
  tool?: string;
}

const TOOL_LABELS: Record<string, string> = {
  // Chat tools
  GetCases: "Loading cases...",
  GetDeadlines: "Checking deadlines...",
  GetContacts: "Loading contacts...",
  GetFinances: "Loading finances...",
  GetDocuments: "Loading documents...",
  GetDocumentText: "Reading document...",
  SearchTimeline: "Searching timeline...",
  SearchKnowledge: "Searching knowledge base...",
  // Research tools
  search_opinions: "Searching court opinions...",
  search_dockets: "Searching dockets...",
  lookup_citation: "Looking up citation...",
  search_statutes: "Searching statutes...",
  search_govinfo: "Searching government documents...",
  search_academic: "Searching academic papers...",
  search_lawyers: "Searching for lawyers...",
  // Explorer tools
  get_stats: "Querying knowledge graph...",
  search_nodes: "Searching legal provisions...",
  get_node: "Loading legal provision...",
  get_neighbors: "Finding related provisions...",
  find_similar: "Finding similar provisions...",
};

export function useActivityStatus(source: "chat" | "research"): string | null {
  const [status, setStatus] = useState<string | null>(null);

  const listener = useCallback(
    (data?: unknown) => {
      const d = data as ActivityStatusData | undefined;
      if (!d || d.source !== source) return;

      switch (d.phase) {
        case "tool-start":
          setStatus(
            d.tool ? (TOOL_LABELS[d.tool] ?? `Running ${d.tool}...`) : null,
          );
          break;
        case "generating":
          setStatus("Generating response...");
          break;
        case "tool-done":
        case "idle":
          setStatus(null);
          break;
      }
    },
    [source],
  );

  useServerEvent("activity-status", listener);

  return status;
}
