import { useState } from "react";
import {
  Button,
  Heading,
  HStack,
  VStack,
  Grid,
  GridItem,
} from "@chakra-ui/react";
import { LuPlus, LuKanban } from "react-icons/lu";
import { observer } from "mobx-react-lite";
import { useStore } from "../store/StoreContext";
import { EmptyState } from "../components/shared/EmptyState";
import { StatCard } from "../components/shared/StatCard";
import { AddEditTaskDialog } from "../components/kanban/AddEditTaskDialog";
import { KanbanColumn } from "../components/kanban/KanbanColumn";
import type { Task } from "../store/TaskStore";

type TaskFormData = {
  title: string;
  description: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate: string | null;
};

const INITIAL_FORM: TaskFormData = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  dueDate: null,
};

const Kanban = observer(function Kanban() {
  const { taskStore } = useStore();
  const [open, setOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskFormData>({ ...INITIAL_FORM });
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!form.title.trim()) return;
    taskStore.addTask(form);
    setForm({ ...INITIAL_FORM });
    setOpen(false);
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description,
      status: task.status as TaskFormData["status"],
      priority: task.priority as TaskFormData["priority"],
      dueDate: task.dueDate,
    });
    setOpen(true);
  };

  const handleSave = () => {
    if (editingTask) {
      taskStore.updateTask(editingTask.id, form);
      setEditingTask(null);
    } else {
      handleAdd();
    }
    setForm({ ...INITIAL_FORM });
    setOpen(false);
  };

  const handleDialogClose = (open: boolean) => {
    setOpen(open);
    if (!open) {
      setEditingTask(null);
      setForm({ ...INITIAL_FORM });
    }
  };

  const handleMoveTask = (
    taskId: string,
    newStatus: "todo" | "in-progress" | "done",
  ) => {
    taskStore.moveTask(taskId, newStatus);
  };

  const handleDeleteTask = (taskId: string) => {
    taskStore.deleteTask(taskId);
  };

  const handleDragStart = (taskId: string) => {
    setDraggedTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
  };

  const todoTasks = taskStore.todoTasks;
  const inProgressTasks = taskStore.inProgressTasks;
  const doneTasks = taskStore.doneTasks;
  const totalTasks = taskStore.tasks.length;

  return (
    <VStack align="stretch" gap="6">
      <HStack justifyContent="space-between">
        <Heading size="2xl">Tasks</Heading>
        <Button size="sm" onClick={() => setOpen(true)}>
          <LuPlus /> Add Task
        </Button>
      </HStack>
      <AddEditTaskDialog
        open={open}
        onOpenChange={handleDialogClose}
        form={form}
        onFormChange={setForm}
        onSave={handleSave}
        isEdit={!!editingTask}
      />

      <HStack gap="4" flexWrap="wrap">
        <StatCard label="Total Tasks" value={totalTasks.toString()} />
        <StatCard label="To Do" value={todoTasks.length.toString()} />
        <StatCard
          label="In Progress"
          value={inProgressTasks.length.toString()}
        />
        <StatCard label="Done" value={doneTasks.length.toString()} />
      </HStack>

      {totalTasks === 0 ? (
        <EmptyState
          icon={LuKanban}
          title="No tasks yet"
          description="Create tasks to manage your work with a visual kanban board."
        />
      ) : (
        <Grid
          templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
          gap="4"
          alignItems="flex-start"
        >
          <GridItem>
            <KanbanColumn
              title="To Do"
              status="todo"
              tasks={todoTasks as unknown as Task[]}
              onEdit={handleEdit}
              onDelete={handleDeleteTask}
              onMove={handleMoveTask}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              draggedTaskId={draggedTaskId}
            />
          </GridItem>
          <GridItem>
            <KanbanColumn
              title="In Progress"
              status="in-progress"
              tasks={inProgressTasks as unknown as Task[]}
              onEdit={handleEdit}
              onDelete={handleDeleteTask}
              onMove={handleMoveTask}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              draggedTaskId={draggedTaskId}
            />
          </GridItem>
          <GridItem>
            <KanbanColumn
              title="Done"
              status="done"
              tasks={doneTasks as unknown as Task[]}
              onEdit={handleEdit}
              onDelete={handleDeleteTask}
              onMove={handleMoveTask}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              draggedTaskId={draggedTaskId}
            />
          </GridItem>
        </Grid>
      )}
    </VStack>
  );
});

export default Kanban;
