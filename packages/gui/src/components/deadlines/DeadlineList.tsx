import { VStack } from "@chakra-ui/react";
import { DeadlineCard } from "./DeadlineCard";
import type { Deadline } from "../../types";

interface DeadlineListProps {
  deadlines: (Deadline & {
    urgency: "overdue" | "urgent" | "upcoming" | "future";
    daysUntil: number;
  })[];
  onToggleComplete: (id: string) => void;
  onEdit: (deadline: Deadline) => void;
  onDelete: (id: string) => void;
  getCaseName: (caseId?: string) => string | undefined;
}

export function DeadlineList({
  deadlines,
  onToggleComplete,
  onEdit,
  onDelete,
  getCaseName,
}: DeadlineListProps) {
  return (
    <VStack align="stretch" gap="3">
      {deadlines.map((deadline) => (
        <DeadlineCard
          key={deadline.id}
          deadline={deadline}
          onToggleComplete={onToggleComplete}
          onEdit={onEdit}
          onDelete={onDelete}
          caseName={getCaseName(deadline.caseId)}
        />
      ))}
    </VStack>
  );
}
