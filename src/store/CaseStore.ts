import { types, flow } from "mobx-state-tree";
import { v4 as uuidv4 } from "uuid";
import { CaseModel } from "./models/CaseModel";
import type { Case } from "../lib/api";
import { api } from "../lib/api";

export const CaseStore = types
  .model("CaseStore", {
    cases: types.array(CaseModel),
  })
  .actions((self) => ({
    loadCases: flow(function* () {
      try {
        const cases: Case[] | null = yield api.cases.list();
        if (cases && Array.isArray(cases)) {
          self.cases.replace(cases as any);
        }
      } catch (error) {
        console.error("Failed to load cases from API:", error);
      }
    }),
    addCase: flow(function* (c: {
      name: string;
      caseNumber?: string;
      court?: string;
      caseType?: string;
      status?: "active" | "closed" | "pending";
      notes?: string;
    }) {
      const now = new Date().toISOString();
      const id = uuidv4();
      self.cases.push({
        id,
        name: c.name,
        caseNumber: c.caseNumber ?? "",
        court: c.court ?? "",
        caseType: c.caseType ?? "",
        status: c.status ?? "active",
        notes: c.notes ?? "",
        parties: [],
        filings: [],
        createdAt: now,
        updatedAt: now,
      } as any);
      yield api.cases.create(c);
      return id;
    }),
    updateCase: flow(function* (id: string, updates: Record<string, unknown>) {
      const c = self.cases.find((c) => c.id === id);
      if (c) {
        Object.assign(c, { ...updates, updatedAt: new Date().toISOString() });
        yield api.cases.update(id, updates);
      }
    }),
    deleteCase: flow(function* (id: string) {
      const idx = self.cases.findIndex((c) => c.id === id);
      if (idx >= 0) {
        self.cases.splice(idx, 1);
        yield api.cases.delete(id);
      }
    }),
    addParty: flow(function* (
      caseId: string,
      party: { name: string; role: string; contact?: string },
    ) {
      const c = self.cases.find((c) => c.id === caseId);
      if (c) {
        c.parties.push({
          id: uuidv4(),
          name: party.name,
          role: party.role,
          contact: party.contact ?? "",
        });
        c.updatedAt = new Date().toISOString();
        yield api.cases.addParty(caseId, party);
      }
    }),
    removeParty: flow(function* (caseId: string, partyId: string) {
      const c = self.cases.find((c) => c.id === caseId);
      if (c) {
        const idx = c.parties.findIndex((p) => p.id === partyId);
        if (idx >= 0) c.parties.splice(idx, 1);
        c.updatedAt = new Date().toISOString();
        yield api.cases.removeParty(caseId, partyId);
      }
    }),
    addFiling: flow(function* (
      caseId: string,
      filing: { title: string; date: string; type?: string; notes?: string },
    ) {
      const c = self.cases.find((c) => c.id === caseId);
      if (c) {
        c.filings.push({
          id: uuidv4(),
          title: filing.title,
          date: filing.date,
          type: filing.type ?? "",
          notes: filing.notes ?? "",
        });
        c.updatedAt = new Date().toISOString();
        yield api.cases.addFiling(caseId, filing);
      }
    }),
    removeFiling: flow(function* (caseId: string, filingId: string) {
      const c = self.cases.find((c) => c.id === caseId);
      if (c) {
        const idx = c.filings.findIndex((f) => f.id === filingId);
        if (idx >= 0) c.filings.splice(idx, 1);
        c.updatedAt = new Date().toISOString();
        yield api.cases.removeFiling(caseId, filingId);
      }
    }),
  }));
