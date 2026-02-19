import {
  Box,
  Button,
  Heading,
  HStack,
  Text,
  VStack,
  Badge,
  IconButton,
  Checkbox,
} from "@chakra-ui/react";
import { format } from "date-fns";
import { LuPlus, LuTrash2 } from "react-icons/lu";
import type { Deadline } from "../../../types";

const TYPE_COLOR: Record<string, string> = {
  filing: "blue",
  hearing: "purple",
  discovery: "orange",
  other: "gray",
};

interface DayDetailProps {
  selectedDate: string;
  deadlines: Deadline[];
  onAdd: (dateStr: string) => void;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
}

export function DayDetail({
  selectedDate,
  deadlines,
  onAdd,
  onToggleComplete,
  onDelete,
}: DayDetailProps) {
  const dayDeadlines = deadlines.filter((d) => d.date === selectedDate);

  return (
    <Box borderWidth="1px" p="4" borderRadius="md">
      <HStack justifyContent="space-between" mb="3">
        <Heading size="sm">
          {format(new Date(selectedDate + "T12:00:00"), "EEEE, MMMM d, yyyy")}
        </Heading>
        <Button size="sm" variant="outline" onClick={() => onAdd(selectedDate)}>
          <LuPlus /> Add
        </Button>
      </HStack>
      {dayDeadlines.length === 0 ? (
        <Text fontSize="sm" color="fg.muted">
          No deadlines on this date.
        </Text>
      ) : (
        <VStack align="stretch" gap="2">
          {dayDeadlines.map((d) => (
            <HStack key={d.id} justifyContent="space-between">
              <HStack gap="2">
                <Checkbox.Root
                  checked={d.completed}
                  onCheckedChange={() => onToggleComplete(d.id)}
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                </Checkbox.Root>
                <Text
                  fontSize="sm"
                  textDecoration={d.completed ? "line-through" : undefined}
                >
                  {d.title}
                </Text>
                <Badge colorPalette={TYPE_COLOR[d.type]} fontSize="xs">
                  {d.type}
                </Badge>
              </HStack>
              <IconButton
                aria-label="Delete"
                variant="ghost"
                size="sm"
                onClick={() => onDelete(d.id)}
              >
                <LuTrash2 />
              </IconButton>
            </HStack>
          ))}
        </VStack>
      )}
    </Box>
  );
}
