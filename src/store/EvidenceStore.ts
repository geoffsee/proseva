import { types, flow } from "mobx-state-tree";
import { v4 as uuidv4 } from "uuid";
import { EvidenceModel } from "./models/EvidenceModel";
import { api } from "../lib/api";

export const EvidenceStore = types
  .model("EvidenceStore", {
    evidences: types.array(EvidenceModel),
    selectedType: types.optional(types.string, "all"),
    selectedRelevance: types.optional(types.string, "all"),
    selectedCaseId: types.optional(types.string, "all"),
    selectedAdmissible: types.optional(types.string, "all"),
    searchQuery: types.optional(types.string, ""),
  })
  .views((self) => ({
    get sortedEvidences() {
      return [...self.evidences].sort((a, b) => {
        // Sort by relevance first (high > medium > low)
        const relevancePriority: Record<string, number> = {
          high: 1,
          medium: 2,
          low: 3,
        };
        const aPriority = relevancePriority[a.relevance];
        const bPriority = relevancePriority[b.relevance];

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        // Then by creation date (most recent first)
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    },
    get filteredEvidences() {
      return this.sortedEvidences.filter((e) => {
        const matchesSearch =
          !self.searchQuery ||
          e.title.toLowerCase().includes(self.searchQuery.toLowerCase()) ||
          e.description
            .toLowerCase()
            .includes(self.searchQuery.toLowerCase()) ||
          e.exhibitNumber
            .toLowerCase()
            .includes(self.searchQuery.toLowerCase()) ||
          e.tags.some((tag) =>
            tag.toLowerCase().includes(self.searchQuery.toLowerCase()),
          );

        const matchesType =
          self.selectedType === "all" || e.type === self.selectedType;
        const matchesRelevance =
          self.selectedRelevance === "all" ||
          e.relevance === self.selectedRelevance;
        const matchesCase =
          self.selectedCaseId === "all" || e.caseId === self.selectedCaseId;
        const matchesAdmissible =
          self.selectedAdmissible === "all" ||
          (self.selectedAdmissible === "admissible" && e.admissible) ||
          (self.selectedAdmissible === "inadmissible" && !e.admissible);

        return (
          matchesSearch &&
          matchesType &&
          matchesRelevance &&
          matchesCase &&
          matchesAdmissible
        );
      });
    },
    get highRelevanceEvidences() {
      return self.evidences.filter((e) => e.relevance === "high");
    },
    get admissibleEvidences() {
      return self.evidences.filter((e) => e.admissible);
    },
    getEvidencesByCase(caseId: string) {
      return self.evidences.filter((e) => e.caseId === caseId);
    },
  }))
  .actions((self) => ({
    loadEvidences: flow(function* () {
      try {
        const evidences: any[] = yield api.evidences.list();
        if (evidences && Array.isArray(evidences)) {
          self.evidences.replace(evidences as any);
        }
      } catch (error) {
        console.error("Failed to load evidences from API:", error);
      }
    }),
    addEvidence: flow(function* (e: {
      title: string;
      description?: string;
      type?:
        | "document"
        | "photo"
        | "video"
        | "audio"
        | "physical"
        | "testimony"
        | "digital"
        | "other";
      caseId?: string;
      exhibitNumber?: string;
      fileUrl?: string;
      dateCollected?: string;
      location?: string;
      tags?: string[];
      relevance?: "high" | "medium" | "low";
      admissible?: boolean;
      notes?: string;
    }) {
      const now = new Date().toISOString();
      const newEvidence = {
        id: uuidv4(),
        title: e.title,
        description: e.description ?? "",
        type: e.type ?? "other",
        caseId: e.caseId ?? "",
        exhibitNumber: e.exhibitNumber ?? "",
        fileUrl: e.fileUrl ?? "",
        dateCollected: e.dateCollected ?? "",
        location: e.location ?? "",
        tags: e.tags ?? [],
        relevance: e.relevance ?? "medium",
        admissible: e.admissible ?? false,
        chain: [],
        notes: e.notes ?? "",
        createdAt: now,
        updatedAt: now,
      };
      self.evidences.push(newEvidence as any);
      yield api.evidences.create(newEvidence);
    }),
    updateEvidence: flow(function* (
      id: string,
      updates: Record<string, unknown>,
    ) {
      const e = self.evidences.find((e) => e.id === id);
      if (e) {
        Object.assign(e, { ...updates, updatedAt: new Date().toISOString() });
        yield api.evidences.update(id, { ...updates, updatedAt: e.updatedAt });
      }
    }),
    deleteEvidence: flow(function* (id: string) {
      const idx = self.evidences.findIndex((e) => e.id === id);
      if (idx >= 0) {
        self.evidences.splice(idx, 1);
        yield api.evidences.delete(id);
      }
    }),
    addChainOfCustodyEntry: flow(function* (
      evidenceId: string,
      entry: {
        date: string;
        transferredFrom?: string;
        transferredTo: string;
        purpose: string;
        notes?: string;
      },
    ) {
      const e = self.evidences.find((e) => e.id === evidenceId);
      if (e) {
        const chainEntry = {
          id: uuidv4(),
          date: entry.date,
          transferredFrom: entry.transferredFrom ?? "",
          transferredTo: entry.transferredTo,
          purpose: entry.purpose,
          notes: entry.notes ?? "",
        };
        e.chain.push(chainEntry as any);
        e.updatedAt = new Date().toISOString();
        yield api.evidences.update(evidenceId, {
          chain: e.chain.map((c) => ({ ...c })),
          updatedAt: e.updatedAt,
        });
      }
    }),
    setSelectedType(type: string) {
      self.selectedType = type;
    },
    setSelectedRelevance(relevance: string) {
      self.selectedRelevance = relevance;
    },
    setSelectedCaseId(caseId: string) {
      self.selectedCaseId = caseId;
    },
    setSelectedAdmissible(admissible: string) {
      self.selectedAdmissible = admissible;
    },
    setSearchQuery(query: string) {
      self.searchQuery = query;
    },
    clearFilters() {
      self.selectedType = "all";
      self.selectedRelevance = "all";
      self.selectedCaseId = "all";
      self.selectedAdmissible = "all";
      self.searchQuery = "";
    },
  }));
