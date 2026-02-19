import type { Task } from "../../store/TaskStore";

export type TaskFormData = {
  title: string;
  description: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate: string | null;
};

export const INITIAL_FORM: TaskFormData = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  dueDate: null,
};

// Validates task form data before submission
export function validateTaskForm(form: TaskFormData): boolean {
  return form.title.trim().length > 0;
}

// Creates task form from existing task (for editing)
export function loadTaskForm(task: Task): TaskFormData {
  return {
    title: task.title,
    description: task.description,
    status: task.status as TaskFormData["status"],
    priority: task.priority as TaskFormData["priority"],
    dueDate: task.dueDate,
  };
}

// Handles adding a new task
export function handleTaskAdd(
  form: TaskFormData,
  onAdd: (data: TaskFormData) => void,
  onFormReset: () => void,
  onDialogClose: () => void,
): void {
  if (!validateTaskForm(form)) return;
  onAdd(form);
  onFormReset();
  onDialogClose();
}

// Handles editing an existing task
export function handleTaskEdit(
  task: Task,
  onFormLoad: (form: TaskFormData) => void,
  onDialogOpen: () => void,
): void {
  const formData = loadTaskForm(task);
  onFormLoad(formData);
  onDialogOpen();
}

// Handles saving task (either add or update)
export function handleTaskSave(
  form: TaskFormData,
  editingTask: Task | null,
  onAdd: (data: TaskFormData) => void,
  onUpdate: (id: string, data: TaskFormData) => void,
  onFormReset: () => void,
  onDialogClose: () => void,
): void {
  if (editingTask) {
    if (!validateTaskForm(form)) return;
    onUpdate(editingTask.id, form);
  } else {
    handleTaskAdd(form, onAdd, onFormReset, onDialogClose);
    return;
  }
  onFormReset();
  onDialogClose();
}

// Handles dialog close and form reset
export function handleTaskDialogClose(
  open: boolean,
  onOpenChange: (open: boolean) => void,
  onEditingReset: () => void,
  onFormReset: () => void,
): void {
  onOpenChange(open);
  if (!open) {
    onEditingReset();
    onFormReset();
  }
}
