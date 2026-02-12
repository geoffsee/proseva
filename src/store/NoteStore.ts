import { types, flow } from "mobx-state-tree";
import { v4 as uuidv4 } from "uuid";
import { NoteModel } from "./models/NoteModel";
import type { Note } from "../types";
import { api } from "../lib/api";

export const NoteStore = types
  .model("NoteStore", {
    notes: types.array(NoteModel),
    searchQuery: types.optional(types.string, ""),
    selectedCategory: types.optional(types.string, "all"),
    selectedTags: types.array(types.string),
  })
  .views((self) => ({
    // Computed view for filtered notes based on search and filters
    get filteredNotes() {
      let filtered = [...self.notes];

      // Filter by search query (search in title and content)
      if (self.searchQuery.trim()) {
        const query = self.searchQuery.toLowerCase();
        filtered = filtered.filter(
          (n) =>
            n.title.toLowerCase().includes(query) ||
            n.content.toLowerCase().includes(query),
        );
      }

      // Filter by category
      if (self.selectedCategory !== "all") {
        filtered = filtered.filter((n) => n.category === self.selectedCategory);
      }

      // Filter by tags (note must have ALL selected tags)
      if (self.selectedTags.length > 0) {
        filtered = filtered.filter((n) =>
          self.selectedTags.every((tag) => n.tags.includes(tag)),
        );
      }

      return filtered;
    },

    // Get all unique tags across all notes
    get allTags() {
      const tagSet = new Set<string>();
      self.notes.forEach((note) => {
        note.tags.forEach((tag) => tagSet.add(tag));
      });
      return Array.from(tagSet).sort();
    },

    // Get notes by category for statistics
    getNotesByCategory(category: string) {
      return self.notes.filter((n) => n.category === category);
    },

    // Get notes by case ID
    getNotesByCase(caseId: string) {
      return self.notes.filter((n) => n.caseId === caseId);
    },

    // Get pinned notes
    get pinnedNotes() {
      return self.notes.filter((n) => n.isPinned);
    },
  }))
  .actions((self) => ({
    // Search and filter actions
    setSearchQuery(query: string) {
      self.searchQuery = query;
    },

    setSelectedCategory(category: string) {
      self.selectedCategory = category;
    },

    toggleTagFilter(tag: string) {
      const idx = self.selectedTags.findIndex((t) => t === tag);
      if (idx >= 0) {
        self.selectedTags.splice(idx, 1);
      } else {
        self.selectedTags.push(tag);
      }
    },

    clearFilters() {
      self.searchQuery = "";
      self.selectedCategory = "all";
      self.selectedTags.clear();
    },

    loadNotes: flow(function* () {
      try {
        const notes = (yield api.notes.list()) as Note[];
        if (notes && Array.isArray(notes)) {
          self.notes.replace(notes);
        }
      } catch (error) {
        console.error("Failed to load notes from API:", error);
      }
    }),

    addNote: flow(function* (n: {
      title: string;
      content: string;
      category: "case-notes" | "research" | "todo" | "general" | "other";
      tags?: string[];
      caseId?: string;
      isPinned?: boolean;
    }) {
      const now = new Date().toISOString();
      const newNote = {
        id: uuidv4(),
        title: n.title,
        content: n.content,
        category: n.category,
        tags: n.tags ?? [],
        caseId: n.caseId ?? "",
        createdAt: now,
        updatedAt: now,
        isPinned: n.isPinned ?? false,
      };
      self.notes.push(newNote);
      yield api.notes.create(n);
      return newNote.id;
    }),

    updateNote: flow(function* (id: string, updates: Record<string, unknown>) {
      const note = self.notes.find((n) => n.id === id);
      if (note) {
        Object.assign(note, {
          ...updates,
          updatedAt: new Date().toISOString(),
        });
        yield api.notes.update(id, updates);
      }
    }),

    deleteNote: flow(function* (id: string) {
      const idx = self.notes.findIndex((n) => n.id === id);
      if (idx >= 0) {
        self.notes.splice(idx, 1);
        yield api.notes.delete(id);
      }
    }),

    togglePin: flow(function* (id: string) {
      const note = self.notes.find((n) => n.id === id);
      if (note) {
        note.isPinned = !note.isPinned;
        note.updatedAt = new Date().toISOString();
        yield api.notes.update(id, { isPinned: note.isPinned });
      }
    }),
  }));
