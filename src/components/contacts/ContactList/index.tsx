import { Box, HStack, Text, VStack, Badge, IconButton } from "@chakra-ui/react";
import { LuTrash2, LuPencil } from "react-icons/lu";
import type { Contact } from "../../../types";

const ROLE_COLORS: Record<Contact["role"], string> = {
  attorney: "blue",
  judge: "purple",
  clerk: "teal",
  witness: "yellow",
  expert: "orange",
  opposing_party: "red",
  other: "gray",
};

const ROLE_LABELS: Record<Contact["role"], string> = {
  attorney: "Attorney",
  judge: "Judge",
  clerk: "Clerk",
  witness: "Witness",
  expert: "Expert",
  opposing_party: "Opposing Party",
  other: "Other",
};

interface ContactListProps {
  contacts: Contact[];
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
}

export function ContactList({ contacts, onEdit, onDelete }: ContactListProps) {
  return (
    <VStack align="stretch" gap="2">
      {contacts
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => (
          <HStack
            key={c.id}
            borderWidth="1px"
            p="3"
            borderRadius="md"
            justifyContent="space-between"
          >
            <Box>
              <HStack gap="2">
                <Text fontWeight="medium">{c.name}</Text>
                <Badge colorPalette={ROLE_COLORS[c.role]}>
                  {ROLE_LABELS[c.role]}
                </Badge>
              </HStack>
              <Text fontSize="sm" color="fg.muted">
                {[c.organization, c.phone, c.email]
                  .filter(Boolean)
                  .join(" · ") || "No details"}
              </Text>
            </Box>
            <HStack gap="1">
              <IconButton
                aria-label="Edit"
                variant="ghost"
                size="sm"
                onClick={() => onEdit(c)}
              >
                <LuPencil />
              </IconButton>
              <IconButton
                aria-label="Delete"
                variant="ghost"
                size="sm"
                onClick={() => onDelete(c.id)}
              >
                <LuTrash2 />
              </IconButton>
            </HStack>
          </HStack>
        ))}
    </VStack>
  );
}
