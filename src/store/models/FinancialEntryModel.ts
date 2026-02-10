import { types } from "mobx-state-tree";

export const FinancialEntryModel = types.model("FinancialEntry", {
  id: types.identifier,
  category: types.enumeration(["income", "expense"]),
  subcategory: types.string,
  amount: types.number,
  frequency: types.optional(
    types.enumeration([
      "one-time",
      "weekly",
      "biweekly",
      "monthly",
      "annually",
    ]),
    "one-time",
  ),
  date: types.string,
  description: types.optional(types.string, ""),
});
