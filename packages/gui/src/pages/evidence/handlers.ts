import type { Evidence } from "../../types";

export type EvidenceFormData = {
  title: string;
  exhibitNumber: string;
  description: string;
  type:
    | "document"
    | "photo"
    | "video"
    | "audio"
    | "physical"
    | "testimony"
    | "digital"
    | "other";
  fileUrl: string;
  dateCollected: string;
  location: string;
  tags: string;
  relevance: "high" | "medium" | "low";
  admissible: boolean;
  notes: string;
  caseId: string;
};

export const INITIAL_FORM: EvidenceFormData = {
  title: "",
  exhibitNumber: "",
  description: "",
  type: "other",
  fileUrl: "",
  dateCollected: "",
  location: "",
  tags: "",
  relevance: "medium",
  admissible: false,
  notes: "",
  caseId: "",
};

// Validates evidence form data before submission
export function validateEvidenceForm(form: EvidenceFormData): boolean {
  return form.title.trim().length > 0;
}

// Parses comma-separated tags
export function parseTags(tagString: string): string[] {
  return tagString
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// Formats tags array to comma-separated string
export function formatTags(tags: string[]): string {
  return tags.join(", ");
}

// Creates evidence form from existing evidence (for editing)
export function loadEvidenceForm(evidence: Evidence): EvidenceFormData {
  return {
    title: evidence.title,
    exhibitNumber: evidence.exhibitNumber || "",
    description: evidence.description || "",
    type: evidence.type,
    fileUrl: evidence.fileUrl || "",
    dateCollected: evidence.dateCollected || "",
    location: evidence.location || "",
    tags: formatTags(evidence.tags),
    relevance: evidence.relevance,
    admissible: evidence.admissible || false,
    notes: evidence.notes || "",
    caseId: evidence.caseId || "",
  };
}

// Handles adding a new evidence
export function handleEvidenceAdd(
  form: EvidenceFormData,
  onAdd: (data: Omit<EvidenceFormData, "tags"> & { tags: string[] }) => void,
  onFormReset: () => void,
  onDialogClose: () => void,
): void {
  if (!validateEvidenceForm(form)) return;
  const tags = parseTags(form.tags);
  onAdd({ ...form, tags });
  onFormReset();
  onDialogClose();
}

// Handles editing an existing evidence
export function handleEvidenceEdit(
  evidence: Evidence,
  onFormLoad: (form: EvidenceFormData) => void,
  onDialogOpen: () => void,
): void {
  const formData = loadEvidenceForm(evidence);
  onFormLoad(formData);
  onDialogOpen();
}

// Handles saving evidence (either add or update)
export function handleEvidenceSave(
  form: EvidenceFormData,
  editingEvidence: Evidence | null,
  onAdd: (data: Omit<EvidenceFormData, "tags"> & { tags: string[] }) => void,
  onUpdate: (
    id: string,
    data: Omit<EvidenceFormData, "tags"> & { tags: string[] },
  ) => void,
  onFormReset: () => void,
  onDialogClose: () => void,
): void {
  if (editingEvidence) {
    if (!validateEvidenceForm(form)) return;
    const tags = parseTags(form.tags);
    onUpdate(editingEvidence.id, { ...form, tags });
  } else {
    handleEvidenceAdd(form, onAdd, onFormReset, onDialogClose);
    return;
  }
  onFormReset();
  onDialogClose();
}

// Handles dialog close and form reset
export function handleEvidenceDialogClose(
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
