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

interface TaskFormData {
  title: string;
  description: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate: string | null;
}

interface AddEditTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: TaskFormData;
  onFormChange: (form: TaskFormData) => void;
  onSave: () => void;
  isEdit?: boolean;
}

const STATUS_OPTIONS = [
  { value: "todo", label: "To Do" },
  { value: "in-progress", label: "In Progress" },
  { value: "done", label: "Done" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

export function AddEditTaskDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSave,
  isEdit = false,
}: AddEditTaskDialogProps) {
  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => onOpenChange(e.open)}
      size="lg"
    >
      <DialogContent maxH="90vh" overflowY="auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Task" : "Add Task"}</DialogTitle>
        </DialogHeader>
        <DialogBody>
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
                placeholder="Task title"
              />
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
                placeholder="Task description (optional)"
                rows={4}
              />
            </Box>

            <Box w="full">
              <Text fontSize="sm" mb="1">
                Status *
              </Text>
              <select
                value={form.status}
                onChange={(e) =>
                  onFormChange({
                    ...form,
                    status: e.target.value as "todo" | "in-progress" | "done",
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
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Box>

            <Box w="full">
              <Text fontSize="sm" mb="1">
                Priority *
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
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Box>

            <Box w="full">
              <Text fontSize="sm" mb="1">
                Due Date
              </Text>
              <Input
                type="date"
                value={form.dueDate || ""}
                onChange={(e) =>
                  onFormChange({ ...form, dueDate: e.target.value || null })
                }
              />
            </Box>
          </VStack>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!form.title.trim()}>
            {isEdit ? "Save" : "Add"}
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
}
