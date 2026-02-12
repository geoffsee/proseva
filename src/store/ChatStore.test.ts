import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatStore } from "./ChatStore";
import * as apiModule from "../lib/api";

function createStore() {
  return ChatStore.create({ messages: [] });
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(apiModule, "getAuthToken").mockResolvedValue(null);
});

function mockFetch(reply: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ reply }),
    }),
  );
}

describe("ChatStore", () => {
  it("sendMessage adds user message and assistant reply", async () => {
    mockFetch("I can help with that.");
    const store = createStore();
    await store.sendMessage("hello");

    expect(store.messages).toHaveLength(2);
    expect(store.messages[0].role).toBe("user");
    expect(store.messages[0].text).toBe("hello");
    expect(store.messages[1].role).toBe("assistant");
    expect(store.messages[1].text).toBe("I can help with that.");
    expect(store.isTyping).toBe(false);
  });

  it("sends conversation history to the API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ reply: "response" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const store = createStore();
    await store.sendMessage("hello");

    expect(fetchMock).toHaveBeenCalledWith("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: expect.stringContaining('"hello"'),
    });
  });

  it("adds Authorization header when auth token exists", async () => {
    vi.spyOn(apiModule, "getAuthToken").mockResolvedValue("test-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ reply: "response" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const store = createStore();
    await store.sendMessage("hello");

    expect(fetchMock).toHaveBeenCalledWith("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: expect.stringContaining('"hello"'),
    });
  });

  it("handles API errors gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    const store = createStore();
    await store.sendMessage("test");

    expect(store.messages).toHaveLength(2);
    expect(store.messages[1].text).toContain("couldn't reach the AI service");
  });

  it("handles network errors gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );
    const store = createStore();
    await store.sendMessage("test");

    expect(store.messages).toHaveLength(2);
    expect(store.messages[1].text).toContain("couldn't reach the AI service");
  });

  it("clearMessages empties the list", async () => {
    mockFetch("hi");
    const store = createStore();
    await store.sendMessage("hi");
    expect(store.messages.length).toBeGreaterThan(0);
    store.clearMessages();
    expect(store.messages).toHaveLength(0);
  });

  it("messages have createdAt timestamps", async () => {
    mockFetch("response");
    const store = createStore();
    await store.sendMessage("test");
    expect(store.messages[0].createdAt).toBeDefined();
    expect(store.messages[1].createdAt).toBeDefined();
  });
});
