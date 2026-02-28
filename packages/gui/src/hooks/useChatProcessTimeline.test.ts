import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

let capturedListener: ((data?: unknown) => void) | null = null;

vi.mock("./useServerEvents", () => ({
  useServerEvent: (event: string, listener: (data?: unknown) => void) => {
    if (event === "chat-process") {
      capturedListener = listener;
    }
  },
}));

import { useChatProcessTimeline } from "./useChatProcessTimeline";

describe("useChatProcessTimeline", () => {
  beforeEach(() => {
    capturedListener = null;
  });

  it("starts empty", () => {
    const { result } = renderHook(() => useChatProcessTimeline("chat"));
    expect(result.current.events).toHaveLength(0);
    expect(result.current.sources).toHaveLength(0);
    expect(result.current.currentMessage).toBeNull();
    expect(result.current.isRunning).toBe(false);
  });

  it("tracks run lifecycle and messages", () => {
    const { result } = renderHook(() => useChatProcessTimeline("chat"));

    act(() => {
      capturedListener?.({
        source: "chat",
        runId: "run-1",
        stage: "request-start",
        message: "Received your request.",
        at: "2026-02-25T20:00:00.000Z",
      });
    });

    expect(result.current.activeRunId).toBe("run-1");
    expect(result.current.events).toHaveLength(1);
    expect(result.current.isRunning).toBe(true);
    expect(result.current.toolSummaryText).toBeNull();

    act(() => {
      capturedListener?.({
        source: "chat",
        runId: "run-1",
        stage: "tool-summary-done",
        message: "Tool summary prepared.",
        at: "2026-02-25T20:00:01.000Z",
        data: {
          summary_text: "{\"intent\":\"custody law\"}",
        },
      });
    });

    expect(result.current.toolSummaryText).toBe("{\"intent\":\"custody law\"}");

    act(() => {
      capturedListener?.({
        source: "chat",
        runId: "run-1",
        stage: "final-generation-done",
        message: "Done.",
        at: "2026-02-25T20:00:02.000Z",
      });
    });

    expect(result.current.events.at(-1)?.message).toBe("Done.");
    expect(result.current.isRunning).toBe(false);
  });

  it("captures and ranks source metadata from retrieval events", () => {
    const { result } = renderHook(() => useChatProcessTimeline("chat"));

    act(() => {
      capturedListener?.({
        source: "chat",
        runId: "run-2",
        stage: "request-start",
        message: "Start",
        at: "2026-02-25T20:00:00.000Z",
      });

      capturedListener?.({
        source: "chat",
        runId: "run-2",
        stage: "tool-call-done",
        message: "Search knowledge completed.",
        at: "2026-02-25T20:00:01.000Z",
        data: {
          tool: "SearchKnowledge",
          sources: [
            {
              source: "virginia_code",
              source_id: "20-124.3",
              node_type: "section",
              score: 0.33,
            },
            {
              source: "constitution",
              source_id: "I-11",
              node_type: "constitution_section",
              score: 0.21,
            },
          ],
        },
      });
    });

    expect(result.current.sources).toHaveLength(2);
    expect(result.current.sources[0].label).toContain("virginia_code:20-124.3");
    expect(result.current.sources[0].score).toBe(0.33);
  });

  it("ignores events from other runs until a new request-start arrives", () => {
    const { result } = renderHook(() => useChatProcessTimeline("chat"));

    act(() => {
      capturedListener?.({
        source: "chat",
        runId: "run-a",
        stage: "request-start",
        message: "Start A",
        at: "2026-02-25T20:00:00.000Z",
      });
      capturedListener?.({
        source: "chat",
        runId: "run-b",
        stage: "tool-call-done",
        message: "Should be ignored",
        at: "2026-02-25T20:00:01.000Z",
      });
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].message).toBe("Start A");
  });

  it("resets tool summary text on a new run", () => {
    const { result } = renderHook(() => useChatProcessTimeline("chat"));

    act(() => {
      capturedListener?.({
        source: "chat",
        runId: "run-a",
        stage: "request-start",
        message: "Start A",
        at: "2026-02-25T20:00:00.000Z",
      });
      capturedListener?.({
        source: "chat",
        runId: "run-a",
        stage: "tool-summary-done",
        message: "Tool summary prepared.",
        at: "2026-02-25T20:00:01.000Z",
        data: { summary_text: "summary A" },
      });
    });

    expect(result.current.toolSummaryText).toBe("summary A");

    act(() => {
      capturedListener?.({
        source: "chat",
        runId: "run-b",
        stage: "request-start",
        message: "Start B",
        at: "2026-02-25T20:00:02.000Z",
      });
    });

    expect(result.current.toolSummaryText).toBeNull();
  });

  it("clears timeline state when reset is called", () => {
    const { result } = renderHook(() => useChatProcessTimeline("chat"));

    act(() => {
      capturedListener?.({
        source: "chat",
        runId: "run-reset",
        stage: "request-start",
        message: "Start",
        at: "2026-02-25T20:00:00.000Z",
      });
      capturedListener?.({
        source: "chat",
        runId: "run-reset",
        stage: "tool-summary-done",
        message: "Tool summary prepared.",
        at: "2026-02-25T20:00:01.000Z",
        data: {
          summary_text:
            '{"legal_chunks":[{"source":"virginia_code","source_id":"20-124.3"}]}',
        },
      });
    });

    expect(result.current.events.length).toBeGreaterThan(0);
    expect(result.current.sources.length).toBeGreaterThan(0);
    expect(result.current.toolSummaryText).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.activeRunId).toBeNull();
    expect(result.current.events).toHaveLength(0);
    expect(result.current.sources).toHaveLength(0);
    expect(result.current.toolSummaryText).toBeNull();
    expect(result.current.isRunning).toBe(false);
  });

  it("prefers legal_chunks from tool summary for displayed sources", () => {
    const { result } = renderHook(() => useChatProcessTimeline("chat"));

    act(() => {
      capturedListener?.({
        source: "chat",
        runId: "run-c",
        stage: "request-start",
        message: "Start",
        at: "2026-02-25T20:00:00.000Z",
      });
      capturedListener?.({
        source: "chat",
        runId: "run-c",
        stage: "tool-call-done",
        message: "GraphQL retrieval query completed.",
        at: "2026-02-25T20:00:01.000Z",
        data: {
          sources: [
            {
              source: "virginia_code",
              source_id: "23.1",
              node_type: "title",
            },
          ],
        },
      });
      capturedListener?.({
        source: "chat",
        runId: "run-c",
        stage: "tool-summary-done",
        message: "Tool summary prepared.",
        at: "2026-02-25T20:00:02.000Z",
        data: {
          summary_text:
            "```json\n{\"intent\":\"custody\",\"legal_chunks\":[{\"source\":\"virginia_code\",\"source_id\":\"20-124.3\",\"node_type\":\"section\",\"score\":0.91,\"direct_text_excerpt\":\"The court shall determine legal and physical custody...\"}]}\n```",
        },
      });
    });

    expect(result.current.sources).toHaveLength(1);
    expect(result.current.sources[0].label).toContain("virginia_code:20-124.3");
    expect(result.current.sources[0].label).not.toContain("23.1");
    expect(result.current.sources[0].score).toBe(0.91);
  });

});
