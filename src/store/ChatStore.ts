import { types, flow } from "mobx-state-tree";
import { v4 as uuidv4 } from "uuid";
import { ChatMessageModel } from "./models/ChatMessageModel";

export const ChatStore = types
  .model("ChatStore", {
    messages: types.array(ChatMessageModel),
    isTyping: types.optional(types.boolean, false),
  })
  .actions((self) => ({
    sendMessage: flow(function* (text: string) {
      const userMsg = {
        id: uuidv4(),
        role: "user" as const,
        text,
        createdAt: new Date().toISOString(),
      };
      self.messages.push(userMsg);

      self.isTyping = true;

      let replyText: string;
      try {
        const apiMessages = self.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.text }));

        const res: Response = yield fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages }),
        });

        if (!res.ok) throw new Error(`Chat API error: ${res.status}`);
        const data: { reply: string } = yield res.json();
        replyText = data.reply;
      } catch (err) {
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
    }),
    clearMessages() {
      self.messages.clear();
    },
  }));
