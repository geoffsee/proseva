import { types, flow } from "mobx-state-tree";
import { v4 as uuidv4 } from "uuid";
import { FinancialEntryModel } from "./models/FinancialEntryModel";
import { api } from "../lib/api";

interface FinancialEntry {
  id: string;
  category: "income" | "expense";
  subcategory: string;
  amount: number;
  frequency: "one-time" | "weekly" | "biweekly" | "monthly" | "annually";
  date: string;
  description: string;
}

export const FinanceStore = types
  .model("FinanceStore", {
    entries: types.array(FinancialEntryModel),
  })
  .actions((self) => ({
    loadEntries: flow(function* () {
      try {
        const entries = (yield api.finances.list()) as FinancialEntry[];
        if (entries && Array.isArray(entries)) {
          self.entries.replace(entries);
        }
      } catch (error) {
        console.error("Failed to load finances from API:", error);
      }
    }),
    addEntry: flow(function* (e: {
      category: "income" | "expense";
      subcategory: string;
      amount: number;
      frequency?: "one-time" | "weekly" | "biweekly" | "monthly" | "annually";
      date: string;
      description?: string;
    }) {
      self.entries.push({
        id: uuidv4(),
        category: e.category,
        subcategory: e.subcategory,
        amount: e.amount,
        frequency: e.frequency ?? "one-time",
        date: e.date,
        description: e.description ?? "",
      });
      yield api.finances.create(e);
    }),
    updateEntry: flow(function* (id: string, updates: Record<string, unknown>) {
      const e = self.entries.find((e) => e.id === id);
      if (e) {
        Object.assign(e, updates);
        yield api.finances.update(id, updates);
      }
    }),
    deleteEntry: flow(function* (id: string) {
      const idx = self.entries.findIndex((e) => e.id === id);
      if (idx >= 0) {
        self.entries.splice(idx, 1);
        yield api.finances.delete(id);
      }
    }),
  }));
