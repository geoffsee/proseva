import { types } from "mobx-state-tree";

export const PartyModel = types.model("Party", {
  id: types.identifier,
  name: types.string,
  role: types.string,
  contact: types.optional(types.string, ""),
});
