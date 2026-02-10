import { Box, HStack, VStack, Text, Badge, IconButton } from "@chakra-ui/react";
import { LuTrash2, LuPencil, LuFileText } from "react-icons/lu";
import type { Filing } from "../../types";
import { formatDate } from "../../lib/dateUtils";

const TYPE_COLORS: Record<string, string> = {
  Motion: "blue",
  Order: "purple",
  Petition: "orange",
  Response: "teal",
  Brief: "cyan",
  Complaint: "red",
  Answer: "green",
  Notice: "yellow",
  Affidavit: "pink",
  Memorandum: "indigo",
  Other: "gray",
};

interface FilingCardProps {
  filing: Filing;
  onEdit: (filing: Filing) => void;
  onDelete: (id: string) => void;
  caseName?: string;
}

export function FilingCard({
  filing,
  onEdit,
  onDelete,
  caseName,
}: FilingCardProps) {
  return (
    <Box
      borderWidth="1px"
      borderLeftWidth="4px"
      borderLeftColor={
        TYPE_COLORS[filing.type]
          ? `${TYPE_COLORS[filing.type]}.500`
          : "gray.500"
      }
      p="4"
      borderRadius="md"
    >
      <HStack alignItems="flex-start" justifyContent="space-between">
        <HStack alignItems="flex-start" gap="3" flex="1">
          <Box borderRadius="md" bg="bg.muted" p="2" mt="0.5">
            <LuFileText size={20} />
          </Box>

          <VStack align="stretch" gap="2" flex="1">
            <Box>
              <Text fontWeight="semibold" fontSize="md">
                {filing.title}
              </Text>
              {filing.notes && (
                <Text fontSize="sm" color="fg.muted" mt="1">
                  {filing.notes}
                </Text>
              )}
            </Box>

            <HStack gap="2" flexWrap="wrap">
              {filing.type && (
                <Badge
                  colorPalette={TYPE_COLORS[filing.type] || "gray"}
                  size="sm"
                >
                  {filing.type}
                </Badge>
              )}

              {caseName && (
                <Badge colorPalette="teal" size="sm">
                  {caseName}
                </Badge>
              )}
            </HStack>

            <Text fontSize="sm" color="fg.muted">
              {formatDate(filing.date)}
            </Text>
          </VStack>
        </HStack>

        <HStack gap="1">
          <IconButton
            aria-label="Edit"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(filing)}
          >
            <LuPencil />
          </IconButton>
          <IconButton
            aria-label="Delete"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(filing.id)}
          >
            <LuTrash2 />
          </IconButton>
        </HStack>
      </HStack>
    </Box>
  );
}
