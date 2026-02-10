import { useState } from "react";
import {
  Button,
  Heading,
  HStack,
  VStack,
  Grid,
  GridItem,
} from "@chakra-ui/react";
import { LuPlus, LuStickyNote } from "react-icons/lu";
import { observer } from "mobx-react-lite";
import { useStore } from "../store/StoreContext";
import { EmptyState } from "../components/shared/EmptyState";
import { StatCard } from "../components/shared/StatCard";
import { AddEditNoteDialog } from "../components/notes/AddEditNoteDialog";
import { NoteList } from "../components/notes/NoteList";
import { NoteFilters } from "../components/notes/NoteFilters";
import type { Note } from "../types";

const INITIAL_FORM: Omit<Note, "id" | "createdAt" | "updatedAt"> = {
  title: "",
  content: "",
  category: "general",
  tags: [],
  caseId: "",
  isPinned: false,
};

const Notes = observer(function Notes() {
  const { noteStore, caseStore } = useStore();
  const [open, setOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [form, setForm] = useState<
    Omit<Note, "id" | "createdAt" | "updatedAt">
  >({
    ...INITIAL_FORM,
  });

  const handleAdd = () => {
    if (!form.title.trim() || !form.content.trim()) return;
    noteStore.addNote(form);
    setForm({ ...INITIAL_FORM });
    setOpen(false);
  };

  const handleEdit = (note: Note) => {
    setEditingNote(note);
    setForm({
      title: note.title,
      content: note.content,
      category: note.category,
      tags: [...note.tags],
      caseId: note.caseId,
      isPinned: note.isPinned,
    });
    setOpen(true);
  };

  const handleSave = () => {
    if (editingNote) {
      noteStore.updateNote(editingNote.id, form);
      setEditingNote(null);
    } else {
      handleAdd();
    }
    setForm({ ...INITIAL_FORM });
    setOpen(false);
  };

  const handleDialogClose = (open: boolean) => {
    setOpen(open);
    if (!open) {
      setEditingNote(null);
      setForm({ ...INITIAL_FORM });
    }
  };

  const filteredNotes = noteStore.filteredNotes;
  const totalNotes = noteStore.notes.length;
  const pinnedCount = noteStore.pinnedNotes.length;

  // Get unique categories count
  const categoryCount = new Set(noteStore.notes.map((n) => n.category)).size;

  // Get cases for dropdown
  const cases = caseStore.cases.map((c) => ({ id: c.id, name: c.name }));

  return (
    <VStack align="stretch" gap="6">
      <HStack justifyContent="space-between">
        <Heading size="2xl">Notes</Heading>
        <Button size="sm" onClick={() => setOpen(true)}>
          <LuPlus /> Add Note
        </Button>
      </HStack>

      <HStack gap="4" flexWrap="wrap">
        <StatCard label="Total Notes" value={totalNotes.toString()} />
        <StatCard label="Categories" value={categoryCount.toString()} />
        <StatCard label="Pinned" value={pinnedCount.toString()} />
        <StatCard label="Tags" value={noteStore.allTags.length.toString()} />
      </HStack>

      <Grid templateColumns={{ base: "1fr", lg: "280px 1fr" }} gap="6">
        <GridItem>
          <NoteFilters
            searchQuery={noteStore.searchQuery}
            onSearchChange={(q) => noteStore.setSearchQuery(q)}
            selectedCategory={noteStore.selectedCategory}
            onCategoryChange={(c) => noteStore.setSelectedCategory(c)}
            selectedTags={[...noteStore.selectedTags]}
            onToggleTag={(t) => noteStore.toggleTagFilter(t)}
            availableTags={noteStore.allTags}
            onClearFilters={() => noteStore.clearFilters()}
          />
        </GridItem>

        <GridItem>
          {filteredNotes.length === 0 && totalNotes === 0 ? (
            <EmptyState
              icon={LuStickyNote}
              title="No notes yet"
              description="Create notes to keep track of case details, research, todos, and more."
            />
          ) : filteredNotes.length === 0 ? (
            <EmptyState
              icon={LuStickyNote}
              title="No matching notes"
              description="Try adjusting your search or filters."
            />
          ) : (
            <NoteList
              notes={filteredNotes as unknown as Note[]}
              onDelete={(id) => noteStore.deleteNote(id)}
              onEdit={handleEdit}
              onTogglePin={(id) => noteStore.togglePin(id)}
            />
          )}
        </GridItem>
      </Grid>

      <AddEditNoteDialog
        open={open}
        onOpenChange={handleDialogClose}
        form={form}
        onFormChange={setForm}
        onSave={handleSave}
        isEdit={!!editingNote}
        cases={cases}
      />
    </VStack>
  );
});

export default Notes;
