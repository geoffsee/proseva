import {
  Box,
  Button,
  Input,
  Text,
  Textarea,
  VStack,
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from "@chakra-ui/react";
import type { Deadline } from "../../types";

const TYPE_OPTIONS: { value: Deadline["type"]; label: string }[] = [
  { value: "filing", label: "Filing" },
  { value: "hearing", label: "Hearing" },
  { value: "discovery", label: "Discovery" },
  { value: "other", label: "Other" },
];

const PRIORITY_OPTIONS: { value: "low" | "medium" | "high"; label: string }[] =
  [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
  ];

interface DeadlineFormData {
  title: string;
  date: string;
  type: Deadline["type"];
  description: string;
  priority: "low" | "medium" | "high";
  caseId: string;
}

interface AddEditDeadlineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: DeadlineFormData;
  onFormChange: (form: DeadlineFormData) => void;
  onSave: () => void;
  isEdit: boolean;
  cases: { id: string; name: string }[];
}

export function AddEditDeadlineDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSave,
  isEdit,
  cases,
}: AddEditDeadlineDialogProps) {
  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => onOpenChange(e.open)}
      placement="center"
      motionPreset="slide-in-bottom"
    >
      <DialogContent
        maxW="500px"
        maxH="90vh"
        position="fixed"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Deadline" : "Add Deadline"}</DialogTitle>
        </DialogHeader>
        <DialogBody overflowY="auto" maxH="calc(90vh - 150px)">
          <VStack gap="3">
            <Box w="full">
              <Text fontSize="sm" mb="1">
                Title *
              </Text>
              <Input
                value={form.title}
                onChange={(e) =>
                  onFormChange({ ...form, title: e.target.value })
                }
                placeholder="e.g., File motion to compel"
              />
            </Box>

            <Box w="full">
              <Text fontSize="sm" mb="1">
                Date *
              </Text>
              <Input
                type="date"
                value={form.date}
                onChange={(e) =>
                  onFormChange({ ...form, date: e.target.value })
                }
              />
            </Box>

            <Box w="full">
              <Text fontSize="sm" mb="1">
                Type *
              </Text>
              <select
                value={form.type}
                onChange={(e) =>
                  onFormChange({
                    ...form,
                    type: e.target.value as Deadline["type"],
                  })
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid var(--chakra-colors-border)",
                  background: "transparent",
                  color: "inherit",
                }}
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Box>

            <Box w="full">
              <Text fontSize="sm" mb="1">
                Priority
              </Text>
              <select
                value={form.priority}
                onChange={(e) =>
                  onFormChange({
                    ...form,
                    priority: e.target.value as "low" | "medium" | "high",
                  })
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid var(--chakra-colors-border)",
                  background: "transparent",
                  color: "inherit",
                }}
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Box>

            <Box w="full">
              <Text fontSize="sm" mb="1">
                Case
              </Text>
              <select
                value={form.caseId}
                onChange={(e) =>
                  onFormChange({ ...form, caseId: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid var(--chakra-colors-border)",
                  background: "transparent",
                  color: "inherit",
                }}
              >
                <option value="">No case</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Box>

            <Box w="full">
              <Text fontSize="sm" mb="1">
                Description
              </Text>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  onFormChange({ ...form, description: e.target.value })
                }
                placeholder="Additional details..."
                rows={3}
              />
            </Box>
          </VStack>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!form.title.trim() || !form.date}>
            {isEdit ? "Save" : "Add"}
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
}
