import {
  Box,
  Button,
  Input,
  Text,
  VStack,
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from "@chakra-ui/react";
import type { Deadline } from "../../../types";
import type { Case } from "../../../types";

interface AddDeadlineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: Omit<Deadline, "id">;
  onFormChange: (form: Omit<Deadline, "id">) => void;
  onAdd: () => void;
  cases: Case[];
}

export function AddDeadlineDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onAdd,
  cases,
}: AddDeadlineDialogProps) {
  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => onOpenChange(e.open)}
      placement="center"
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
          <DialogTitle>Add Deadline</DialogTitle>
        </DialogHeader>
        <DialogBody overflowY="auto" maxH="calc(90vh - 150px)">
          <VStack gap="3">
            <Input
              placeholder="Title"
              value={form.title}
              onChange={(e) => onFormChange({ ...form, title: e.target.value })}
            />
            <Input
              type="date"
              value={form.date}
              onChange={(e) => onFormChange({ ...form, date: e.target.value })}
            />
            <Box w="full">
              <Text fontSize="sm" mb="1">
                Type
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
                <option value="filing">Filing</option>
                <option value="hearing">Hearing</option>
                <option value="discovery">Discovery</option>
                <option value="payment">Payment</option>
                <option value="other">Other</option>
              </select>
            </Box>
            {cases.length > 0 && (
              <Box w="full">
                <Text fontSize="sm" mb="1">
                  Case (optional)
                </Text>
                <select
                  value={form.caseId ?? ""}
                  onChange={(e) =>
                    onFormChange({
                      ...form,
                      caseId: e.target.value || undefined,
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
                  <option value="">No case</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Box>
            )}
          </VStack>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onAdd} disabled={!form.title || !form.date}>
            Add
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
}
