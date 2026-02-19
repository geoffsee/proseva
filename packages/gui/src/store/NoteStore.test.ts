import { describe, it, expect, vi } from "vitest";
import { NoteStore } from "./NoteStore";
import * as apiModule from "../lib/api";

vi.spyOn(apiModule.api.notes, "create").mockResolvedValue(null);
vi.spyOn(apiModule.api.notes, "update").mockResolvedValue(null);
vi.spyOn(apiModule.api.notes, "delete").mockResolvedValue(undefined);

function createStore() {
  return NoteStore.create({
    notes: [],
    searchQuery: "",
    selectedCategory: "all",
    selectedTags: [],
  });
}

describe("NoteStore", () => {
  it("addNote adds note and calls api", async () => {
    const store = createStore();
    await store.addNote({
      title: "Test Note",
      content: "Test content",
      category: "general",
    });
    expect(store.notes).toHaveLength(1);
    expect(store.notes[0].title).toBe("Test Note");
    expect(apiModule.api.notes.create).toHaveBeenCalled();
  });

  it("updateNote updates and calls api", async () => {
    const store = createStore();
    await store.addNote({
      title: "Test",
      content: "Content",
      category: "general",
    });
    const id = store.notes[0].id;
    await store.updateNote(id, { title: "Updated" });
    expect(store.notes[0].title).toBe("Updated");
    expect(apiModule.api.notes.update).toHaveBeenCalled();
  });

  it("deleteNote removes and calls api", async () => {
    const store = createStore();
    await store.addNote({
      title: "Test",
      content: "Content",
      category: "general",
    });
    const id = store.notes[0].id;
    await store.deleteNote(id);
    expect(store.notes).toHaveLength(0);
    expect(apiModule.api.notes.delete).toHaveBeenCalled();
  });

  it("filters notes by search query", async () => {
    const store = createStore();
    await store.addNote({
      title: "JavaScript Tutorial",
      content: "Learn JS",
      category: "research",
    });
    await store.addNote({
      title: "Python Guide",
      content: "Learn Python",
      category: "research",
    });

    store.setSearchQuery("javascript");
    expect(store.filteredNotes).toHaveLength(1);
    expect(store.filteredNotes[0].title).toBe("JavaScript Tutorial");
  });

  it("filters notes by category", async () => {
    const store = createStore();
    await store.addNote({
      title: "Note 1",
      content: "Content 1",
      category: "research",
    });
    await store.addNote({
      title: "Note 2",
      content: "Content 2",
      category: "todo",
    });

    store.setSelectedCategory("research");
    expect(store.filteredNotes).toHaveLength(1);
    expect(store.filteredNotes[0].category).toBe("research");
  });

  it("filters notes by tags", async () => {
    const store = createStore();
    await store.addNote({
      title: "Note 1",
      content: "Content 1",
      category: "general",
      tags: ["important", "urgent"],
    });
    await store.addNote({
      title: "Note 2",
      content: "Content 2",
      category: "general",
      tags: ["important"],
    });

    store.toggleTagFilter("important");
    expect(store.filteredNotes).toHaveLength(2);

    store.toggleTagFilter("urgent");
    expect(store.filteredNotes).toHaveLength(1);
    expect(store.filteredNotes[0].title).toBe("Note 1");
  });

  it("togglePin toggles isPinned", async () => {
    const store = createStore();
    await store.addNote({
      title: "Test",
      content: "Content",
      category: "general",
    });
    const id = store.notes[0].id;

    expect(store.notes[0].isPinned).toBe(false);
    await store.togglePin(id);
    expect(store.notes[0].isPinned).toBe(true);
    await store.togglePin(id);
    expect(store.notes[0].isPinned).toBe(false);
  });

  it("computes allTags correctly", async () => {
    const store = createStore();
    await store.addNote({
      title: "Note 1",
      content: "Content",
      category: "general",
      tags: ["tag1", "tag2"],
    });
    await store.addNote({
      title: "Note 2",
      content: "Content",
      category: "general",
      tags: ["tag2", "tag3"],
    });

    expect(store.allTags).toEqual(["tag1", "tag2", "tag3"]);
  });

  it("clears filters", async () => {
    const store = createStore();
    store.setSearchQuery("test");
    store.setSelectedCategory("research");
    store.toggleTagFilter("tag1");

    store.clearFilters();

    expect(store.searchQuery).toBe("");
    expect(store.selectedCategory).toBe("all");
    expect(store.selectedTags.length).toBe(0);
  });
});
