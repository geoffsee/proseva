import { types, flow } from "mobx-state-tree";
import { v4 as uuidv4 } from "uuid";
import { FilingModel } from "./models/FilingModel";
import type { Filing } from "../lib/api";
import { api } from "../lib/api";

export const FilingStore = types
  .model("FilingStore", {
    filings: types.array(FilingModel),
    selectedType: types.optional(types.string, "all"),
    selectedCaseId: types.optional(types.string, "all"),
    searchQuery: types.optional(types.string, ""),
    dateFrom: types.optional(types.string, ""),
    dateTo: types.optional(types.string, ""),
  })
  .views((self) => ({
    get sortedFilings() {
      return [...self.filings].sort((a, b) => {
        // Sort by date, most recent first
        return b.date.localeCompare(a.date);
      });
    },
    get filteredFilings() {
      return this.sortedFilings.filter((f) => {
        const matchesSearch =
          !self.searchQuery ||
          f.title.toLowerCase().includes(self.searchQuery.toLowerCase()) ||
          f.notes.toLowerCase().includes(self.searchQuery.toLowerCase());

        const matchesType =
          self.selectedType === "all" || f.type === self.selectedType;
        const matchesCase =
          self.selectedCaseId === "all" || f.caseId === self.selectedCaseId;

        const matchesDateFrom = !self.dateFrom || f.date >= self.dateFrom;
        const matchesDateTo = !self.dateTo || f.date <= self.dateTo;

        return (
          matchesSearch &&
          matchesType &&
          matchesCase &&
          matchesDateFrom &&
          matchesDateTo
        );
      });
    },
    get filingTypes() {
      const types = new Set(self.filings.map((f) => f.type).filter((t) => t));
      return Array.from(types).sort();
    },
  }))
  .actions((self) => ({
    loadFilings: flow(function* () {
      try {
        const filings: Filing[] | null = yield api.filings.list();
        if (filings && Array.isArray(filings)) {
          self.filings.replace(filings as any);
        }
      } catch (error) {
        console.error("Failed to load filings from API:", error);
      }
    }),
    addFiling: flow(function* (f: {
      title: string;
      date: string;
      type?: string;
      notes?: string;
      caseId?: string;
    }) {
      self.filings.push({
        id: uuidv4(),
        title: f.title,
        date: f.date,
        type: f.type ?? "",
        notes: f.notes ?? "",
        caseId: f.caseId ?? "",
      } as any);
      yield api.filings.create(f);
    }),
    updateFiling: flow(function* (
      id: string,
      updates: Record<string, unknown>,
    ) {
      const f = self.filings.find((f) => f.id === id);
      if (f) {
        Object.assign(f, updates);
        yield api.filings.update(id, updates);
      }
    }),
    deleteFiling: flow(function* (id: string) {
      const idx = self.filings.findIndex((f) => f.id === id);
      if (idx >= 0) {
        self.filings.splice(idx, 1);
        yield api.filings.delete(id);
      }
    }),
    setSelectedType(type: string) {
      self.selectedType = type;
    },
    setSelectedCaseId(caseId: string) {
      self.selectedCaseId = caseId;
    },
    setSearchQuery(query: string) {
      self.searchQuery = query;
    },
    setDateFrom(date: string) {
      self.dateFrom = date;
    },
    setDateTo(date: string) {
      self.dateTo = date;
    },
    clearFilters() {
      self.selectedType = "all";
      self.selectedCaseId = "all";
      self.searchQuery = "";
      self.dateFrom = "";
      self.dateTo = "";
    },
  }));
