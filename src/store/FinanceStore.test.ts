import { describe, it, expect, vi } from "vitest";
import { FinanceStore } from "./FinanceStore";
import * as apiModule from "../lib/api";

vi.spyOn(apiModule.api.finances, "create").mockResolvedValue(null);
vi.spyOn(apiModule.api.finances, "update").mockResolvedValue(null);
vi.spyOn(apiModule.api.finances, "delete").mockResolvedValue(undefined);

function createStore() {
  return FinanceStore.create({ entries: [] });
}

describe("FinanceStore", () => {
  it("addEntry adds and calls api", async () => {
    const store = createStore();
    await store.addEntry({
      category: "income",
      subcategory: "salary",
      amount: 5000,
      date: "2025-01-15",
    });
    expect(store.entries).toHaveLength(1);
    expect(store.entries[0].amount).toBe(5000);
    expect(apiModule.api.finances.create).toHaveBeenCalled();
  });

  it("updateEntry updates and calls api", async () => {
    const store = createStore();
    await store.addEntry({
      category: "expense",
      subcategory: "rent",
      amount: 1200,
      date: "2025-01-01",
    });
    const id = store.entries[0].id;
    await store.updateEntry(id, { amount: 1300 });
    expect(store.entries[0].amount).toBe(1300);
    expect(apiModule.api.finances.update).toHaveBeenCalled();
  });

  it("deleteEntry removes and calls api", async () => {
    const store = createStore();
    await store.addEntry({
      category: "expense",
      subcategory: "food",
      amount: 200,
      date: "2025-01-01",
    });
    const id = store.entries[0].id;
    await store.deleteEntry(id);
    expect(store.entries).toHaveLength(0);
    expect(apiModule.api.finances.delete).toHaveBeenCalled();
  });
});
