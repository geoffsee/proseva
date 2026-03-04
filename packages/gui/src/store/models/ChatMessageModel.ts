import { types } from "mobx-state-tree";

export type ChatMessageMetadata = {
  events?: {
    id: string;
    stage: string;
    message: string;
    at: string;
    tool?: string;
    detail?: string;
  }[];
  sources?: {
    key: string;
    label: string;
    score?: number;
    preview?: string;
    pinned?: boolean;
  }[];
  toolSummaryText?: string | null;
};

export const ChatMessageModel = types.model("ChatMessage", {
  id: types.identifier,
  role: types.enumeration(["user", "assistant"]),
  text: types.string,
  createdAt: types.string,
  metadata: types.optional(types.frozen<ChatMessageMetadata | null>(), null),
});
