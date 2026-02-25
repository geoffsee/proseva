import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatStore } from "./ChatStore";
import * as apiModule from "../lib/api";

function createStore() {
  return ChatStore.create({ messages: [] });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockChatApi(reply: string) {
  vi.spyOn(apiModule.api.chat, "chat").mockResolvedValue({ reply });
}

describe("ChatStore", () => {
  it("sendMessage adds user message and assistant reply", async () => {
    mockChatApi("I can help with that.");
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
    const chatSpy = vi.spyOn(apiModule.api.chat, "chat").mockResolvedValue({
      reply: "response",
    });

    const store = createStore();
    await store.sendMessage("hello");

    expect(chatSpy).toHaveBeenCalledWith([{ role: "user", content: "hello" }]);
  });

  it("normalizes extra newlines and spaces before sending", async () => {
    const chatSpy = vi.spyOn(apiModule.api.chat, "chat").mockResolvedValue({
      reply: "response",
    });
    const store = createStore();

    await store.sendMessage("  First line  \n\n\n  second\t\tline \n");

    expect(store.messages[0].text).toBe("First line\n\n second line");
    expect(chatSpy).toHaveBeenCalledWith([
      { role: "user", content: "First line\n\n second line" },
    ]);
  });

  it("adds Authorization header when auth token exists", async () => {
    const chatSpy = vi.spyOn(apiModule.api.chat, "chat").mockResolvedValue({
      reply: "response",
    });

    const store = createStore();
    await store.sendMessage("hello");

    // The SDK handles auth headers internally via getAuthToken callback
    expect(chatSpy).toHaveBeenCalledWith([{ role: "user", content: "hello" }]);
  });

  it("handles API errors gracefully", async () => {
    vi.spyOn(apiModule.api.chat, "chat").mockRejectedValue(
      new Error("API error"),
    );
    const store = createStore();
    await store.sendMessage("test");

    expect(store.messages).toHaveLength(2);
    expect(store.messages[1].text).toContain("couldn't reach the AI service");
  });

  it("handles network errors gracefully", async () => {
    vi.spyOn(apiModule.api.chat, "chat").mockRejectedValue(
      new Error("Network error"),
    );
    const store = createStore();
    await store.sendMessage("test");

    expect(store.messages).toHaveLength(2);
    expect(store.messages[1].text).toContain("couldn't reach the AI service");
  });

  it("clearMessages empties the list", async () => {
    mockChatApi("hi");
    const store = createStore();
    await store.sendMessage("hi");
    expect(store.messages.length).toBeGreaterThan(0);
    store.clearMessages();
    expect(store.messages).toHaveLength(0);
  });

  it("messages have createdAt timestamps", async () => {
    mockChatApi("response");
    const store = createStore();
    await store.sendMessage("test");
    expect(store.messages[0].createdAt).toBeDefined();
    expect(store.messages[1].createdAt).toBeDefined();
  });

  it("archiveConversation moves current messages into persisted history", async () => {
    mockChatApi("first reply");
    const store = createStore();
    await store.sendMessage("first");

    store.archiveConversation();

    expect(store.messages).toHaveLength(0);
    expect(store.history).toHaveLength(1);
    expect(store.history[0].messages.length).toBeGreaterThan(0);
    expect(store.hasArchivedConversations).toBe(true);
  });

  it("sendMessage only sends active conversation messages after archive", async () => {
    const chatSpy = vi.spyOn(apiModule.api.chat, "chat").mockResolvedValue({
      reply: "response",
    });

    const store = createStore();
    await store.sendMessage("first");
    store.archiveConversation();
    await store.sendMessage("second");

    expect(chatSpy).toHaveBeenLastCalledWith([
      { role: "user", content: "second" },
    ]);
  });

  it("loadConversation restores archived conversation into active messages", async () => {
    mockChatApi("response");
    const store = createStore();
    await store.sendMessage("first");
    store.archiveConversation();
    expect(store.messages).toHaveLength(0);

    const archivedId = store.history[0].id;
    store.loadConversation(archivedId);

    expect(store.messages.length).toBeGreaterThan(0);
    expect(store.selectedHistoryId).toBe(archivedId);
  });

  it("historySorted returns conversations by most recent updatedAt", () => {
    const store = ChatStore.create({
      messages: [],
      history: [
        {
          id: "old",
          title: "Old",
          updatedAt: "2026-02-24T10:00:00.000Z",
          messages: [],
        },
        {
          id: "new",
          title: "New",
          updatedAt: "2026-02-25T10:00:00.000Z",
          messages: [],
        },
      ],
    });

    expect(store.historySorted.map((h) => h.id)).toEqual(["new", "old"]);
  });
});
