import { VStack } from "@chakra-ui/react";
import { EvidenceCard } from "./EvidenceCard";
import type { Evidence } from "../../types";

interface EvidenceListProps {
  evidences: Evidence[];
  onEdit: (evidence: Evidence) => void;
  onDelete: (id: string) => void;
  getCaseName?: (caseId: string) => string;
}

export function EvidenceList({
  evidences,
  onEdit,
  onDelete,
  getCaseName,
}: EvidenceListProps) {
  return (
    <VStack align="stretch" gap="3">
      {evidences.map((evidence) => (
        <EvidenceCard
          key={evidence.id}
          evidence={evidence}
          onEdit={onEdit}
          onDelete={onDelete}
          caseName={
            evidence.caseId && getCaseName
              ? getCaseName(evidence.caseId)
              : undefined
          }
        />
      ))}
    </VStack>
  );
}
