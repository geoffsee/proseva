import { Box, HStack, IconButton, Text, VStack, Badge } from "@chakra-ui/react";
import {
  LuPencil,
  LuTrash2,
  LuChevronLeft,
  LuChevronRight,
} from "react-icons/lu";
import type { Task } from "../../../store/TaskStore";
import { format } from "date-fns";

interface TaskCardProps {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
  onMoveNext?: () => void;
  onMovePrev?: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "gray",
  medium: "blue",
  high: "red",
};

export function TaskCard({
  task,
  onEdit,
  onDelete,
  onMoveNext,
  onMovePrev,
  onDragStart,
  onDragEnd,
  isDragging,
}: TaskCardProps) {
  return (
    <Box
      bg="white"
      _dark={{ bg: "gray.900" }}
      p="4"
      borderRadius="md"
      borderWidth="1px"
      shadow="sm"
      _hover={{ shadow: "md" }}
      transition="all 0.2s"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      opacity={isDragging ? 0.5 : 1}
      cursor={isDragging ? "grabbing" : "grab"}
    >
      <VStack align="stretch" gap="2">
        <HStack justifyContent="space-between">
          <Text fontWeight="semibold" fontSize="md">
            {task.title}
          </Text>
          <Badge colorPalette={PRIORITY_COLORS[task.priority]} size="sm">
            {task.priority}
          </Badge>
        </HStack>

        {task.description && (
          <Text fontSize="sm" color="gray.600" _dark={{ color: "gray.400" }}>
            {task.description}
          </Text>
        )}

        {task.dueDate && (
          <Text fontSize="xs" color="gray.500">
            Due: {format(new Date(task.dueDate), "MMM d, yyyy")}
          </Text>
        )}

        <HStack justifyContent="space-between" mt="2">
          <HStack gap="1">
            {onMovePrev && (
              <IconButton
                size="xs"
                variant="ghost"
                onClick={onMovePrev}
                aria-label="Move to previous column"
              >
                <LuChevronLeft />
              </IconButton>
            )}
            {onMoveNext && (
              <IconButton
                size="xs"
                variant="ghost"
                onClick={onMoveNext}
                aria-label="Move to next column"
              >
                <LuChevronRight />
              </IconButton>
            )}
          </HStack>

          <HStack gap="1">
            <IconButton
              size="xs"
              variant="ghost"
              onClick={onEdit}
              aria-label="Edit task"
            >
              <LuPencil />
            </IconButton>
            <IconButton
              size="xs"
              variant="ghost"
              colorPalette="red"
              onClick={onDelete}
              aria-label="Delete task"
            >
              <LuTrash2 />
            </IconButton>
          </HStack>
        </HStack>
      </VStack>
    </Box>
  );
}
