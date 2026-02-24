import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

let capturedListener: ((data?: unknown) => void) | null = null;

vi.mock("./useServerEvents", () => ({
  useServerEvent: (event: string, listener: (data?: unknown) => void) => {
    if (event === "activity-status") {
      capturedListener = listener;
    }
  },
}));

import { useActivityStatus } from "./useActivityStatus";

describe("useActivityStatus", () => {
  beforeEach(() => {
    capturedListener = null;
  });

  it("returns null initially", () => {
    const { result } = renderHook(() => useActivityStatus("chat"));
    expect(result.current).toBeNull();
  });

  it("subscribes to activity-status event", () => {
    renderHook(() => useActivityStatus("chat"));
    expect(capturedListener).toBeInstanceOf(Function);
  });

  it("shows user-friendly label on tool-start for known chat tools", () => {
    const { result } = renderHook(() => useActivityStatus("chat"));

    act(() => {
      capturedListener?.({
        source: "chat",
        phase: "tool-start",
        tool: "SearchKnowledge",
      });
    });

    expect(result.current).toBe("Searching knowledge base...");
  });

  it("shows user-friendly label on tool-start for known research tools", () => {
    const { result } = renderHook(() => useActivityStatus("research"));

    act(() => {
      capturedListener?.({
        source: "research",
        phase: "tool-start",
        tool: "search_opinions",
      });
    });

    expect(result.current).toBe("Searching court opinions...");
  });

  it("shows user-friendly label for explorer tools", () => {
    const { result } = renderHook(() => useActivityStatus("research"));

    act(() => {
      capturedListener?.({
        source: "research",
        phase: "tool-start",
        tool: "search_nodes",
      });
    });

    expect(result.current).toBe("Searching legal provisions...");
  });

  it("shows fallback label for unknown tools", () => {
    const { result } = renderHook(() => useActivityStatus("chat"));

    act(() => {
      capturedListener?.({
        source: "chat",
        phase: "tool-start",
        tool: "UnknownTool",
      });
    });

    expect(result.current).toBe("Running UnknownTool...");
  });

  it("shows 'Generating response...' on generating phase", () => {
    const { result } = renderHook(() => useActivityStatus("chat"));

    act(() => {
      capturedListener?.({ source: "chat", phase: "generating" });
    });

    expect(result.current).toBe("Generating response...");
  });

  it("returns null on tool-done phase", () => {
    const { result } = renderHook(() => useActivityStatus("chat"));

    // First set a tool-start status
    act(() => {
      capturedListener?.({
        source: "chat",
        phase: "tool-start",
        tool: "GetCases",
      });
    });
    expect(result.current).toBe("Loading cases...");

    // Then tool-done should clear it
    act(() => {
      capturedListener?.({
        source: "chat",
        phase: "tool-done",
        tool: "GetCases",
      });
    });
    expect(result.current).toBeNull();
  });

  it("returns null on idle phase", () => {
    const { result } = renderHook(() => useActivityStatus("chat"));

    // Set generating status first
    act(() => {
      capturedListener?.({ source: "chat", phase: "generating" });
    });
    expect(result.current).toBe("Generating response...");

    // Idle should clear it
    act(() => {
      capturedListener?.({ source: "chat", phase: "idle" });
    });
    expect(result.current).toBeNull();
  });

  it("filters events by source — ignores events for other source", () => {
    const { result } = renderHook(() => useActivityStatus("chat"));

    act(() => {
      capturedListener?.({
        source: "research",
        phase: "tool-start",
        tool: "search_opinions",
      });
    });

    // Should remain null because source doesn't match
    expect(result.current).toBeNull();
  });

  it("ignores events with no data", () => {
    const { result } = renderHook(() => useActivityStatus("chat"));

    act(() => {
      capturedListener?.(undefined);
    });

    expect(result.current).toBeNull();
  });

  it("maps all chat tool names to labels", () => {
    const { result } = renderHook(() => useActivityStatus("chat"));

    const chatTools = [
      ["GetCases", "Loading cases..."],
      ["GetDeadlines", "Checking deadlines..."],
      ["GetContacts", "Loading contacts..."],
      ["GetFinances", "Loading finances..."],
      ["GetDocuments", "Loading documents..."],
      ["GetDocumentText", "Reading document..."],
      ["SearchTimeline", "Searching timeline..."],
      ["SearchKnowledge", "Searching knowledge base..."],
    ] as const;

    for (const [tool, expected] of chatTools) {
      act(() => {
        capturedListener?.({ source: "chat", phase: "tool-start", tool });
      });
      expect(result.current).toBe(expected);
    }
  });
});
