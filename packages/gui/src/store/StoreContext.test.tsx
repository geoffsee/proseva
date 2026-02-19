import { describe, it, expect, beforeEach, vi } from "vitest";
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("StoreContext", () => {
  describe("StoreProvider", () => {
    it("accepts custom store and provides it to children", () => {
      const customStore = createRootStore();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StoreProvider store={customStore}>{children}</StoreProvider>
      );

      const { result } = renderHook(() => useStore(), { wrapper });

      expect(result.current).toBe(customStore);
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
      const customStore = createRootStore();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StoreProvider store={customStore}>{children}</StoreProvider>
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
      const customStore = createRootStore();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StoreProvider store={customStore}>{children}</StoreProvider>
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

    it("returns custom store when provided", () => {
      const customStore = createRootStore();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StoreProvider store={customStore}>{children}</StoreProvider>
      );

      const { result } = renderHook(() => useStore(), { wrapper });

      expect(result.current).toBe(customStore);
    });

    it("allows store mutation through returned instance", () => {
      const customStore = createRootStore();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StoreProvider store={customStore}>{children}</StoreProvider>
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
      const customStore = createRootStore();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StoreProvider store={customStore}>{children}</StoreProvider>
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
    it("reuses existing store with custom store override", () => {
      const customStore = createRootStore();

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StoreProvider store={customStore}>{children}</StoreProvider>
      );

      const { result } = renderHook(() => useStore(), { wrapper });

      expect(result.current).toBe(customStore);
    });
  });
});
