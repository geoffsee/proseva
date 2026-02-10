import type { Filing } from "../../types";

export type FilingFormData = {
  title: string;
  date: string;
  type: string;
  notes: string;
  caseId: string;
};

export const INITIAL_FORM: FilingFormData = {
  title: "",
  date: "",
  type: "",
  notes: "",
  caseId: "",
};

// Validates filing form data before submission
export function validateFilingForm(form: FilingFormData): boolean {
  return form.title.trim().length > 0 && form.date.trim().length > 0;
}

// Creates filing form from existing filing (for editing)
export function loadFilingForm(filing: Filing): FilingFormData {
  return {
    title: filing.title,
    date: filing.date,
    type: filing.type || "",
    notes: filing.notes || "",
    caseId: filing.caseId || "",
  };
}

// Handles adding a new filing
export function handleFilingAdd(
  form: FilingFormData,
  onAdd: (data: FilingFormData) => void,
  onFormReset: () => void,
  onDialogClose: () => void,
): void {
  if (!validateFilingForm(form)) return;
  onAdd(form);
  onFormReset();
  onDialogClose();
}

// Handles editing an existing filing
export function handleFilingEdit(
  filing: Filing,
  onFormLoad: (form: FilingFormData) => void,
  onDialogOpen: () => void,
): void {
  const formData = loadFilingForm(filing);
  onFormLoad(formData);
  onDialogOpen();
}

// Handles saving filing (either add or update)
export function handleFilingSave(
  form: FilingFormData,
  editingFiling: Filing | null,
  onAdd: (data: FilingFormData) => void,
  onUpdate: (id: string, data: FilingFormData) => void,
  onFormReset: () => void,
  onDialogClose: () => void,
): void {
  if (editingFiling) {
    if (!validateFilingForm(form)) return;
    onUpdate(editingFiling.id, form);
  } else {
    handleFilingAdd(form, onAdd, onFormReset, onDialogClose);
    return;
  }
  onFormReset();
  onDialogClose();
}

// Handles dialog close and form reset
export function handleFilingDialogClose(
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
