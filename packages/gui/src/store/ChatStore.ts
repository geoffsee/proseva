import { types, flow } from "mobx-state-tree";
import { v4 as uuidv4 } from "uuid";
import { ChatMessageModel } from "./models/ChatMessageModel";
import * as apiModule from "../lib/api";

const normalizeChatInput = (value: string): string =>
  value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

const ChatConversationModel = types.model("ChatConversation", {
  id: types.identifier,
  title: types.string,
  updatedAt: types.string,
  messages: types.array(ChatMessageModel),
});

export const ChatStore = types
  .model("ChatStore", {
    messages: types.array(ChatMessageModel),
    isTyping: types.optional(types.boolean, false),
    history: types.optional(types.array(ChatConversationModel), []),
    selectedHistoryId: types.optional(types.maybeNull(types.string), null),
  })
  .views((self) => ({
    get hasArchivedConversations() {
      return self.history.length > 0;
    },
    get historySorted() {
      return [...self.history].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    },
  }))
  .actions((self) => ({
    syncSelectedHistory() {
      if (!self.selectedHistoryId) return;
      const existing = self.history.find((h) => h.id === self.selectedHistoryId);
      if (!existing) return;
      existing.messages.replace(
        self.messages.map((m) => ({
          id: m.id,
          role: m.role,
          text: m.text,
          createdAt: m.createdAt,
        })),
      );
      existing.updatedAt = new Date().toISOString();
      const firstUser = self.messages.find((m) => m.role === "user")?.text ?? "";
      existing.title = firstUser.trim().slice(0, 80) || "Conversation";
    },

    sendMessage: flow(function* (text: string) {
      const normalizedText = normalizeChatInput(text);
      if (!normalizedText) return;
      const userMsg = {
        id: uuidv4(),
        role: "user" as const,
        text: normalizedText,
        createdAt: new Date().toISOString(),
      };
      self.messages.push(userMsg);

      self.isTyping = true;

      let replyText: string;
      try {
        const apiMessages = self.messages
          .slice(self.activeConversationStart)
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.text }));

        const data: { reply: string } =
          yield apiModule.api.chat.chat(apiMessages);
        replyText = data.reply;
      } catch {
        replyText =
          "Sorry, I couldn't reach the AI service. Please make sure the server is running and your OpenAI API key is set.";
      }

      self.isTyping = false;

      const reply = {
        id: uuidv4(),
        role: "assistant" as const,
        text: replyText,
        createdAt: new Date().toISOString(),
      };
      self.messages.push(reply);
      self.syncSelectedHistory();
    }),
    archiveConversation() {
      if (self.messages.length === 0) return;
      const now = new Date().toISOString();
      const firstUser = self.messages.find((m) => m.role === "user")?.text ?? "";
      const title = firstUser.trim().slice(0, 80) || "Conversation";
      if (self.selectedHistoryId) {
        const existing = self.history.find((h) => h.id === self.selectedHistoryId);
        if (existing) {
          existing.messages.replace(
            self.messages.map((m) => ({
              id: m.id,
              role: m.role,
              text: m.text,
              createdAt: m.createdAt,
            })),
          );
          existing.updatedAt = now;
          existing.title = title;
        } else {
          self.history.unshift({
            id: self.selectedHistoryId,
            title,
            updatedAt: now,
            messages: self.messages.map((m) => ({
              id: m.id,
              role: m.role,
              text: m.text,
              createdAt: m.createdAt,
            })),
          });
        }
      } else {
        self.history.unshift({
          id: uuidv4(),
          title,
          updatedAt: now,
          messages: self.messages.map((m) => ({
            id: m.id,
            role: m.role,
            text: m.text,
            createdAt: m.createdAt,
          })),
        });
      }
      self.selectedHistoryId = null;
      self.messages.clear();
    },
    loadConversation(id: string) {
      const selected = self.history.find((h) => h.id === id);
      if (!selected) return;
      self.messages.replace(
        selected.messages.map((m) => ({
          id: m.id,
          role: m.role,
          text: m.text,
          createdAt: m.createdAt,
        })),
      );
      self.selectedHistoryId = selected.id;
    },
    restoreArchivedConversations() {
      // Kept for backward compatibility with existing call sites.
      self.selectedHistoryId = null;
    },
    clearMessages() {
      self.messages.clear();
      self.selectedHistoryId = null;
    },
  }));
