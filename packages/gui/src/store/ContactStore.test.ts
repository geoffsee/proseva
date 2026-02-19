import { describe, it, expect, vi } from "vitest";
import { ContactStore } from "./ContactStore";
import * as apiModule from "../lib/api";

vi.spyOn(apiModule.api.contacts, "create").mockResolvedValue(null);
vi.spyOn(apiModule.api.contacts, "update").mockResolvedValue(null);
vi.spyOn(apiModule.api.contacts, "delete").mockResolvedValue(undefined);

function createStore() {
  return ContactStore.create({ contacts: [] });
}

describe("ContactStore", () => {
  it("addContact adds and calls api", async () => {
    const store = createStore();
    await store.addContact({ name: "Jane", role: "attorney" });
    expect(store.contacts).toHaveLength(1);
    expect(store.contacts[0].name).toBe("Jane");
    expect(apiModule.api.contacts.create).toHaveBeenCalled();
  });

  it("updateContact updates and calls api", async () => {
    const store = createStore();
    await store.addContact({ name: "Jane", role: "attorney" });
    const id = store.contacts[0].id;
    await store.updateContact(id, { name: "Janet" });
    expect(store.contacts[0].name).toBe("Janet");
    expect(apiModule.api.contacts.update).toHaveBeenCalled();
  });

  it("deleteContact removes and calls api", async () => {
    const store = createStore();
    await store.addContact({ name: "Jane", role: "attorney" });
    const id = store.contacts[0].id;
    await store.deleteContact(id);
    expect(store.contacts).toHaveLength(0);
    expect(apiModule.api.contacts.delete).toHaveBeenCalled();
  });
});
