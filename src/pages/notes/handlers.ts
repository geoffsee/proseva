import type { Note } from "../../types";

export type NoteFormData = Omit<Note, "id" | "createdAt" | "updatedAt">;

export const INITIAL_FORM: NoteFormData = {
  title: "",
  content: "",
  category: "general",
  tags: [],
  caseId: "",
  isPinned: false,
};

// Validates note form data before submission
export function validateNoteForm(form: NoteFormData): boolean {
  return form.title.trim().length > 0 && form.content.trim().length > 0;
}

// Creates note form from existing note (for editing)
export function loadNoteForm(note: Note): NoteFormData {
  return {
    title: note.title,
    content: note.content,
    category: note.category,
    tags: [...note.tags],
    caseId: note.caseId,
    isPinned: note.isPinned,
  };
}

// Handles adding a new note
export function handleNoteAdd(
  form: NoteFormData,
  onAdd: (data: NoteFormData) => void,
  onFormReset: () => void,
  onDialogClose: () => void,
): void {
  if (!validateNoteForm(form)) return;
  onAdd(form);
  onFormReset();
  onDialogClose();
}

// Handles editing an existing note
export function handleNoteEdit(
  note: Note,
  onFormLoad: (form: NoteFormData) => void,
  onDialogOpen: () => void,
): void {
  const formData = loadNoteForm(note);
  onFormLoad(formData);
  onDialogOpen();
}

// Handles saving note (either add or update)
export function handleNoteSave(
  form: NoteFormData,
  editingNote: Note | null,
  onAdd: (data: NoteFormData) => void,
  onUpdate: (id: string, data: NoteFormData) => void,
  onFormReset: () => void,
  onDialogClose: () => void,
): void {
  if (editingNote) {
    if (!validateNoteForm(form)) return;
    onUpdate(editingNote.id, form);
  } else {
    handleNoteAdd(form, onAdd, onFormReset, onDialogClose);
    return;
  }
  onFormReset();
  onDialogClose();
}

// Handles dialog close and form reset
export function handleNoteDialogClose(
  open: boolean,
  onOpenChange: (open: boolean) => void,
  onEditingReset: () => void,
  onFormReset: () => void,
): void {
  onOpenChange(open);
  if (!open) {
    onEditingReset();
    onFormReset();
  }
}
