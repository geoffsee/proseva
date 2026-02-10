import { describe, it, expect, beforeEach, vi } from "vitest";
import { FilingStore } from "./FilingStore";
import * as apiModule from "../lib/api";

vi.spyOn(apiModule.api.filings, "list").mockResolvedValue([]);
vi.spyOn(apiModule.api.filings, "create").mockResolvedValue(null);
vi.spyOn(apiModule.api.filings, "update").mockResolvedValue(null);
vi.spyOn(apiModule.api.filings, "delete").mockResolvedValue(null);

function createStore() {
  return FilingStore.create({ filings: [] });
}

describe("FilingStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("actions", () => {
    it("loadFilings fetches and replaces filings", async () => {
      const mockFilings = [
        {
          id: "1",
          title: "Test Filing",
          date: "2025-01-01",
          type: "motion",
          notes: "",
          caseId: "",
        },
      ];
      vi.mocked(apiModule.api.filings.list).mockResolvedValueOnce(mockFilings);

      const store = createStore();
      await store.loadFilings();

      expect(store.filings).toHaveLength(1);
      expect(store.filings[0].title).toBe("Test Filing");
    });

    it("addFiling creates new filing with defaults", async () => {
      const store = createStore();

      await store.addFiling({
        title: "New Filing",
        date: "2025-01-15",
      });

      expect(store.filings).toHaveLength(1);
      expect(store.filings[0].title).toBe("New Filing");
      expect(store.filings[0].type).toBe("");
      expect(apiModule.api.filings.create).toHaveBeenCalled();
    });

    it("updateFiling updates existing filing", async () => {
      const store = createStore();
      await store.addFiling({ title: "Original", date: "2025-01-01" });

      const id = store.filings[0].id;
      await store.updateFiling(id, { title: "Updated" });

      expect(store.filings[0].title).toBe("Updated");
      expect(apiModule.api.filings.update).toHaveBeenCalledWith(id, {
        title: "Updated",
      });
    });

    it("deleteFiling removes filing", async () => {
      const store = createStore();
      await store.addFiling({ title: "To Delete", date: "2025-01-01" });

      const id = store.filings[0].id;
      await store.deleteFiling(id);

      expect(store.filings).toHaveLength(0);
      expect(apiModule.api.filings.delete).toHaveBeenCalledWith(id);
    });

    it("clearFilters resets all filters", () => {
      const store = createStore();
      store.setSelectedType("motion");
      store.setSelectedCaseId("case-1");
      store.setSearchQuery("test");
      store.setDateFrom("2025-01-01");
      store.setDateTo("2025-01-31");

      store.clearFilters();

      expect(store.selectedType).toBe("all");
      expect(store.selectedCaseId).toBe("all");
      expect(store.searchQuery).toBe("");
      expect(store.dateFrom).toBe("");
      expect(store.dateTo).toBe("");
    });
  });

  describe("views", () => {
    it("sortedFilings sorts by date descending", async () => {
      const store = createStore();
      await store.addFiling({ title: "Old", date: "2025-01-01" });
      await store.addFiling({ title: "New", date: "2025-01-15" });

      const sorted = store.sortedFilings;

      expect(sorted[0].date).toBe("2025-01-15");
      expect(sorted[1].date).toBe("2025-01-01");
    });

    it("filteredFilings filters by search query", async () => {
      const store = createStore();
      await store.addFiling({ title: "Important Filing", date: "2025-01-01" });
      await store.addFiling({ title: "Other Filing", date: "2025-01-02" });

      store.setSearchQuery("important");

      expect(store.filteredFilings).toHaveLength(1);
      expect(store.filteredFilings[0].title).toBe("Important Filing");
    });

    it("filteredFilings filters by type", async () => {
      const store = createStore();
      await store.addFiling({
        title: "Motion",
        date: "2025-01-01",
        type: "motion",
      });
      await store.addFiling({
        title: "Brief",
        date: "2025-01-02",
        type: "brief",
      });

      store.setSelectedType("motion");

      expect(store.filteredFilings).toHaveLength(1);
      expect(store.filteredFilings[0].type).toBe("motion");
    });

    it("filteredFilings filters by case ID", async () => {
      const store = createStore();
      await store.addFiling({
        title: "Case 1 Filing",
        date: "2025-01-01",
        caseId: "case-1",
      });
      await store.addFiling({
        title: "Case 2 Filing",
        date: "2025-01-02",
        caseId: "case-2",
      });

      store.setSelectedCaseId("case-1");

      expect(store.filteredFilings).toHaveLength(1);
      expect(store.filteredFilings[0].caseId).toBe("case-1");
    });

    it("filteredFilings filters by date range", async () => {
      const store = createStore();
      await store.addFiling({ title: "Early", date: "2025-01-01" });
      await store.addFiling({ title: "Middle", date: "2025-01-15" });
      await store.addFiling({ title: "Late", date: "2025-01-30" });

      store.setDateFrom("2025-01-10");
      store.setDateTo("2025-01-20");

      expect(store.filteredFilings).toHaveLength(1);
      expect(store.filteredFilings[0].title).toBe("Middle");
    });

    it("filingTypes returns unique sorted types", async () => {
      const store = createStore();
      await store.addFiling({
        title: "Filing 1",
        date: "2025-01-01",
        type: "motion",
      });
      await store.addFiling({
        title: "Filing 2",
        date: "2025-01-02",
        type: "brief",
      });
      await store.addFiling({
        title: "Filing 3",
        date: "2025-01-03",
        type: "motion",
      });

      const types = store.filingTypes;

      expect(types).toEqual(["brief", "motion"]);
    });

    it("filingTypes filters out empty types", async () => {
      const store = createStore();
      await store.addFiling({
        title: "Filing 1",
        date: "2025-01-01",
        type: "motion",
      });
      await store.addFiling({
        title: "Filing 2",
        date: "2025-01-02",
        type: "",
      });

      const types = store.filingTypes;

      expect(types).toEqual(["motion"]);
    });
  });
});
