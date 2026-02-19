import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRootStore } from "./RootStore";
import type { IRootStore } from "./RootStore";
import * as apiModule from "../lib/api";

// Mock API
vi.spyOn(apiModule.api.cases, "create").mockResolvedValue(null);
vi.spyOn(apiModule.api.cases, "update").mockResolvedValue(null);
vi.spyOn(apiModule.api.cases, "delete").mockResolvedValue(undefined);
vi.spyOn(apiModule.api.deadlines, "create").mockResolvedValue(null);
vi.spyOn(apiModule.api.deadlines, "update").mockResolvedValue(null);
vi.spyOn(apiModule.api.deadlines, "delete").mockResolvedValue(undefined);
vi.spyOn(apiModule.api.finances, "create").mockResolvedValue(null);
vi.spyOn(apiModule.api.finances, "update").mockResolvedValue(null);
vi.spyOn(apiModule.api.finances, "delete").mockResolvedValue(undefined);
vi.spyOn(apiModule.api.contacts, "create").mockResolvedValue(null);
vi.spyOn(apiModule.api.contacts, "update").mockResolvedValue(null);
vi.spyOn(apiModule.api.contacts, "delete").mockResolvedValue(undefined);
vi.spyOn(apiModule.api.notes, "create").mockResolvedValue(null);
vi.spyOn(apiModule.api.notes, "update").mockResolvedValue(null);
vi.spyOn(apiModule.api.notes, "delete").mockResolvedValue(undefined);
vi.spyOn(apiModule.api.evidences, "create").mockResolvedValue(null);
vi.spyOn(apiModule.api.evidences, "update").mockResolvedValue(null);
vi.spyOn(apiModule.api.evidences, "delete").mockResolvedValue(undefined);
vi.spyOn(apiModule.api.filings, "create").mockResolvedValue(null);
vi.spyOn(apiModule.api.filings, "update").mockResolvedValue(null);
vi.spyOn(apiModule.api.filings, "delete").mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RootStore", () => {
  describe("createRootStore", () => {
    it("creates a store with all required sub-stores", () => {
      const store = createRootStore();
      expect(store.caseStore).toBeDefined();
      expect(store.deadlineStore).toBeDefined();
      expect(store.financeStore).toBeDefined();
      expect(store.contactStore).toBeDefined();
      expect(store.chatStore).toBeDefined();
      expect(store.documentStore).toBeDefined();
      expect(store.noteStore).toBeDefined();
      expect(store.taskStore).toBeDefined();
      expect(store.evidenceStore).toBeDefined();
      expect(store.filingStore).toBeDefined();
    });

    it("initializes with empty collections", () => {
      const store = createRootStore();
      expect(store.caseStore.cases).toHaveLength(0);
      expect(store.deadlineStore.deadlines).toHaveLength(0);
      expect(store.financeStore.entries).toHaveLength(0);
      expect(store.contactStore.contacts).toHaveLength(0);
      expect(store.chatStore.messages).toHaveLength(0);
      expect(store.noteStore.notes).toHaveLength(0);
      expect(store.taskStore.tasks).toHaveLength(0);
      expect(store.evidenceStore.evidences).toHaveLength(0);
      expect(store.filingStore.filings).toHaveLength(0);
    });

    it("initializes deadlines with default filter values", () => {
      const store = createRootStore();
      expect(store.deadlineStore.selectedType).toBe("all");
      expect(store.deadlineStore.selectedUrgency).toBe("all");
      expect(store.deadlineStore.selectedCaseId).toBe("all");
      expect(store.deadlineStore.searchQuery).toBe("");
    });

    it("initializes evidences with default filter values", () => {
      const store = createRootStore();
      expect(store.evidenceStore.selectedType).toBe("all");
      expect(store.evidenceStore.selectedRelevance).toBe("all");
      expect(store.evidenceStore.selectedCaseId).toBe("all");
      expect(store.evidenceStore.selectedAdmissible).toBe("all");
      expect(store.evidenceStore.searchQuery).toBe("");
    });

    it("initializes filings with default filter values", () => {
      const store = createRootStore();
      expect(store.filingStore.selectedType).toBe("all");
      expect(store.filingStore.selectedCaseId).toBe("all");
      expect(store.filingStore.searchQuery).toBe("");
      expect(store.filingStore.dateFrom).toBe("");
      expect(store.filingStore.dateTo).toBe("");
    });

    it("supports store mutations", () => {
      const store = createRootStore();
      store.caseStore.addCase({ name: "New Case" });
      expect(store.caseStore.cases).toHaveLength(1);
      expect(store.caseStore.cases[0].name).toBe("New Case");
    });

    it("supports deadline mutations", () => {
      const store = createRootStore();
      store.deadlineStore.addDeadline({
        title: "New Deadline",
        date: "2025-02-01",
        type: "filing",
        caseId: "case1",
      });
      expect(store.deadlineStore.deadlines).toHaveLength(1);
    });

    it("supports finance mutations", () => {
      const store = createRootStore();
      store.financeStore.addEntry({
        description: "Test Fee",
        amount: 1000,
        date: "2025-01-01",
        category: "income",
        subcategory: "retainer",
      });
      expect(store.financeStore.entries).toHaveLength(1);
    });

    it("supports contact mutations", () => {
      const store = createRootStore();
      store.contactStore.addContact({
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "555-5678",
        role: "witness",
      });
      expect(store.contactStore.contacts).toHaveLength(1);
    });

    it("supports note mutations", () => {
      const store = createRootStore();
      store.noteStore.addNote({
        title: "Test Note",
        content: "Test content",
        category: "general",
        caseId: "case1",
      });
      expect(store.noteStore.notes).toHaveLength(1);
    });

    it("supports task mutations", () => {
      const store = createRootStore();
      store.taskStore.addTask({
        title: "Test Task",
        description: "Do something",
      });
      expect(store.taskStore.tasks).toHaveLength(1);
    });

    it("supports evidence mutations", () => {
      const store = createRootStore();
      store.evidenceStore.addEvidence({
        title: "Test Evidence",
        type: "document",
        caseId: "case1",
        relevance: "high",
        admissible: true,
      });
      expect(store.evidenceStore.evidences).toHaveLength(1);
    });

    it("supports filing mutations", () => {
      const store = createRootStore();
      store.filingStore.addFiling({
        caseId: "case1",
        title: "Test Filing",
        date: "2025-01-01",
        type: "motion",
      });
      expect(store.filingStore.filings).toHaveLength(1);
    });
  });

  describe("RootStore type", () => {
    it("has correct type structure", () => {
      const store = createRootStore();
      const testStore: IRootStore = store;
      expect(testStore).toBe(store);
    });
  });
});
