import {
  Box,
  HStack,
  Text,
  VStack,
  Badge,
  IconButton,
  Icon,
} from "@chakra-ui/react";
import { LuTrash2, LuPencil, LuPin } from "react-icons/lu";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Note } from "../../../types";

const CATEGORY_COLORS: Record<Note["category"], string> = {
  "case-notes": "blue",
  research: "purple",
  todo: "orange",
  general: "gray",
  other: "teal",
};

const CATEGORY_LABELS: Record<Note["category"], string> = {
  "case-notes": "Case Notes",
  research: "Research",
  todo: "To-Do",
  general: "General",
  other: "Other",
};

interface NoteListProps {
  notes: Note[];
  onDelete: (id: string) => void;
  onEdit: (note: Note) => void;
  onTogglePin: (id: string) => void;
}

export function NoteList({
  notes,
  onDelete,
  onEdit,
  onTogglePin,
}: NoteListProps) {
  // Sort: pinned first, then by updatedAt (most recent first)
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return (
    <VStack align="stretch" gap="2">
      {sortedNotes.map((note) => (
        <HStack
          key={note.id}
          borderWidth="1px"
          p="4"
          borderRadius="md"
          justifyContent="space-between"
          bg={note.isPinned ? "bg.subtle" : undefined}
        >
          <Box flex="1">
            <HStack gap="2" mb="1">
              {note.isPinned && (
                <Icon color="yellow.500">
                  <LuPin />
                </Icon>
              )}
              <Text fontWeight="medium">{note.title}</Text>
              <Badge colorPalette={CATEGORY_COLORS[note.category]}>
                {CATEGORY_LABELS[note.category]}
              </Badge>
            </HStack>
            <Box
              fontSize="sm"
              color="fg.muted"
              css={{
                "& > *": {
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                },
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {note.content}
              </ReactMarkdown>
            </Box>
            {note.tags.length > 0 && (
              <HStack gap="1" mt="2" flexWrap="wrap">
                {note.tags.map((tag) => (
                  <Badge key={tag} size="sm" variant="outline">
                    {tag}
                  </Badge>
                ))}
              </HStack>
            )}
            <Text fontSize="xs" color="fg.muted" mt="1">
              Updated {new Date(note.updatedAt).toLocaleDateString()}
            </Text>
          </Box>
          <HStack gap="1">
            <IconButton
              aria-label="Pin"
              variant="ghost"
              size="sm"
              onClick={() => onTogglePin(note.id)}
              color={note.isPinned ? "yellow.500" : undefined}
            >
              <LuPin />
            </IconButton>
            <IconButton
              aria-label="Edit"
              variant="ghost"
              size="sm"
              onClick={() => onEdit(note)}
            >
              <LuPencil />
            </IconButton>
            <IconButton
              aria-label="Delete"
              variant="ghost"
              size="sm"
              onClick={() => onDelete(note.id)}
            >
              <LuTrash2 />
            </IconButton>
          </HStack>
        </HStack>
      ))}
    </VStack>
  );
}
