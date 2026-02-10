import { describe, it, expect, vi, beforeEach } from "vitest";
import { Database } from "./db";
import { InMemoryAdapter } from "./persistence";

describe("Database", () => {
  let adapter: InMemoryAdapter;
  let database: Database;

  beforeEach(() => {
    adapter = new InMemoryAdapter();
    database = new Database(adapter);
  });

  it("initializes with empty collections", () => {
    expect(database.cases.size).toBe(0);
    expect(database.contacts.size).toBe(0);
    expect(database.deadlines.size).toBe(0);
    expect(database.finances.size).toBe(0);
    expect(database.evidences.size).toBe(0);
    expect(database.filings.size).toBe(0);
  });

  it("loads existing data from adapter", () => {
    adapter.save({
      cases: { "1": { id: "1", name: "Test" } },
      contacts: {},
      deadlines: {},
      finances: {},
      evidences: {},
      filings: {},
    });
    const db2 = new Database(adapter);
    expect(db2.cases.size).toBe(1);
    expect(db2.cases.get("1")).toEqual({ id: "1", name: "Test" });
  });

  describe("persist", () => {
    it("debounces saves to the adapter", async () => {
      const saveSpy = vi.spyOn(adapter, "save");
      database.cases.set("1", { id: "1", name: "A" } as any);
      database.persist();
      database.persist();
      database.persist();

      // Not saved yet (debounced)
      expect(saveSpy).not.toHaveBeenCalled();

      // Wait for debounce
      await new Promise((r) => setTimeout(r, 150));
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("flush", () => {
    it("saves immediately and clears pending timeout", () => {
      const saveSpy = vi.spyOn(adapter, "save");
      database.cases.set("1", { id: "1", name: "A" } as any);
      database.persist(); // schedule debounced save
      database.flush(); // force immediate save

      expect(saveSpy).toHaveBeenCalledTimes(1);
      const saved = saveSpy.mock.calls[0][0];
      expect(saved.cases).toHaveProperty("1");
    });

    it("saves even without a pending persist", () => {
      const saveSpy = vi.spyOn(adapter, "save");
      database.flush();
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });
  });
});

describe("InMemoryAdapter", () => {
  it("round-trips data", () => {
    const adapter = new InMemoryAdapter();
    const data = { cases: { "1": { id: "1" } } };
    adapter.save(data as any);
    const loaded = adapter.load();
    expect(loaded).toEqual(data);
  });

  it("returns cloned data (no shared references)", () => {
    const adapter = new InMemoryAdapter();
    const data = { cases: { "1": { id: "1" } } };
    adapter.save(data as any);
    const a = adapter.load();
    const b = adapter.load();
    expect(a).not.toBe(b);
  });
});
