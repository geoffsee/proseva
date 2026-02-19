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

interface FilingFormData {
  title: string;
  date: string;
  type: string;
  notes: string;
  caseId: string;
}

interface AddEditFilingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: FilingFormData;
  onFormChange: (form: FilingFormData) => void;
  onSave: () => void;
  isEdit: boolean;
  cases: { id: string; name: string }[];
}

const FILING_TYPES = [
  "Motion",
  "Order",
  "Petition",
  "Response",
  "Brief",
  "Complaint",
  "Answer",
  "Notice",
  "Affidavit",
  "Memorandum",
  "Other",
];

export function AddEditFilingDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSave,
  isEdit,
  cases,
}: AddEditFilingDialogProps) {
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
          <DialogTitle>{isEdit ? "Edit Filing" : "Add Filing"}</DialogTitle>
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
                placeholder="e.g., Motion to Modify Support"
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
                Type
              </Text>
              <select
                value={form.type}
                onChange={(e) =>
                  onFormChange({ ...form, type: e.target.value })
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
                <option value="">Select type</option>
                {FILING_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
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
                <option value="">None</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Box>

            <Box w="full">
              <Text fontSize="sm" mb="1">
                Notes
              </Text>
              <Textarea
                value={form.notes}
                onChange={(e) =>
                  onFormChange({ ...form, notes: e.target.value })
                }
                placeholder="Additional notes or description"
                rows={4}
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
