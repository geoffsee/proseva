import { describe, it, expect, vi } from "vitest";
import { DeadlineStore } from "./DeadlineStore";
import * as apiModule from "../lib/api";

vi.spyOn(apiModule.api.deadlines, "create").mockResolvedValue(null);
vi.spyOn(apiModule.api.deadlines, "update").mockResolvedValue(null);
vi.spyOn(apiModule.api.deadlines, "delete").mockResolvedValue(undefined);
vi.spyOn(apiModule.api.deadlines, "toggleComplete").mockResolvedValue(null);

function createStore() {
  return DeadlineStore.create({
    deadlines: [],
    selectedType: "all",
    selectedUrgency: "all",
    selectedCaseId: "all",
    searchQuery: "",
  });
}

describe("DeadlineStore", () => {
  it("addDeadline adds and calls api", async () => {
    const store = createStore();
    await store.addDeadline({ title: "File motion", date: "2025-03-01" });
    expect(store.deadlines).toHaveLength(1);
    expect(store.deadlines[0].title).toBe("File motion");
    expect(apiModule.api.deadlines.create).toHaveBeenCalled();
  });

  it("updateDeadline updates and calls api", async () => {
    const store = createStore();
    await store.addDeadline({ title: "Old", date: "2025-03-01" });
    const id = store.deadlines[0].id;
    await store.updateDeadline(id, { title: "New" });
    expect(store.deadlines[0].title).toBe("New");
    expect(apiModule.api.deadlines.update).toHaveBeenCalled();
  });

  it("deleteDeadline removes and calls api", async () => {
    const store = createStore();
    await store.addDeadline({ title: "Gone", date: "2025-03-01" });
    const id = store.deadlines[0].id;
    await store.deleteDeadline(id);
    expect(store.deadlines).toHaveLength(0);
    expect(apiModule.api.deadlines.delete).toHaveBeenCalled();
  });

  it("toggleComplete flips completed and calls api", async () => {
    const store = createStore();
    await store.addDeadline({ title: "T", date: "2025-03-01" });
    const id = store.deadlines[0].id;
    expect(store.deadlines[0].completed).toBe(false);
    await store.toggleComplete(id);
    expect(store.deadlines[0].completed).toBe(true);
    expect(apiModule.api.deadlines.toggleComplete).toHaveBeenCalled();
  });

  it("filters deadlines by search query", async () => {
    const store = createStore();
    await store.addDeadline({ title: "File motion", date: "2025-03-01" });
    await store.addDeadline({ title: "Court hearing", date: "2025-03-05" });
    store.setSearchQuery("motion");
    expect(store.filteredDeadlines).toHaveLength(1);
    expect(store.filteredDeadlines[0].title).toBe("File motion");
  });

  it("filters deadlines by type", async () => {
    const store = createStore();
    await store.addDeadline({
      title: "Filing deadline",
      date: "2025-03-01",
      type: "filing",
    });
    await store.addDeadline({
      title: "Hearing",
      date: "2025-03-05",
      type: "hearing",
    });
    store.setSelectedType("filing");
    expect(store.filteredDeadlines).toHaveLength(1);
    expect(store.filteredDeadlines[0].type).toBe("filing");
  });

  it("computes urgency correctly", async () => {
    const store = createStore();
    const today = new Date();
    const overdue = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const urgent = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const upcoming = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    await store.addDeadline({ title: "Overdue", date: overdue });
    await store.addDeadline({ title: "Urgent", date: urgent });
    await store.addDeadline({ title: "Upcoming", date: upcoming });

    expect(store.overdueDeadlines).toHaveLength(1);
    expect(store.urgentDeadlines).toHaveLength(1);
    expect(store.upcomingDeadlines).toHaveLength(1);
  });

  it("clears filters", async () => {
    const store = createStore();
    store.setSearchQuery("test");
    store.setSelectedType("filing");
    store.setSelectedUrgency("urgent");
    store.setSelectedCaseId("case-123");
    store.clearFilters();
    expect(store.searchQuery).toBe("");
    expect(store.selectedType).toBe("all");
    expect(store.selectedUrgency).toBe("all");
    expect(store.selectedCaseId).toBe("all");
  });
});
