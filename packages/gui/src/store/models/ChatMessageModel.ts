import { types } from "mobx-state-tree";

export const ChatMessageModel = types.model("ChatMessage", {
  id: types.identifier,
  role: types.enumeration(["user", "assistant"]),
  text: types.string,
  createdAt: types.string,
});
