import { types, flow } from "mobx-state-tree";
import { v4 as uuidv4 } from "uuid";
import { ContactModel } from "./models/ContactModel";
import type { Contact } from "../lib/api";
import { api } from "../lib/api";

export const ContactStore = types
  .model("ContactStore", {
    contacts: types.array(ContactModel),
    searchQuery: types.optional(types.string, ""),
    selectedRole: types.optional(types.string, "all"),
    selectedCaseId: types.optional(types.string, "all"),
  })
  .views((self) => ({
    get filteredContacts() {
      return self.contacts.filter((c) => {
        const matchesSearch =
          !self.searchQuery ||
          c.name.toLowerCase().includes(self.searchQuery.toLowerCase()) ||
          c.organization
            .toLowerCase()
            .includes(self.searchQuery.toLowerCase()) ||
          c.email.toLowerCase().includes(self.searchQuery.toLowerCase()) ||
          c.notes.toLowerCase().includes(self.searchQuery.toLowerCase());

        const matchesRole =
          self.selectedRole === "all" || c.role === self.selectedRole;
        const matchesCase =
          self.selectedCaseId === "all" || c.caseId === self.selectedCaseId;

        return matchesSearch && matchesRole && matchesCase;
      });
    },
  }))
  .actions((self) => ({
    loadContacts: flow(function* () {
      try {
        const contacts: Contact[] | null = yield api.contacts.list();
        if (contacts && Array.isArray(contacts)) {
          self.contacts.replace(contacts as any);
        }
      } catch (error) {
        console.error("Failed to load contacts from API:", error);
      }
    }),
    addContact: flow(function* (c: {
      name: string;
      role:
        | "attorney"
        | "judge"
        | "clerk"
        | "witness"
        | "expert"
        | "opposing_party"
        | "other";
      organization?: string;
      phone?: string;
      email?: string;
      address?: string;
      notes?: string;
      caseId?: string;
    }) {
      self.contacts.push({
        id: uuidv4(),
        name: c.name,
        role: c.role,
        organization: c.organization ?? "",
        phone: c.phone ?? "",
        email: c.email ?? "",
        address: c.address ?? "",
        notes: c.notes ?? "",
        caseId: c.caseId ?? "",
      } as any);
      yield api.contacts.create(c);
    }),
    updateContact: flow(function* (
      id: string,
      updates: Record<string, unknown>,
    ) {
      const c = self.contacts.find((c) => c.id === id);
      if (c) {
        Object.assign(c, updates);
        yield api.contacts.update(id, updates);
      }
    }),
    deleteContact: flow(function* (id: string) {
      const idx = self.contacts.findIndex((c) => c.id === id);
      if (idx >= 0) {
        self.contacts.splice(idx, 1);
        yield api.contacts.delete(id);
      }
    }),
    setSearchQuery(query: string) {
      self.searchQuery = query;
    },
    setSelectedRole(role: string) {
      self.selectedRole = role;
    },
    setSelectedCaseId(caseId: string) {
      self.selectedCaseId = caseId;
    },
    clearFilters() {
      self.searchQuery = "";
      self.selectedRole = "all";
      self.selectedCaseId = "all";
    },
  }));
