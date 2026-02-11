import { types } from "mobx-state-tree";

export const ToolResultModel = types.model("ToolResult", {
  toolName: types.string,
  results: types.frozen(),
});

export const ResearchMessageModel = types.model("ResearchMessage", {
  id: types.identifier,
  role: types.enumeration(["user", "assistant"]),
  text: types.string,
  createdAt: types.string,
  toolResults: types.optional(types.array(ToolResultModel), []),
});
