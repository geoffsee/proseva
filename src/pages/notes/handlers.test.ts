import { describe, it, expect, vi } from "vitest";
import {
  validateNoteForm,
  loadNoteForm,
  handleNoteAdd,
  handleNoteEdit,
  handleNoteSave,
  handleNoteDialogClose,
  INITIAL_FORM,
  type NoteFormData,
} from "./handlers";
import type { Note } from "../../types";

describe("Notes Handlers", () => {
  describe("validateNoteForm", () => {
    it("returns false when title is empty", () => {
      const form: NoteFormData = {
        ...INITIAL_FORM,
        title: "",
        content: "Content",
      };
      expect(validateNoteForm(form)).toBe(false);
    });

    it("returns false when content is empty", () => {
      const form: NoteFormData = {
        ...INITIAL_FORM,
        title: "Title",
        content: "",
      };
      expect(validateNoteForm(form)).toBe(false);
    });

    it("returns false when both are empty", () => {
      const form: NoteFormData = { ...INITIAL_FORM, title: "", content: "" };
      expect(validateNoteForm(form)).toBe(false);
    });

    it("returns false when title is only whitespace", () => {
      const form: NoteFormData = {
        ...INITIAL_FORM,
        title: "   ",
        content: "Content",
      };
      expect(validateNoteForm(form)).toBe(false);
    });

    it("returns false when content is only whitespace", () => {
      const form: NoteFormData = {
        ...INITIAL_FORM,
        title: "Title",
        content: "   ",
      };
      expect(validateNoteForm(form)).toBe(false);
    });

    it("returns true when both title and content have content", () => {
      const form: NoteFormData = {
        ...INITIAL_FORM,
        title: "Title",
        content: "Content",
      };
      expect(validateNoteForm(form)).toBe(true);
    });
  });

  describe("loadNoteForm", () => {
    it("loads all note data into form", () => {
      const note: Note = {
        id: "1",
        title: "Test Note",
        content: "Test content",
        category: "research",
        tags: ["test", "case"],
        caseId: "case-1",
        isPinned: true,
        createdAt: "2024-01-15",
        updatedAt: "2024-01-15",
      };

      const form = loadNoteForm(note);

      expect(form.title).toBe("Test Note");
      expect(form.content).toBe("Test content");
      expect(form.category).toBe("research");
      expect(form.tags).toEqual(["test", "case"]);
      expect(form.caseId).toBe("case-1");
      expect(form.isPinned).toBe(true);
    });

    it("creates a copy of tags array to avoid mutations", () => {
      const originalTags = ["tag1", "tag2"];
      const note: Note = {
        id: "1",
        title: "Note",
        content: "Content",
        category: "general",
        tags: originalTags,
        caseId: "",
        isPinned: false,
        createdAt: "2024-01-15",
        updatedAt: "2024-01-15",
      };

      const form = loadNoteForm(note);
      form.tags.push("tag3");

      expect(originalTags).toEqual(["tag1", "tag2"]);
      expect(form.tags).toEqual(["tag1", "tag2", "tag3"]);
    });
  });

  describe("handleNoteAdd", () => {
    it("calls onAdd when form is valid", () => {
      const form: NoteFormData = {
        ...INITIAL_FORM,
        title: "New Note",
        content: "New content",
      };
      const onAdd = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleNoteAdd(form, onAdd, onFormReset, onDialogClose);

      expect(onAdd).toHaveBeenCalledWith(form);
      expect(onFormReset).toHaveBeenCalled();
      expect(onDialogClose).toHaveBeenCalled();
    });

    it("does not call onAdd when title is empty", () => {
      const form: NoteFormData = {
        ...INITIAL_FORM,
        title: "",
        content: "Content",
      };
      const onAdd = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleNoteAdd(form, onAdd, onFormReset, onDialogClose);

      expect(onAdd).not.toHaveBeenCalled();
      expect(onFormReset).not.toHaveBeenCalled();
      expect(onDialogClose).not.toHaveBeenCalled();
    });

    it("does not call onAdd when content is empty", () => {
      const form: NoteFormData = {
        ...INITIAL_FORM,
        title: "Title",
        content: "",
      };
      const onAdd = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleNoteAdd(form, onAdd, onFormReset, onDialogClose);

      expect(onAdd).not.toHaveBeenCalled();
    });
  });

  describe("handleNoteEdit", () => {
    it("loads note data and opens dialog", () => {
      const note: Note = {
        id: "1",
        title: "Existing Note",
        content: "Content",
        category: "general",
        tags: ["tag1"],
        caseId: "case-1",
        isPinned: false,
        createdAt: "2024-01-15",
        updatedAt: "2024-01-15",
      };
      const onFormLoad = vi.fn();
      const onDialogOpen = vi.fn();

      handleNoteEdit(note, onFormLoad, onDialogOpen);

      expect(onFormLoad).toHaveBeenCalled();
      const formArg = onFormLoad.mock.calls[0][0];
      expect(formArg.title).toBe("Existing Note");
      expect(formArg.content).toBe("Content");
      expect(onDialogOpen).toHaveBeenCalled();
    });
  });

  describe("handleNoteSave", () => {
    it("calls onUpdate when editing existing note", () => {
      const note: Note = {
        id: "1",
        title: "Note",
        content: "Content",
        category: "general",
        tags: [],
        caseId: "",
        isPinned: false,
        createdAt: "2024-01-15",
        updatedAt: "2024-01-15",
      };
      const form: NoteFormData = {
        ...INITIAL_FORM,
        title: "Updated",
        content: "Updated content",
      };
      const onAdd = vi.fn();
      const onUpdate = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleNoteSave(form, note, onAdd, onUpdate, onFormReset, onDialogClose);

      expect(onUpdate).toHaveBeenCalledWith("1", form);
      expect(onAdd).not.toHaveBeenCalled();
      expect(onFormReset).toHaveBeenCalled();
      expect(onDialogClose).toHaveBeenCalled();
    });

    it("calls onAdd when creating new note", () => {
      const form: NoteFormData = {
        ...INITIAL_FORM,
        title: "New Note",
        content: "New content",
      };
      const onAdd = vi.fn();
      const onUpdate = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleNoteSave(form, null, onAdd, onUpdate, onFormReset, onDialogClose);

      expect(onAdd).toHaveBeenCalledWith(form);
      expect(onUpdate).not.toHaveBeenCalled();
      expect(onFormReset).toHaveBeenCalled();
      expect(onDialogClose).toHaveBeenCalled();
    });

    it("does not call onUpdate for invalid form", () => {
      const note: Note = {
        id: "1",
        title: "Note",
        content: "Content",
        category: "general",
        tags: [],
        caseId: "",
        isPinned: false,
        createdAt: "2024-01-15",
        updatedAt: "2024-01-15",
      };
      const form: NoteFormData = { ...INITIAL_FORM, title: "", content: "" };
      const onAdd = vi.fn();
      const onUpdate = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleNoteSave(form, note, onAdd, onUpdate, onFormReset, onDialogClose);

      expect(onUpdate).not.toHaveBeenCalled();
      expect(onFormReset).not.toHaveBeenCalled();
      expect(onDialogClose).not.toHaveBeenCalled();
    });
  });

  describe("handleNoteDialogClose", () => {
    it("opens dialog when open is true", () => {
      const onOpenChange = vi.fn();
      const onEditingReset = vi.fn();
      const onFormReset = vi.fn();

      handleNoteDialogClose(true, onOpenChange, onEditingReset, onFormReset);

      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(onEditingReset).not.toHaveBeenCalled();
      expect(onFormReset).not.toHaveBeenCalled();
    });

    it("closes dialog and resets state when open is false", () => {
      const onOpenChange = vi.fn();
      const onEditingReset = vi.fn();
      const onFormReset = vi.fn();

      handleNoteDialogClose(false, onOpenChange, onEditingReset, onFormReset);

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onEditingReset).toHaveBeenCalled();
      expect(onFormReset).toHaveBeenCalled();
    });
  });
});
