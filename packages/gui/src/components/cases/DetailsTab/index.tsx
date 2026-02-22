import { Box, Button, Text, VStack, Textarea } from "@chakra-ui/react";
import { LuTrash2 } from "react-icons/lu";
import type { Case } from "../../../types";

interface DetailsTabProps {
  caseData: Case;
  onUpdateCase: (id: string, updates: Partial<Case>) => void;
  onDeleteClick: () => void;
}

export function DetailsTab({
  caseData,
  onUpdateCase,
  onDeleteClick,
}: DetailsTabProps) {
  return (
    <VStack align="stretch" gap="4" mt="4">
      <Box>
        <Text fontSize="sm" fontWeight="medium" mb="1">
          Status
        </Text>
        <select
          value={caseData.status}
          onChange={(e) =>
            onUpdateCase(caseData.id, {
              status: e.target.value as Case["status"],
            })
          }
          style={{
            padding: "8px",
            borderRadius: "6px",
            border: "1px solid var(--chakra-colors-border)",
            background: "transparent",
            color: "inherit",
          }}
        >
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="closed">Closed</option>
        </select>
      </Box>
      <Box>
        <Text fontSize="sm" fontWeight="medium" mb="1">
          Notes
        </Text>
        <Textarea
          value={caseData.notes}
          onChange={(e) => onUpdateCase(caseData.id, { notes: e.target.value })}
          rows={6}
          placeholder="Case notes..."
        />
      </Box>
      <Box>
        <Button
          colorPalette="red"
          variant="outline"
          size="sm"
          onClick={() => {
            console.log("Delete Case button clicked");
            onDeleteClick();
          }}
        >
          <LuTrash2 /> Delete Case
        </Button>
      </Box>
    </VStack>
  );
}
