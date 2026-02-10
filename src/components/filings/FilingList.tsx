import { VStack } from "@chakra-ui/react";
import { FilingCard } from "./FilingCard";
import type { Filing } from "../../types";

interface FilingListProps {
  filings: Filing[];
  onEdit: (filing: Filing) => void;
  onDelete: (id: string) => void;
  getCaseName: (caseId?: string) => string | undefined;
}

export function FilingList({
  filings,
  onEdit,
  onDelete,
  getCaseName,
}: FilingListProps) {
  return (
    <VStack align="stretch" gap="3">
      {filings.map((filing) => (
        <FilingCard
          key={filing.id}
          filing={filing}
          onEdit={onEdit}
          onDelete={onDelete}
          caseName={getCaseName(filing.caseId)}
        />
      ))}
    </VStack>
  );
}
