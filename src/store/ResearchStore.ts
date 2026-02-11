import { types, flow } from "mobx-state-tree";
import { v4 as uuidv4 } from "uuid";
import { ResearchMessageModel } from "./models/ResearchMessageModel";

interface ToolResultData {
  toolName: string;
  results: unknown;
}

export const ResearchStore = types
  .model("ResearchStore", {
    messages: types.array(ResearchMessageModel),
    isTyping: types.optional(types.boolean, false),
    sidebarResults: types.optional(types.frozen<ToolResultData[]>(), []),
    sidebarOpen: types.optional(types.boolean, true),
  })
  .views((self) => ({
    get latestToolResults() {
      const assistantMsgs = self.messages.filter(
        (m) => m.role === "assistant" && m.toolResults.length > 0,
      );
      if (assistantMsgs.length === 0) return [];
      return assistantMsgs[assistantMsgs.length - 1].toolResults;
    },
    get resultsByType() {
      const grouped: Record<string, ToolResultData[]> = {};
      for (const tr of self.sidebarResults) {
        const key = tr.toolName;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(tr);
      }
      return grouped;
    },
  }))
  .actions((self) => ({
    sendMessage: flow(function* (text: string) {
      const userMsg = {
        id: uuidv4(),
        role: "user" as const,
        text,
        createdAt: new Date().toISOString(),
        toolResults: [],
      };
      self.messages.push(userMsg);
      self.isTyping = true;

      let replyText: string;
      let toolResults: ToolResultData[] = [];

      try {
        const apiMessages = self.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.text }));

        const res: Response = yield fetch("/api/research/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages }),
        });

        if (!res.ok) throw new Error(`Research API error: ${res.status}`);
        const data: { reply: string; toolResults: ToolResultData[] } = yield res.json();
        replyText = data.reply;
        toolResults = data.toolResults || [];
      } catch {
        replyText =
          "Sorry, I couldn't reach the research service. Please check your API configuration in Settings.";
      }

      self.isTyping = false;

      const reply = {
        id: uuidv4(),
        role: "assistant" as const,
        text: replyText,
        createdAt: new Date().toISOString(),
        toolResults,
      };
      self.messages.push(reply);

      if (toolResults.length > 0) {
        self.sidebarResults = toolResults;
        self.sidebarOpen = true;
      }
    }),
    toggleSidebar() {
      self.sidebarOpen = !self.sidebarOpen;
    },
    clearMessages() {
      self.messages.clear();
      self.sidebarResults = [];
    },
  }));
