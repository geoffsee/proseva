import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadFromStorage, saveToStorage } from "./storage";

const store = new Map<string, string>();

const fakeLocalStorage = {
  getItem: vi.fn((key: string) => store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    store.delete(key);
  }),
  clear: vi.fn(() => {
    store.clear();
  }),
} as unknown as Storage;

Object.defineProperty(globalThis, "localStorage", {
  value: fakeLocalStorage,
  writable: true,
});

describe("storage utilities", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  describe("loadFromStorage", () => {
    it("returns parsed value from localStorage when it exists", () => {
      const testData = { name: "test", value: 123 };
      store.set("test-key", JSON.stringify(testData));

      const result = loadFromStorage("test-key", { name: "", value: 0 });

      expect(result).toEqual(testData);
    });

    it("returns fallback when key does not exist", () => {
      const fallback = { name: "default", value: 0 };

      const result = loadFromStorage("non-existent-key", fallback);

      expect(result).toEqual(fallback);
    });

    it("returns fallback when localStorage contains invalid JSON", () => {
      store.set("bad-json", "{ invalid json }");
      const fallback = { name: "default" };

      const result = loadFromStorage("bad-json", fallback);

      expect(result).toEqual(fallback);
    });

    it("handles different data types", () => {
      const arrayData = [1, 2, 3];
      store.set("array-key", JSON.stringify(arrayData));

      const result = loadFromStorage("array-key", []);

      expect(result).toEqual(arrayData);
    });
  });

  describe("saveToStorage", () => {
    it("saves value to localStorage as JSON", () => {
      const testData = { name: "test", value: 123 };

      saveToStorage("test-key", testData);

      expect(store.get("test-key")).toBe(JSON.stringify(testData));
    });

    it("saves different data types", () => {
      const arrayData = [1, 2, 3];

      saveToStorage("array-key", arrayData);

      expect(store.get("array-key")).toBe(JSON.stringify(arrayData));
    });

    it("overwrites existing value", () => {
      saveToStorage("key", "old value");
      saveToStorage("key", "new value");

      expect(store.get("key")).toBe(JSON.stringify("new value"));
    });

    it("handles localStorage quota errors gracefully", () => {
      fakeLocalStorage.setItem = vi.fn(() => {
        throw new Error("QuotaExceededError");
      });

      expect(() => saveToStorage("key", "value")).not.toThrow();
    });
  });
});
