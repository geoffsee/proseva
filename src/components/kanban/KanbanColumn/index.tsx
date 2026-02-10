import { useState } from "react";
import { VStack, Heading, Box } from "@chakra-ui/react";
import { TaskCard } from "../TaskCard";
import type { Task } from "../../../store/TaskStore";

interface KanbanColumnProps {
  title: string;
  status: "todo" | "in-progress" | "done";
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onMove: (taskId: string, newStatus: "todo" | "in-progress" | "done") => void;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  draggedTaskId: string | null;
}

export function KanbanColumn({
  title,
  status,
  tasks,
  onEdit,
  onDelete,
  onMove,
  onDragStart,
  onDragEnd,
  draggedTaskId,
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const getNextStatus = (
    currentStatus: "todo" | "in-progress" | "done",
  ): "todo" | "in-progress" | "done" | null => {
    if (currentStatus === "todo") return "in-progress";
    if (currentStatus === "in-progress") return "done";
    return null;
  };

  const getPrevStatus = (
    currentStatus: "todo" | "in-progress" | "done",
  ): "todo" | "in-progress" | "done" | null => {
    if (currentStatus === "done") return "in-progress";
    if (currentStatus === "in-progress") return "todo";
    return null;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (draggedTaskId) {
      onMove(draggedTaskId, status);
      onDragEnd();
    }
  };

  return (
    <VStack align="stretch" gap="3">
      <Box
        bg="gray.100"
        _dark={{ bg: "gray.800" }}
        p="3"
        borderRadius="lg"
        borderWidth="1px"
      >
        <Heading size="sm" textAlign="center">
          {title}
        </Heading>
      </Box>

      <VStack
        align="stretch"
        gap="3"
        minHeight="400px"
        p="3"
        borderRadius="md"
        borderWidth="2px"
        borderColor={isDragOver ? "blue.400" : "transparent"}
        bg={isDragOver ? "blue.50" : undefined}
        _dark={{
          bg: isDragOver ? "blue.900/20" : undefined,
        }}
        transition="all 0.2s"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={() => onEdit(task)}
            onDelete={() => onDelete(task.id)}
            onMoveNext={
              getNextStatus(status)
                ? () => onMove(task.id, getNextStatus(status)!)
                : undefined
            }
            onMovePrev={
              getPrevStatus(status)
                ? () => onMove(task.id, getPrevStatus(status)!)
                : undefined
            }
            onDragStart={() => onDragStart(task.id)}
            onDragEnd={onDragEnd}
            isDragging={draggedTaskId === task.id}
          />
        ))}
      </VStack>
    </VStack>
  );
}
