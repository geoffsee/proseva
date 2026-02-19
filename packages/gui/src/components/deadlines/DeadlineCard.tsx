import {
  Box,
  HStack,
  VStack,
  Text,
  Badge,
  IconButton,
  Icon,
} from "@chakra-ui/react";
import { LuTrash2, LuPencil, LuCheck, LuCircle, LuClock } from "react-icons/lu";
import type { Deadline } from "../../types";
import { formatDate } from "../../lib/dateUtils";

const TYPE_LABELS: Record<Deadline["type"], string> = {
  filing: "Filing",
  hearing: "Hearing",
  discovery: "Discovery",
  other: "Other",
};

const TYPE_COLORS: Record<Deadline["type"], string> = {
  filing: "blue",
  hearing: "purple",
  discovery: "orange",
  other: "gray",
};

const URGENCY_COLORS: Record<
  "overdue" | "urgent" | "upcoming" | "future",
  string
> = {
  overdue: "red",
  urgent: "orange",
  upcoming: "yellow",
  future: "green",
};

const URGENCY_LABELS: Record<
  "overdue" | "urgent" | "upcoming" | "future",
  string
> = {
  overdue: "Overdue",
  urgent: "Urgent (≤3 days)",
  upcoming: "Upcoming (≤14 days)",
  future: "Future",
};

const PRIORITY_COLORS: Record<"low" | "medium" | "high", string> = {
  low: "gray",
  medium: "blue",
  high: "red",
};

interface DeadlineCardProps {
  deadline: Deadline & {
    urgency: "overdue" | "urgent" | "upcoming" | "future";
    daysUntil: number;
  };
  onToggleComplete: (id: string) => void;
  onEdit: (deadline: Deadline) => void;
  onDelete: (id: string) => void;
  caseName?: string;
}

export function DeadlineCard({
  deadline,
  onToggleComplete,
  onEdit,
  onDelete,
  caseName,
}: DeadlineCardProps) {
  const getDaysUntilText = (days: number) => {
    if (days < 0) return `${Math.abs(days)} days ago`;
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    return `In ${days} days`;
  };

  return (
    <Box
      borderWidth="1px"
      borderLeftWidth="4px"
      borderLeftColor={
        deadline.completed
          ? "gray.400"
          : `${URGENCY_COLORS[deadline.urgency]}.500`
      }
      p="4"
      borderRadius="md"
      bg={deadline.completed ? "bg.muted" : undefined}
      opacity={deadline.completed ? 0.6 : 1}
    >
      <HStack alignItems="flex-start" justifyContent="space-between">
        <HStack alignItems="flex-start" gap="3" flex="1">
          <IconButton
            aria-label="Toggle complete"
            variant="ghost"
            size="sm"
            onClick={() => onToggleComplete(deadline.id)}
            mt="0.5"
          >
            {deadline.completed ? <LuCheck /> : <LuCircle />}
          </IconButton>

          <VStack align="stretch" gap="2" flex="1">
            <Box>
              <Text
                fontWeight="semibold"
                fontSize="md"
                textDecoration={deadline.completed ? "line-through" : undefined}
              >
                {deadline.title}
              </Text>
              {deadline.description && (
                <Text fontSize="sm" color="fg.muted" mt="1">
                  {deadline.description}
                </Text>
              )}
            </Box>

            <HStack gap="2" flexWrap="wrap">
              <Badge colorPalette={TYPE_COLORS[deadline.type]} size="sm">
                {TYPE_LABELS[deadline.type]}
              </Badge>

              {!deadline.completed && (
                <Badge
                  colorPalette={URGENCY_COLORS[deadline.urgency]}
                  size="sm"
                >
                  <Icon fontSize="xs" mr="1">
                    <LuClock />
                  </Icon>
                  {URGENCY_LABELS[deadline.urgency]}
                </Badge>
              )}

              {deadline.priority && deadline.priority !== "medium" && (
                <Badge
                  colorPalette={PRIORITY_COLORS[deadline.priority]}
                  size="sm"
                >
                  {deadline.priority.toUpperCase()}
                </Badge>
              )}

              {caseName && (
                <Badge colorPalette="teal" size="sm">
                  {caseName}
                </Badge>
              )}
            </HStack>

            <HStack gap="4" fontSize="sm" color="fg.muted">
              <Text>{formatDate(deadline.date)}</Text>
              {!deadline.completed && (
                <Text
                  fontWeight="medium"
                  color={URGENCY_COLORS[deadline.urgency] + ".500"}
                >
                  {getDaysUntilText(deadline.daysUntil)}
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
            onClick={() => onEdit(deadline)}
          >
            <LuPencil />
          </IconButton>
          <IconButton
            aria-label="Delete"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(deadline.id)}
          >
            <LuTrash2 />
          </IconButton>
        </HStack>
      </HStack>
    </Box>
  );
}
