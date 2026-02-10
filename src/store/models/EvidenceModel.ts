import { types } from "mobx-state-tree";

export const ChainOfCustodyEntryModel = types.model("ChainOfCustodyEntry", {
  id: types.identifier,
  date: types.string,
  transferredFrom: types.optional(types.string, ""),
  transferredTo: types.string,
  purpose: types.string,
  notes: types.optional(types.string, ""),
});

export const EvidenceModel = types.model("Evidence", {
  id: types.identifier,
  caseId: types.optional(types.string, ""),
  exhibitNumber: types.optional(types.string, ""),
  title: types.string,
  description: types.optional(types.string, ""),
  type: types.optional(
    types.enumeration([
      "document",
      "photo",
      "video",
      "audio",
      "physical",
      "testimony",
      "digital",
      "other",
    ]),
    "other",
  ),
  fileUrl: types.optional(types.string, ""),
  dateCollected: types.optional(types.string, ""),
  location: types.optional(types.string, ""),
  tags: types.array(types.string),
  relevance: types.optional(
    types.enumeration(["high", "medium", "low"]),
    "medium",
  ),
  admissible: types.optional(types.boolean, false),
  chain: types.array(ChainOfCustodyEntryModel),
  notes: types.optional(types.string, ""),
  createdAt: types.string,
  updatedAt: types.string,
});
