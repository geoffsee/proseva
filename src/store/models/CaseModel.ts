import { types } from "mobx-state-tree";
import { PartyModel } from "./PartyModel";
import { FilingModel } from "./FilingModel";

export const CaseModel = types.model("Case", {
  id: types.identifier,
  name: types.string,
  caseNumber: types.optional(types.string, ""),
  court: types.optional(types.string, ""),
  caseType: types.optional(types.string, ""),
  status: types.optional(
    types.enumeration(["active", "closed", "pending"]),
    "active",
  ),
  parties: types.array(PartyModel),
  filings: types.array(FilingModel),
  notes: types.optional(types.string, ""),
  createdAt: types.string,
  updatedAt: types.string,
});
