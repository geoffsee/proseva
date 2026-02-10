import { describe, it, expect, beforeEach, vi } from "vitest";
import { EvidenceStore } from "./EvidenceStore";
import * as apiModule from "../lib/api";

vi.spyOn(apiModule.api.evidences, "list").mockResolvedValue([]);
vi.spyOn(apiModule.api.evidences, "create").mockResolvedValue(null);
vi.spyOn(apiModule.api.evidences, "update").mockResolvedValue(null);
vi.spyOn(apiModule.api.evidences, "delete").mockResolvedValue(null);

function createStore() {
  return EvidenceStore.create({ evidences: [] });
}

describe("EvidenceStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("actions", () => {
    it("loadEvidences fetches and replaces evidences", async () => {
      const mockEvidences = [
        {
          id: "1",
          title: "Test Evidence",
          description: "Test",
          type: "document",
          caseId: "",
          exhibitNumber: "",
          fileUrl: "",
          dateCollected: "",
          location: "",
          tags: [],
          relevance: "medium",
          admissible: false,
          chain: [],
          notes: "",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        },
      ];
      vi.mocked(apiModule.api.evidences.list).mockResolvedValueOnce(
        mockEvidences as any,
      );

      const store = createStore();
      await store.loadEvidences();

      expect(store.evidences).toHaveLength(1);
      expect(store.evidences[0].title).toBe("Test Evidence");
    });

    it("addEvidence creates new evidence with defaults", async () => {
      const store = createStore();

      await store.addEvidence({
        title: "New Evidence",
      });

      expect(store.evidences).toHaveLength(1);
      expect(store.evidences[0].title).toBe("New Evidence");
      expect(store.evidences[0].type).toBe("other");
      expect(store.evidences[0].relevance).toBe("medium");
      expect(apiModule.api.evidences.create).toHaveBeenCalled();
    });

    it("updateEvidence updates existing evidence", async () => {
      const store = createStore();
      await store.addEvidence({ title: "Original" });

      const id = store.evidences[0].id;
      await store.updateEvidence(id, { title: "Updated" });

      expect(store.evidences[0].title).toBe("Updated");
      expect(apiModule.api.evidences.update).toHaveBeenCalledWith(
        id,
        expect.objectContaining({ title: "Updated" }),
      );
    });

    it("deleteEvidence removes evidence", async () => {
      const store = createStore();
      await store.addEvidence({ title: "To Delete" });

      const id = store.evidences[0].id;
      await store.deleteEvidence(id);

      expect(store.evidences).toHaveLength(0);
      expect(apiModule.api.evidences.delete).toHaveBeenCalledWith(id);
    });

    it("clearFilters resets all filters", () => {
      const store = createStore();
      store.setSelectedType("photo");
      store.setSelectedRelevance("high");
      store.setSearchQuery("test");

      store.clearFilters();

      expect(store.selectedType).toBe("all");
      expect(store.selectedRelevance).toBe("all");
      expect(store.searchQuery).toBe("");
    });

    it("addChainOfCustodyEntry adds chain entry", async () => {
      const store = createStore();
      await store.addEvidence({ title: "Evidence with Chain" });

      const id = store.evidences[0].id;
      await store.addChainOfCustodyEntry(id, {
        date: "2025-01-01",
        transferredTo: "John Doe",
        purpose: "Analysis",
      });

      expect(store.evidences[0].chain).toHaveLength(1);
      expect(store.evidences[0].chain[0].transferredTo).toBe("John Doe");
    });
  });

  describe("views", () => {
    it("sortedEvidences sorts by relevance then date", async () => {
      const store = createStore();
      await store.addEvidence({ title: "Low", relevance: "low" });
      await store.addEvidence({ title: "High", relevance: "high" });

      const sorted = store.sortedEvidences;

      expect(sorted[0].relevance).toBe("high");
      expect(sorted[1].relevance).toBe("low");
    });

    it("filteredEvidences filters by search query", async () => {
      const store = createStore();
      await store.addEvidence({
        title: "Important Document",
        description: "Critical info",
      });
      await store.addEvidence({ title: "Other Document" });

      store.setSearchQuery("important");

      expect(store.filteredEvidences).toHaveLength(1);
      expect(store.filteredEvidences[0].title).toBe("Important Document");
    });

    it("filteredEvidences filters by type", async () => {
      const store = createStore();
      await store.addEvidence({ title: "Photo", type: "photo" });
      await store.addEvidence({ title: "Document", type: "document" });

      store.setSelectedType("photo");

      expect(store.filteredEvidences).toHaveLength(1);
      expect(store.filteredEvidences[0].type).toBe("photo");
    });

    it("highRelevanceEvidences returns only high relevance items", async () => {
      const store = createStore();
      await store.addEvidence({ title: "High", relevance: "high" });
      await store.addEvidence({ title: "Medium", relevance: "medium" });

      expect(store.highRelevanceEvidences).toHaveLength(1);
      expect(store.highRelevanceEvidences[0].relevance).toBe("high");
    });

    it("admissibleEvidences returns only admissible items", async () => {
      const store = createStore();
      await store.addEvidence({ title: "Admissible", admissible: true });
      await store.addEvidence({ title: "Not Admissible", admissible: false });

      expect(store.admissibleEvidences).toHaveLength(1);
      expect(store.admissibleEvidences[0].admissible).toBe(true);
    });

    it("getEvidencesByCase filters by case ID", async () => {
      const store = createStore();
      await store.addEvidence({ title: "Case 1 Evidence", caseId: "case-1" });
      await store.addEvidence({ title: "Case 2 Evidence", caseId: "case-2" });

      const result = store.getEvidencesByCase("case-1");

      expect(result).toHaveLength(1);
      expect(result[0].caseId).toBe("case-1");
    });
  });
});
