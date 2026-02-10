import {
  Box,
  HStack,
  VStack,
  Text,
  Badge,
  IconButton,
  Icon,
} from "@chakra-ui/react";
import {
  LuTrash2,
  LuPencil,
  LuFile,
  LuCheck,
  LuX,
  LuTag,
} from "react-icons/lu";
import type { Evidence } from "../../types";
import { formatDate } from "../../lib/dateUtils";

const TYPE_LABELS: Record<Evidence["type"], string> = {
  document: "Document",
  photo: "Photo",
  video: "Video",
  audio: "Audio",
  physical: "Physical",
  testimony: "Testimony",
  digital: "Digital",
  other: "Other",
};

const TYPE_COLORS: Record<Evidence["type"], string> = {
  document: "blue",
  photo: "purple",
  video: "pink",
  audio: "orange",
  physical: "teal",
  testimony: "cyan",
  digital: "violet",
  other: "gray",
};

const RELEVANCE_COLORS: Record<"high" | "medium" | "low", string> = {
  high: "red",
  medium: "yellow",
  low: "gray",
};

const RELEVANCE_LABELS: Record<"high" | "medium" | "low", string> = {
  high: "High Relevance",
  medium: "Medium Relevance",
  low: "Low Relevance",
};

interface EvidenceCardProps {
  evidence: Evidence;
  onEdit: (evidence: Evidence) => void;
  onDelete: (id: string) => void;
  caseName?: string;
}

export function EvidenceCard({
  evidence,
  onEdit,
  onDelete,
  caseName,
}: EvidenceCardProps) {
  return (
    <Box
      borderWidth="1px"
      borderLeftWidth="4px"
      borderLeftColor={`${RELEVANCE_COLORS[evidence.relevance]}.500`}
      p="4"
      borderRadius="md"
    >
      <HStack alignItems="flex-start" justifyContent="space-between">
        <HStack alignItems="flex-start" gap="3" flex="1">
          <Icon fontSize="xl" mt="1" color="fg.muted">
            <LuFile />
          </Icon>

          <VStack align="stretch" gap="2" flex="1">
            <Box>
              {evidence.exhibitNumber && (
                <Text
                  fontSize="xs"
                  color="fg.muted"
                  fontWeight="semibold"
                  mb="1"
                >
                  {evidence.exhibitNumber}
                </Text>
              )}
              <Text fontWeight="semibold" fontSize="md">
                {evidence.title}
              </Text>
              {evidence.description && (
                <Text fontSize="sm" color="fg.muted" mt="1">
                  {evidence.description}
                </Text>
              )}
            </Box>

            <HStack gap="2" flexWrap="wrap">
              <Badge colorPalette={TYPE_COLORS[evidence.type]} size="sm">
                {TYPE_LABELS[evidence.type]}
              </Badge>

              <Badge
                colorPalette={RELEVANCE_COLORS[evidence.relevance]}
                size="sm"
              >
                {RELEVANCE_LABELS[evidence.relevance]}
              </Badge>

              <Badge
                colorPalette={evidence.admissible ? "green" : "red"}
                size="sm"
              >
                <Icon fontSize="xs" mr="1">
                  {evidence.admissible ? <LuCheck /> : <LuX />}
                </Icon>
                {evidence.admissible ? "Admissible" : "Inadmissible"}
              </Badge>

              {caseName && (
                <Badge colorPalette="teal" size="sm">
                  {caseName}
                </Badge>
              )}

              {evidence.tags.length > 0 && (
                <>
                  {evidence.tags.map((tag, idx) => (
                    <Badge
                      key={idx}
                      colorPalette="gray"
                      size="sm"
                      variant="subtle"
                    >
                      <Icon fontSize="xs" mr="1">
                        <LuTag />
                      </Icon>
                      {tag}
                    </Badge>
                  ))}
                </>
              )}
            </HStack>

            <HStack gap="4" fontSize="sm" color="fg.muted" flexWrap="wrap">
              {evidence.dateCollected && (
                <Text>Collected: {formatDate(evidence.dateCollected)}</Text>
              )}
              {evidence.location && <Text>Location: {evidence.location}</Text>}
              {evidence.chain.length > 0 && (
                <Text fontWeight="medium">
                  Chain of custody: {evidence.chain.length} entries
                </Text>
              )}
            </HStack>
          </VStack>
        </HStack>

        <HStack gap="1">
          <IconButton
            aria-label="Edit"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(evidence)}
          >
            <LuPencil />
          </IconButton>
          <IconButton
            aria-label="Delete"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(evidence.id)}
          >
            <LuTrash2 />
          </IconButton>
        </HStack>
      </HStack>
    </Box>
  );
}
