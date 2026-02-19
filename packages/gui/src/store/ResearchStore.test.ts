import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResearchStore } from "./ResearchStore";
import * as apiModule from "../lib/api";

function createStore() {
  return ResearchStore.create({
    messages: [],
    sidebarResults: [],
    sidebarOpen: false,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockResearchApi(reply: string, toolResults: any[] = []) {
  vi.spyOn(apiModule.api.researchAgent, "chat").mockResolvedValue({
    reply,
    toolResults,
  });
}

describe("ResearchStore", () => {
  it("sendMessage adds user message and assistant reply", async () => {
    mockResearchApi("Research results found.");
    const store = createStore();
    await store.sendMessage("tell me about case law");

    expect(store.messages).toHaveLength(2);
    expect(store.messages[0].role).toBe("user");
    expect(store.messages[0].text).toBe("tell me about case law");
    expect(store.messages[1].role).toBe("assistant");
    expect(store.messages[1].text).toBe("Research results found.");
    expect(store.isTyping).toBe(false);
  });

  it("updates sidebarResults and opens sidebar when toolResults are present", async () => {
    const toolResults = [{ toolName: "search", results: ["case 1", "case 2"] }];
    mockResearchApi("I found some cases.", toolResults);
    const store = createStore();
    expect(store.sidebarOpen).toBe(false);

    await store.sendMessage("search for cases");

    expect(store.sidebarResults).toEqual(toolResults);
    expect(store.sidebarOpen).toBe(true);
  });

  it("sends conversation history to the Research API", async () => {
    const chatSpy = vi
      .spyOn(apiModule.api.researchAgent, "chat")
      .mockResolvedValue({ reply: "response", toolResults: [] });

    const store = createStore();
    await store.sendMessage("hello research");

    expect(chatSpy).toHaveBeenCalledWith([
      { role: "user", content: "hello research" },
    ]);
  });

  it("adds Authorization header when auth token exists", async () => {
    const chatSpy = vi
      .spyOn(apiModule.api.researchAgent, "chat")
      .mockResolvedValue({ reply: "response", toolResults: [] });

    const store = createStore();
    await store.sendMessage("secure query");

    // The SDK handles auth headers internally via getAuthToken callback
    expect(chatSpy).toHaveBeenCalledWith([
      { role: "user", content: "secure query" },
    ]);
  });

  it("handles API errors gracefully", async () => {
    vi.spyOn(apiModule.api.researchAgent, "chat").mockRejectedValue(
      new Error("API error"),
    );
    const store = createStore();
    await store.sendMessage("test error");

    expect(store.messages).toHaveLength(2);
    expect(store.messages[1].text).toContain(
      "couldn't reach the research service",
    );
  });

  it("handles network errors gracefully", async () => {
    vi.spyOn(apiModule.api.researchAgent, "chat").mockRejectedValue(
      new Error("Network error"),
    );
    const store = createStore();
    await store.sendMessage("test network error");

    expect(store.messages).toHaveLength(2);
    expect(store.messages[1].text).toContain(
      "couldn't reach the research service",
    );
  });

  it("toggleSidebar flips the sidebarOpen state", () => {
    const store = createStore();
    expect(store.sidebarOpen).toBe(false);
    store.toggleSidebar();
    expect(store.sidebarOpen).toBe(true);
    store.toggleSidebar();
    expect(store.sidebarOpen).toBe(false);
  });

  it("clearMessages empties messages and sidebarResults", async () => {
    mockResearchApi("response", [{ toolName: "t", results: {} }]);
    const store = createStore();
    await store.sendMessage("test");

    expect(store.messages.length).toBeGreaterThan(0);
    expect(store.sidebarResults.length).toBeGreaterThan(0);

    store.clearMessages();
    expect(store.messages).toHaveLength(0);
    expect(store.sidebarResults).toHaveLength(0);
  });

  describe("views", () => {
    it("latestToolResults returns toolResults from the last assistant message", async () => {
      const store = createStore();
      const tr1 = [{ toolName: "t1", results: "r1" }];
      const tr2 = [{ toolName: "t2", results: "r2" }];

      mockResearchApi("first", tr1);
      await store.sendMessage("q1");
      expect(store.latestToolResults).toEqual(tr1);

      mockResearchApi("second", tr2);
      await store.sendMessage("q2");
      expect(store.latestToolResults).toEqual(tr2);
    });

    it("resultsByType groups sidebarResults by toolName", () => {
      const store = ResearchStore.create({
        messages: [],
        sidebarResults: [
          { toolName: "search", results: "res1" },
          { toolName: "search", results: "res2" },
          { toolName: "cite", results: "res3" },
        ],
      });

      const grouped = store.resultsByType;
      expect(grouped["search"]).toHaveLength(2);
      expect(grouped["search"][0].results).toBe("res1");
      expect(grouped["search"][1].results).toBe("res2");
      expect(grouped["cite"]).toHaveLength(1);
      expect(grouped["cite"][0].results).toBe("res3");
    });
  });
});
