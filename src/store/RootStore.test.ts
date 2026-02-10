import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createRootStore, RootStore } from "./RootStore";
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

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    writable: true,
  });
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  localStorage.clear();
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

    it("initializes empty stores when no localStorage data exists", () => {
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

    it("loads cases from localStorage", () => {
      const now = new Date().toISOString();
      const testCases = [
        {
          id: "1",
          name: "Test Case",
          parties: [],
          filings: [],
          createdAt: now,
          updatedAt: now,
        },
      ];
      localStorage.setItem("cases", JSON.stringify(testCases));

      const store = createRootStore();
      expect(store.caseStore.cases).toHaveLength(1);
      expect(store.caseStore.cases[0].name).toBe("Test Case");
    });

    it("loads deadlines from localStorage with filters", () => {
      const testDeadlines = [
        {
          id: "1",
          title: "Deadline 1",
          date: "2025-02-01",
          type: "filing",
          urgency: "high",
          caseId: "case1",
        },
      ];
      localStorage.setItem("deadlines", JSON.stringify(testDeadlines));

      const store = createRootStore();
      expect(store.deadlineStore.deadlines).toHaveLength(1);
      expect(store.deadlineStore.deadlines[0].title).toBe("Deadline 1");
      expect(store.deadlineStore.selectedType).toBe("all");
      expect(store.deadlineStore.selectedUrgency).toBe("all");
      expect(store.deadlineStore.selectedCaseId).toBe("all");
      expect(store.deadlineStore.searchQuery).toBe("");
    });

    it("loads finances from localStorage", () => {
      const testFinances = [
        {
          id: "1",
          description: "Fee",
          amount: 500,
          date: "2025-01-01",
          category: "income",
          subcategory: "retainer",
        },
      ];
      localStorage.setItem("finances", JSON.stringify(testFinances));

      const store = createRootStore();
      expect(store.financeStore.entries).toHaveLength(1);
      expect(store.financeStore.entries[0].description).toBe("Fee");
    });

    it("loads contacts from localStorage", () => {
      const testContacts = [
        {
          id: "1",
          name: "John Doe",
          email: "john@example.com",
          phone: "555-1234",
          role: "attorney",
        },
      ];
      localStorage.setItem("contacts", JSON.stringify(testContacts));

      const store = createRootStore();
      expect(store.contactStore.contacts).toHaveLength(1);
      expect(store.contactStore.contacts[0].name).toBe("John Doe");
    });

    it("loads chat messages from localStorage", () => {
      const testMessages = [
        {
          id: "1",
          text: "Hello",
          createdAt: new Date().toISOString(),
          role: "user",
        },
      ];
      localStorage.setItem("chat", JSON.stringify(testMessages));

      const store = createRootStore();
      expect(store.chatStore.messages).toHaveLength(1);
    });

    it("loads notes from localStorage", () => {
      const testNotes = [
        {
          id: "1",
          title: "Note",
          content: "Content",
          category: "general",
          tags: [],
          caseId: "case1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      localStorage.setItem("notes", JSON.stringify(testNotes));

      const store = createRootStore();
      expect(store.noteStore.notes).toHaveLength(1);
    });

    it("loads tasks from localStorage", () => {
      const now = new Date().toISOString();
      const testTasks = [
        {
          id: "1",
          title: "Task",
          description: "Do it",
          status: "todo",
          priority: "medium",
          dueDate: null,
          createdAt: now,
          updatedAt: now,
        },
      ];
      localStorage.setItem("tasks", JSON.stringify(testTasks));

      const store = createRootStore();
      expect(store.taskStore.tasks).toHaveLength(1);
    });

    it("loads evidences from localStorage with filters", () => {
      const now = new Date().toISOString();
      const testEvidences = [
        {
          id: "1",
          title: "Evidence",
          type: "document",
          caseId: "case1",
          relevance: "high",
          admissible: true,
          tags: [],
          chain: [],
          createdAt: now,
          updatedAt: now,
        },
      ];
      localStorage.setItem("evidences", JSON.stringify(testEvidences));

      const store = createRootStore();
      expect(store.evidenceStore.evidences).toHaveLength(1);
      expect(store.evidenceStore.selectedType).toBe("all");
      expect(store.evidenceStore.selectedRelevance).toBe("all");
      expect(store.evidenceStore.selectedCaseId).toBe("all");
      expect(store.evidenceStore.selectedAdmissible).toBe("all");
      expect(store.evidenceStore.searchQuery).toBe("");
    });

    it("loads filings from localStorage with filters", () => {
      const testFilings = [
        {
          id: "1",
          caseId: "case1",
          title: "Filing",
          date: "2025-01-01",
          type: "motion",
        },
      ];
      localStorage.setItem("filings", JSON.stringify(testFilings));

      const store = createRootStore();
      expect(store.filingStore.filings).toHaveLength(1);
      expect(store.filingStore.selectedType).toBe("all");
      expect(store.filingStore.selectedCaseId).toBe("all");
      expect(store.filingStore.searchQuery).toBe("");
      expect(store.filingStore.dateFrom).toBe("");
      expect(store.filingStore.dateTo).toBe("");
    });

    it("persists case changes to localStorage", () => {
      const store = createRootStore();
      store.caseStore.addCase({ name: "New Case" });

      const stored = localStorage.getItem("cases");
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe("New Case");
    });

    it("persists deadline changes to localStorage", () => {
      const store = createRootStore();
      store.deadlineStore.addDeadline({
        title: "New Deadline",
        date: "2025-02-01",
        type: "filing",
        caseId: "case1",
      });

      const stored = localStorage.getItem("deadlines");
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
    });

    it("persists finance changes to localStorage", () => {
      const store = createRootStore();
      store.financeStore.addEntry({
        description: "Test Fee",
        amount: 1000,
        date: "2025-01-01",
        category: "income",
        subcategory: "retainer",
      });

      const stored = localStorage.getItem("finances");
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
    });

    it("persists contact changes to localStorage", () => {
      const store = createRootStore();
      store.contactStore.addContact({
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "555-5678",
        role: "witness",
      });

      const stored = localStorage.getItem("contacts");
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
    });

    it("loads persisted chat messages on store creation", () => {
      const testMessages = [
        {
          id: "1",
          text: "Message 1",
          role: "user" as const,
          createdAt: new Date().toISOString(),
        },
        {
          id: "2",
          text: "Message 2",
          role: "assistant" as const,
          createdAt: new Date().toISOString(),
        },
      ];
      localStorage.setItem("chat", JSON.stringify(testMessages));

      const store = createRootStore();
      expect(store.chatStore.messages).toHaveLength(2);
      expect(store.chatStore.messages[0].text).toBe("Message 1");
    });

    it("persists note changes to localStorage", () => {
      const store = createRootStore();
      store.noteStore.addNote({
        title: "Test Note",
        content: "Test content",
        category: "general",
        caseId: "case1",
      });

      const stored = localStorage.getItem("notes");
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
    });

    it("persists task changes to localStorage", () => {
      const store = createRootStore();
      store.taskStore.addTask({
        title: "Test Task",
        description: "Do something",
      });

      const stored = localStorage.getItem("tasks");
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
    });

    it("persists evidence changes to localStorage", () => {
      const store = createRootStore();
      store.evidenceStore.addEvidence({
        title: "Test Evidence",
        type: "document",
        caseId: "case1",
        relevance: "high",
        admissible: true,
      });

      const stored = localStorage.getItem("evidences");
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
    });

    it("persists filing changes to localStorage", () => {
      const store = createRootStore();
      store.filingStore.addFiling({
        caseId: "case1",
        title: "Test Filing",
        date: "2025-01-01",
        type: "motion",
      });

      const stored = localStorage.getItem("filings");
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
    });

    it("handles corrupt JSON gracefully", () => {
      localStorage.setItem("cases", "invalid json {");
      const store = createRootStore();
      expect(store.caseStore.cases).toHaveLength(0);
    });

    it("handles null localStorage values gracefully", () => {
      localStorage.removeItem("cases");
      const store = createRootStore();
      expect(store.caseStore.cases).toHaveLength(0);
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
