import {
  Box,
  Button,
  HStack,
  Text,
  VStack,
  Badge,
  IconButton,
} from "@chakra-ui/react";
import { LuPlus, LuTrash2, LuPencil, LuFileText } from "react-icons/lu";
import { EmptyState } from "../../shared/EmptyState";

const STATUS_COLORS: Record<string, string> = {
  "not-started": "gray",
  draft: "yellow",
  review: "blue",
  signed: "green",
  notarized: "teal",
  filed: "purple",
};

const STATUS_LABELS: Record<string, string> = {
  "not-started": "Not Started",
  draft: "Draft",
  review: "Review",
  signed: "Signed",
  notarized: "Notarized",
  filed: "Filed",
};

const TYPE_LABELS: Record<string, string> = {
  "last-will": "Last Will & Testament",
  "living-will": "Living Will",
  "power-of-attorney-financial": "POA - Financial",
  "power-of-attorney-healthcare": "POA - Healthcare",
  "healthcare-directive": "Healthcare Directive",
  trust: "Trust",
  "beneficiary-designation": "Beneficiary Designation",
  "letter-of-instruction": "Letter of Instruction",
  other: "Other",
};

interface EstateDocument {
  id: string;
  type: string;
  title: string;
  status: string;
  reviewDate: string;
  updatedAt: string;
}

interface Props {
  documents: EstateDocument[];
  onDraft: () => void;
  onEdit: (docId: string) => void;
  onRemove: (docId: string) => void;
  onStatusChange: (docId: string, status: string) => void;
}

export function EstateDocumentList({
  documents,
  onDraft,
  onEdit,
  onRemove,
  onStatusChange,
}: Props) {
  const statusOrder = [
    "not-started",
    "draft",
    "review",
    "signed",
    "notarized",
    "filed",
  ];

  const getNextStatus = (current: string): string | null => {
    const idx = statusOrder.indexOf(current);
    if (idx >= 0 && idx < statusOrder.length - 1) return statusOrder[idx + 1];
    return null;
  };

  return (
    <Box>
      <HStack justifyContent="space-between" mb="4">
        <Text fontWeight="semibold" fontSize="lg">
          Documents
        </Text>
        <Button size="sm" onClick={onDraft}>
          <LuPlus /> Draft Document
        </Button>
      </HStack>

      {documents.length === 0 ? (
        <EmptyState
          icon={LuFileText}
          title="No documents yet"
          description="Draft estate planning documents using Virginia-compliant templates."
        />
      ) : (
        <VStack align="stretch" gap="3">
          {documents.map((doc) => {
            const nextStatus = getNextStatus(doc.status);
            return (
              <HStack
                key={doc.id}
                borderWidth="1px"
                borderRadius="md"
                p="3"
                justifyContent="space-between"
                flexWrap="wrap"
                gap="2"
              >
                <Box flex="1" minW="200px">
                  <Text fontWeight="medium">{doc.title}</Text>
                  <HStack gap="2" mt="1" flexWrap="wrap">
                    <Badge size="sm" colorPalette="purple">
                      {TYPE_LABELS[doc.type] ?? doc.type}
                    </Badge>
                    <Badge
                      size="sm"
                      colorPalette={STATUS_COLORS[doc.status] ?? "gray"}
                    >
                      {STATUS_LABELS[doc.status] ?? doc.status}
                    </Badge>
                    {doc.reviewDate && (
                      <Text fontSize="xs" color="fg.muted">
                        Review: {doc.reviewDate}
                      </Text>
                    )}
                  </HStack>
                </Box>
                <HStack gap="1">
                  {nextStatus && (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => onStatusChange(doc.id, nextStatus)}
                    >
                      Mark {STATUS_LABELS[nextStatus]}
                    </Button>
                  )}
                  <IconButton
                    aria-label="Edit document"
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(doc.id)}
                  >
                    <LuPencil />
                  </IconButton>
                  <IconButton
                    aria-label="Remove document"
                    variant="ghost"
                    size="sm"
                    colorPalette="red"
                    onClick={() => onRemove(doc.id)}
                  >
                    <LuTrash2 />
                  </IconButton>
                </HStack>
              </HStack>
            );
          })}
        </VStack>
      )}
    </Box>
  );
}
