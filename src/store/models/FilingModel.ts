import { types } from "mobx-state-tree";

export const FilingModel = types.model("Filing", {
  id: types.identifier,
  title: types.string,
  date: types.string,
  type: types.optional(types.string, ""),
  notes: types.optional(types.string, ""),
  caseId: types.optional(types.string, ""),
});
