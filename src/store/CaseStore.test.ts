import { describe, it, expect, vi } from "vitest";
import { CaseStore } from "./CaseStore";
import * as apiModule from "../lib/api";

vi.spyOn(apiModule.api.cases, "create").mockResolvedValue(null);
vi.spyOn(apiModule.api.cases, "update").mockResolvedValue(null);
vi.spyOn(apiModule.api.cases, "delete").mockResolvedValue(undefined);
vi.spyOn(apiModule.api.cases, "addParty").mockResolvedValue(null);
vi.spyOn(apiModule.api.cases, "removeParty").mockResolvedValue(undefined);
vi.spyOn(apiModule.api.cases, "addFiling").mockResolvedValue(null);
vi.spyOn(apiModule.api.cases, "removeFiling").mockResolvedValue(undefined);

function createStore() {
  return CaseStore.create({ cases: [] });
}

describe("CaseStore", () => {
  it("addCase adds a case and calls api", async () => {
    const store = createStore();
    const id = await store.addCase({ name: "Test Case" });
    expect(store.cases).toHaveLength(1);
    expect(store.cases[0].name).toBe("Test Case");
    expect(id).toBeDefined();
    expect(apiModule.api.cases.create).toHaveBeenCalled();
  });

  it("updateCase updates and calls api", async () => {
    const store = createStore();
    const id = await store.addCase({ name: "Old" });
    await store.updateCase(id!, { name: "New" });
    expect(store.cases[0].name).toBe("New");
    expect(apiModule.api.cases.update).toHaveBeenCalled();
  });

  it("deleteCase removes and calls api", async () => {
    const store = createStore();
    const id = await store.addCase({ name: "Gone" });
    await store.deleteCase(id!);
    expect(store.cases).toHaveLength(0);
    expect(apiModule.api.cases.delete).toHaveBeenCalled();
  });

  it("addParty adds party and calls api", async () => {
    const store = createStore();
    const id = await store.addCase({ name: "C" });
    await store.addParty(id!, { name: "P", role: "witness" });
    expect(store.cases[0].parties).toHaveLength(1);
    expect(apiModule.api.cases.addParty).toHaveBeenCalled();
  });

  it("removeParty removes party and calls api", async () => {
    const store = createStore();
    const id = await store.addCase({ name: "C" });
    await store.addParty(id!, { name: "P", role: "witness" });
    const partyId = store.cases[0].parties[0].id;
    await store.removeParty(id!, partyId);
    expect(store.cases[0].parties).toHaveLength(0);
    expect(apiModule.api.cases.removeParty).toHaveBeenCalled();
  });

  it("addFiling adds filing and calls api", async () => {
    const store = createStore();
    const id = await store.addCase({ name: "C" });
    await store.addFiling(id!, { title: "F", date: "2025-01-01" });
    expect(store.cases[0].filings).toHaveLength(1);
    expect(apiModule.api.cases.addFiling).toHaveBeenCalled();
  });

  it("removeFiling removes filing and calls api", async () => {
    const store = createStore();
    const id = await store.addCase({ name: "C" });
    await store.addFiling(id!, { title: "F", date: "2025-01-01" });
    const filingId = store.cases[0].filings[0].id;
    await store.removeFiling(id!, filingId);
    expect(store.cases[0].filings).toHaveLength(0);
    expect(apiModule.api.cases.removeFiling).toHaveBeenCalled();
  });
});
