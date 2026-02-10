import {
  Box,
  Button,
  Input,
  Text,
  VStack,
  HStack,
  Badge,
  IconButton,
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from "@chakra-ui/react";
import { LuX } from "react-icons/lu";
import { useState } from "react";
import { MarkdownPreview } from "../MarkdownPreview";
import type { Note } from "../../../types";

const CATEGORY_OPTIONS: { value: Note["category"]; label: string }[] = [
  { value: "case-notes", label: "Case Notes" },
  { value: "research", label: "Research" },
  { value: "todo", label: "To-Do" },
  { value: "general", label: "General" },
  { value: "other", label: "Other" },
];

interface AddEditNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: Omit<Note, "id" | "createdAt" | "updatedAt">;
  onFormChange: (form: Omit<Note, "id" | "createdAt" | "updatedAt">) => void;
  onSave: () => void;
  isEdit?: boolean;
  cases?: Array<{ id: string; name: string }>;
}

export function AddEditNoteDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSave,
  isEdit = false,
  cases = [],
}: AddEditNoteDialogProps) {
  const [tagInput, setTagInput] = useState("");

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      onFormChange({ ...form, tags: [...form.tags, tag] });
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    onFormChange({ ...form, tags: form.tags.filter((t) => t !== tag) });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => onOpenChange(e.open)}
      size="lg"
    >
      <DialogContent
        maxH="90vh"
        position="fixed"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Note" : "Add Note"}</DialogTitle>
        </DialogHeader>
        <DialogBody overflowY="auto">
          <VStack gap="3">
            <Box w="full">
              <Text fontSize="sm" mb="1">
                Title *
              </Text>
              <Input
                value={form.title}
                onChange={(e) =>
                  onFormChange({ ...form, title: e.target.value })
                }
                placeholder="Note title"
              />
            </Box>

            <Box w="full">
              <Text fontSize="sm" mb="1">
                Content *
              </Text>
              <MarkdownPreview
                value={form.content}
                onChange={(content) => onFormChange({ ...form, content })}
                placeholder="Write your note here... (Markdown supported)"
                rows={5}
              />
            </Box>

            <Box w="full">
              <Text fontSize="sm" mb="1">
                Category *
              </Text>
              <select
                value={form.category}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  onFormChange({
                    ...form,
                    category: e.target.value as Note["category"],
                  })
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid var(--chakra-colors-border)",
                  background: "transparent",
                  color: "inherit",
                }}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Box>

            <Box w="full">
              <Text fontSize="sm" mb="1">
                Tags
              </Text>
              <HStack mb="2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Add a tag and press Enter"
                  size="sm"
                />
                <Button size="sm" onClick={handleAddTag}>
                  Add
                </Button>
              </HStack>
              {form.tags.length > 0 && (
                <HStack gap="2" flexWrap="wrap">
                  {form.tags.map((tag) => (
                    <Badge key={tag} colorPalette="blue" pr="1">
                      {tag}
                      <IconButton
                        aria-label="Remove tag"
                        size="xs"
                        variant="ghost"
                        ml="1"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        <LuX />
                      </IconButton>
                    </Badge>
                  ))}
                </HStack>
              )}
            </Box>

            {cases.length > 0 && (
              <Box w="full">
                <Text fontSize="sm" mb="1">
                  Associated Case (optional)
                </Text>
                <select
                  value={form.caseId}
                  onChange={(e) =>
                    onFormChange({ ...form, caseId: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid var(--chakra-colors-border)",
                    background: "transparent",
                    color: "inherit",
                  }}
                >
                  <option value="">None</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Box>
            )}
          </VStack>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={!form.title.trim() || !form.content.trim()}
          >
            {isEdit ? "Save" : "Add"}
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
}
