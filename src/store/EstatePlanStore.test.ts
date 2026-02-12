import { describe, it, expect, vi } from "vitest";
import { EstatePlanStore } from "./EstatePlanStore";
import * as apiModule from "../lib/api";

vi.spyOn(apiModule.api.estatePlans, "list").mockResolvedValue([]);
vi.spyOn(apiModule.api.estatePlans, "create").mockResolvedValue({} as any);
vi.spyOn(apiModule.api.estatePlans, "update").mockResolvedValue({} as any);
vi.spyOn(apiModule.api.estatePlans, "delete").mockResolvedValue(undefined);
vi.spyOn(apiModule.api.estatePlans, "addBeneficiary").mockResolvedValue(
  {} as any,
);
vi.spyOn(apiModule.api.estatePlans, "removeBeneficiary").mockResolvedValue(
  undefined,
);
vi.spyOn(apiModule.api.estatePlans, "addAsset").mockResolvedValue({} as any);
vi.spyOn(apiModule.api.estatePlans, "removeAsset").mockResolvedValue(undefined);
vi.spyOn(apiModule.api.estatePlans, "addDocument").mockResolvedValue({} as any);
vi.spyOn(apiModule.api.estatePlans, "updateDocument").mockResolvedValue(
  {} as any,
);
vi.spyOn(apiModule.api.estatePlans, "removeDocument").mockResolvedValue(
  undefined,
);

function createStore() {
  return EstatePlanStore.create({ plans: [] });
}

describe("EstatePlanStore", () => {
  it("loadPlans loads from api", async () => {
    const mockPlans = [
      {
        id: "1",
        title: "Test Plan",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    vi.spyOn(apiModule.api.estatePlans, "list").mockResolvedValue(
      mockPlans as any,
    );

    const store = createStore();
    await store.loadPlans();

    expect(store.plans).toHaveLength(1);
    expect(store.plans[0].title).toBe("Test Plan");
  });

  it("addPlan adds and calls api", async () => {
    const store = createStore();
    await store.addPlan({ title: "New Plan" });

    expect(store.plans).toHaveLength(1);
    expect(store.plans[0].title).toBe("New Plan");
    expect(apiModule.api.estatePlans.create).toHaveBeenCalled();
  });

  it("updatePlan updates and calls api", async () => {
    const store = createStore();
    await store.addPlan({ title: "Old" });
    const id = store.plans[0].id;
    await store.updatePlan(id, { title: "New" });

    expect(store.plans[0].title).toBe("New");
    expect(apiModule.api.estatePlans.update).toHaveBeenCalled();
  });

  it("deletePlan removes and calls api", async () => {
    const store = createStore();
    await store.addPlan({ title: "To Delete" });
    const id = store.plans[0].id;
    await store.deletePlan(id);

    expect(store.plans).toHaveLength(0);
    expect(apiModule.api.estatePlans.delete).toHaveBeenCalledWith(id);
  });

  it("filteredPlans filters by search query", async () => {
    const store = createStore();
    await store.addPlan({ title: "Apple" });
    await store.addPlan({ title: "Banana" });

    store.setSearchQuery("apple");
    expect(store.filteredPlans).toHaveLength(1);
    expect(store.filteredPlans[0].title).toBe("Apple");
  });

  it("filteredPlans filters by status", async () => {
    const store = createStore();
    await store.addPlan({ title: "P1" });
    await store.addPlan({ title: "P2" });
    const id = store.plans[1].id;
    await store.updatePlan(id, { status: "complete" });

    store.setSelectedStatus("complete");
    expect(store.filteredPlans).toHaveLength(1);
    expect(store.filteredPlans[0].title).toBe("P2");
  });

  it("addBeneficiary adds and calls api", async () => {
    const store = createStore();
    await store.addPlan({ title: "Plan" });
    const planId = store.plans[0].id;
    await store.addBeneficiary(planId, { name: "B1" });

    expect(store.plans[0].beneficiaries).toHaveLength(1);
    expect(store.plans[0].beneficiaries[0].name).toBe("B1");
    expect(apiModule.api.estatePlans.addBeneficiary).toHaveBeenCalled();
  });

  it("addAsset adds and calls api", async () => {
    const store = createStore();
    await store.addPlan({ title: "Plan" });
    const planId = store.plans[0].id;
    await store.addAsset(planId, { name: "A1", estimatedValue: 100 });

    expect(store.plans[0].assets).toHaveLength(1);
    expect(store.plans[0].assets[0].name).toBe("A1");
    expect(store.totalEstateValue).toBe(100);
    expect(apiModule.api.estatePlans.addAsset).toHaveBeenCalled();
  });

  it("addEstateDocument adds and calls api", async () => {
    const store = createStore();
    await store.addPlan({ title: "Plan" });
    const planId = store.plans[0].id;
    await store.addEstateDocument(planId, { title: "D1" });

    expect(store.plans[0].documents).toHaveLength(1);
    expect(store.plans[0].documents[0].title).toBe("D1");
    expect(apiModule.api.estatePlans.addDocument).toHaveBeenCalled();
  });
});
