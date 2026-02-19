import { types } from "mobx-state-tree";

export const NoteModel = types.model("Note", {
  id: types.identifier,
  title: types.string,
  content: types.string,
  category: types.enumeration([
    "case-notes",
    "research",
    "todo",
    "general",
    "other",
  ]),
  tags: types.array(types.string),
  caseId: types.optional(types.string, ""),
  createdAt: types.string,
  updatedAt: types.string,
  isPinned: types.optional(types.boolean, false),
});
