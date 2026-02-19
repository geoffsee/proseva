import { Box, HStack, Text, VStack, Badge, IconButton } from "@chakra-ui/react";
import { LuTrash2 } from "react-icons/lu";
import type { FinancialEntry } from "../../../types";

interface EntryListProps {
  entries: FinancialEntry[];
  onDelete: (id: string) => void;
}

export function EntryList({ entries, onDelete }: EntryListProps) {
  return (
    <VStack align="stretch" gap="2">
      {entries
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((e) => (
          <HStack
            key={e.id}
            borderWidth="1px"
            p="3"
            borderRadius="md"
            justifyContent="space-between"
          >
            <Box>
              <HStack gap="2">
                <Text fontWeight="medium">{e.subcategory}</Text>
                <Badge colorPalette={e.category === "income" ? "green" : "red"}>
                  {e.category}
                </Badge>
              </HStack>
              <Text fontSize="sm" color="fg.muted">
                {e.date} · {e.frequency}
                {e.description ? ` · ${e.description}` : ""}
              </Text>
            </Box>
            <HStack gap="2">
              <Text
                fontWeight="bold"
                color={e.category === "income" ? "green.fg" : "red.fg"}
              >
                {e.category === "income" ? "+" : "-"}$
                {e.amount.toLocaleString()}
              </Text>
              <IconButton
                aria-label="Delete"
                variant="ghost"
                size="sm"
                onClick={() => onDelete(e.id)}
              >
                <LuTrash2 />
              </IconButton>
            </HStack>
          </HStack>
        ))}
    </VStack>
  );
}
