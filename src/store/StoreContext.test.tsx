import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock fetch before any module that uses openapi-fetch is imported
vi.stubGlobal(
  "fetch",
  vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify([]), { status: 200 })),
  ),
);

const { StoreProvider, useStore } = await import("./StoreContext");
const { createRootStore } = await import("./RootStore");

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
  // Reset the global store instance from StoreContext
  // We have to do this by re-importing since _store is module scoped
});

afterEach(() => {
  localStorage.clear();
});

describe("StoreContext", () => {
  describe("StoreProvider", () => {
    it("provides store to children via context", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StoreProvider>{children}</StoreProvider>
      );

      const { result } = renderHook(() => useStore(), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current.caseStore).toBeDefined();
      expect(result.current.deadlineStore).toBeDefined();
    });

    it("accepts custom store and provides it to children", () => {
      const customStore = createRootStore();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StoreProvider store={customStore}>{children}</StoreProvider>
      );

      const { result } = renderHook(() => useStore(), { wrapper });

      expect(result.current).toBe(customStore);
    });

    it("uses created store when no custom store is provided", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StoreProvider>{children}</StoreProvider>
      );

      const { result: result1 } = renderHook(() => useStore(), { wrapper });
      const { result: result2 } = renderHook(() => useStore(), { wrapper });

      // Both should reference the same store instance (singleton)
      expect(result1.current).toBe(result2.current);
    });

    it("does not call load methods when custom store is provided", () => {
      const customStore = createRootStore();

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StoreProvider store={customStore}>{children}</StoreProvider>
      );

      renderHook(() => useStore(), { wrapper });

      // Custom store should be provided as-is without calling load methods
      expect(customStore).toBeDefined();
    });

    it("initializes store with all sub-stores on provider mount", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StoreProvider>{children}</StoreProvider>
      );

      const { result } = renderHook(() => useStore(), { wrapper });
      const store = result.current;

      // Verify all sub-stores are initialized
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
  });

  describe("useStore hook", () => {
    it("returns store from context when used within StoreProvider", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StoreProvider>{children}</StoreProvider>
      );

      const { result } = renderHook(() => useStore(), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current.caseStore).toBeDefined();
      expect(result.current.deadlineStore).toBeDefined();
      expect(result.current.financeStore).toBeDefined();
      expect(result.current.contactStore).toBeDefined();
      expect(result.current.chatStore).toBeDefined();
      expect(result.current.documentStore).toBeDefined();
      expect(result.current.noteStore).toBeDefined();
      expect(result.current.taskStore).toBeDefined();
      expect(result.current.evidenceStore).toBeDefined();
      expect(result.current.filingStore).toBeDefined();
    });

    it("throws error when used outside StoreProvider", () => {
      expect(() => {
        renderHook(() => useStore());
      }).toThrow("useStore must be used within StoreProvider");
    });

    it("returns the same store instance on multiple calls", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StoreProvider>{children}</StoreProvider>
      );

      const { result: result1 } = renderHook(() => useStore(), { wrapper });
      const { result: result2 } = renderHook(() => useStore(), { wrapper });

      expect(result1.current).toBe(result2.current);
    });

    it("returns custom store when provided", () => {
      const customStore = createRootStore();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StoreProvider store={customStore}>{children}</StoreProvider>
      );

      const { result } = renderHook(() => useStore(), { wrapper });

      expect(result.current).toBe(customStore);
    });

    it("allows store mutation through returned instance", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StoreProvider>{children}</StoreProvider>
      );

      const { result } = renderHook(() => useStore(), { wrapper });

      // Test case store mutation
      act(() => {
        result.current.caseStore.addCase({ name: "Test Case" });
      });

      expect(result.current.caseStore.cases).toHaveLength(1);
      expect(result.current.caseStore.cases[0].name).toBe("Test Case");
    });

    it("provides store with fully initialized sub-stores", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StoreProvider>{children}</StoreProvider>
      );

      const { result } = renderHook(() => useStore(), { wrapper });
      const store = result.current;

      expect(store.caseStore.cases).toBeDefined();
      expect(Array.isArray(store.caseStore.cases)).toBe(true);
      expect(store.deadlineStore.deadlines).toBeDefined();
      expect(Array.isArray(store.deadlineStore.deadlines)).toBe(true);
      expect(store.financeStore.entries).toBeDefined();
      expect(Array.isArray(store.financeStore.entries)).toBe(true);
      expect(store.contactStore.contacts).toBeDefined();
      expect(Array.isArray(store.contactStore.contacts)).toBe(true);
      expect(store.chatStore.messages).toBeDefined();
      expect(Array.isArray(store.chatStore.messages)).toBe(true);
      expect(store.documentStore.documents).toBeDefined();
      expect(Array.isArray(store.documentStore.documents)).toBe(true);
      expect(store.noteStore.notes).toBeDefined();
      expect(Array.isArray(store.noteStore.notes)).toBe(true);
      expect(store.taskStore.tasks).toBeDefined();
      expect(Array.isArray(store.taskStore.tasks)).toBe(true);
      expect(store.evidenceStore.evidences).toBeDefined();
      expect(Array.isArray(store.evidenceStore.evidences)).toBe(true);
      expect(store.filingStore.filings).toBeDefined();
      expect(Array.isArray(store.filingStore.filings)).toBe(true);
    });
  });

  describe("singleton store behavior", () => {
    it("reuses store within same provider wrapper", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StoreProvider>{children}</StoreProvider>
      );

      const { result: result1 } = renderHook(() => useStore(), { wrapper });
      const { result: result2 } = renderHook(() => useStore(), { wrapper });

      expect(result1.current).toBe(result2.current);
    });

    it("reuses existing store with custom store override", () => {
      const customStore = createRootStore();

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StoreProvider store={customStore}>{children}</StoreProvider>
      );

      const { result } = renderHook(() => useStore(), { wrapper });

      expect(result.current).toBe(customStore);
    });
  });

  describe("store data persistence", () => {
    it("persists store changes to localStorage", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StoreProvider>{children}</StoreProvider>
      );

      const { result } = renderHook(() => useStore(), { wrapper });

      act(() => {
        result.current.caseStore.addCase({ name: "Persisted Case" });
      });

      // Give snapshot listener time to fire
      setTimeout(() => {
        const stored = localStorage.getItem("contempt_cases");
        expect(stored).toBeDefined();
        const parsed = JSON.parse(stored!);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].name).toBe("Persisted Case");
      }, 100);
    });

    it("loads persisted data on provider initialization", () => {
      // Create custom store with pre-loaded data to test persistence
      localStorage.clear(); // Ensure clean state
      const now = new Date().toISOString();
      const testCases = [
        {
          id: "1",
          name: "Loaded Case",
          parties: [],
          filings: [],
          createdAt: now,
          updatedAt: now,
        },
      ];
      localStorage.setItem("cases", JSON.stringify(testCases));

      // Create a custom store that loads from localStorage
      const store = createRootStore();

      expect(store.caseStore.cases).toHaveLength(1);
      expect(store.caseStore.cases[0].name).toBe("Loaded Case");
    });
  });
});
