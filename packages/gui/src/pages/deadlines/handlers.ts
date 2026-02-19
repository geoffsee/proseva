import type { Deadline } from "../../types";

export type DeadlineFormData = {
  title: string;
  date: string;
  type: "filing" | "hearing" | "discovery" | "other";
  description: string;
  priority: "low" | "medium" | "high";
  caseId: string;
};

export const INITIAL_FORM: DeadlineFormData = {
  title: "",
  date: "",
  type: "other",
  description: "",
  priority: "medium",
  caseId: "",
};

// Validates deadline form data before submission
export function validateDeadlineForm(form: DeadlineFormData): boolean {
  return form.title.trim().length > 0 && form.date.trim().length > 0;
}

// Creates deadline form from existing deadline (for editing)
export function loadDeadlineForm(deadline: Deadline): DeadlineFormData {
  return {
    title: deadline.title,
    date: deadline.date,
    type: deadline.type,
    description: deadline.description || "",
    priority: deadline.priority || "medium",
    caseId: deadline.caseId || "",
  };
}

// Handles adding a new deadline
export function handleDeadlineAdd(
  form: DeadlineFormData,
  onAdd: (data: DeadlineFormData) => void,
  onFormReset: () => void,
  onDialogClose: () => void,
): void {
  if (!validateDeadlineForm(form)) return;
  onAdd(form);
  onFormReset();
  onDialogClose();
}

// Handles editing an existing deadline
export function handleDeadlineEdit(
  deadline: Deadline,
  onFormLoad: (form: DeadlineFormData) => void,
  onDialogOpen: () => void,
): void {
  const formData = loadDeadlineForm(deadline);
  onFormLoad(formData);
  onDialogOpen();
}

// Handles saving deadline (either add or update)
export function handleDeadlineSave(
  form: DeadlineFormData,
  editingDeadline: Deadline | null,
  onAdd: (data: DeadlineFormData) => void,
  onUpdate: (id: string, data: DeadlineFormData) => void,
  onFormReset: () => void,
  onDialogClose: () => void,
): void {
  if (editingDeadline) {
    if (!validateDeadlineForm(form)) return;
    onUpdate(editingDeadline.id, form);
  } else {
    handleDeadlineAdd(form, onAdd, onFormReset, onDialogClose);
    return;
  }
  onFormReset();
  onDialogClose();
}

// Handles dialog close and form reset
export function handleDeadlineDialogClose(
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
