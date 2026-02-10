import {
  Box,
  Button,
  Input,
  Text,
  Textarea,
  VStack,
  HStack,
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
  Checkbox,
} from "@chakra-ui/react";
import type { Evidence } from "../../types";

const TYPE_OPTIONS: { value: Evidence["type"]; label: string }[] = [
  { value: "document", label: "Document" },
  { value: "photo", label: "Photo" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "physical", label: "Physical" },
  { value: "testimony", label: "Testimony" },
  { value: "digital", label: "Digital" },
  { value: "other", label: "Other" },
];

const RELEVANCE_OPTIONS: { value: "high" | "medium" | "low"; label: string }[] =
  [
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];

interface EvidenceFormData {
  title: string;
  exhibitNumber: string;
  description: string;
  type: Evidence["type"];
  fileUrl: string;
  dateCollected: string;
  location: string;
  tags: string;
  relevance: "high" | "medium" | "low";
  admissible: boolean;
  notes: string;
  caseId: string;
}

interface AddEditEvidenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: EvidenceFormData;
  onFormChange: (form: EvidenceFormData) => void;
  onSave: () => void;
  isEdit: boolean;
  cases: { id: string; name: string }[];
}

export function AddEditEvidenceDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSave,
  isEdit,
  cases,
}: AddEditEvidenceDialogProps) {
  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => onOpenChange(e.open)}
      placement="center"
      motionPreset="slide-in-bottom"
    >
      <DialogContent
        maxW="600px"
        maxH="90vh"
        position="fixed"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Evidence" : "Add Evidence"}</DialogTitle>
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
                placeholder="e.g., Security camera footage"
              />
            </Box>

            <HStack w="full" gap="3">
              <Box flex="1">
                <Text fontSize="sm" mb="1">
                  Exhibit Number
                </Text>
                <Input
                  value={form.exhibitNumber}
                  onChange={(e) =>
                    onFormChange({ ...form, exhibitNumber: e.target.value })
                  }
                  placeholder="e.g., Exhibit A"
                />
              </Box>

              <Box flex="1">
                <Text fontSize="sm" mb="1">
                  Type *
                </Text>
                <select
                  value={form.type}
                  onChange={(e) =>
                    onFormChange({
                      ...form,
                      type: e.target.value as Evidence["type"],
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
            </HStack>

            <Box w="full">
              <Text fontSize="sm" mb="1">
                Description
              </Text>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  onFormChange({ ...form, description: e.target.value })
                }
                placeholder="Describe the evidence..."
                rows={2}
              />
            </Box>

            <HStack w="full" gap="3">
              <Box flex="1">
                <Text fontSize="sm" mb="1">
                  Date Collected
                </Text>
                <Input
                  type="date"
                  value={form.dateCollected}
                  onChange={(e) =>
                    onFormChange({ ...form, dateCollected: e.target.value })
                  }
                />
              </Box>

              <Box flex="1">
                <Text fontSize="sm" mb="1">
                  Location
                </Text>
                <Input
                  value={form.location}
                  onChange={(e) =>
                    onFormChange({ ...form, location: e.target.value })
                  }
                  placeholder="Where collected"
                />
              </Box>
            </HStack>

            <Box w="full">
              <Text fontSize="sm" mb="1">
                File URL/Path
              </Text>
              <Input
                value={form.fileUrl}
                onChange={(e) =>
                  onFormChange({ ...form, fileUrl: e.target.value })
                }
                placeholder="Path to file or document"
              />
            </Box>

            <HStack w="full" gap="3">
              <Box flex="1">
                <Text fontSize="sm" mb="1">
                  Relevance
                </Text>
                <select
                  value={form.relevance}
                  onChange={(e) =>
                    onFormChange({
                      ...form,
                      relevance: e.target.value as "high" | "medium" | "low",
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
                  {RELEVANCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Box>

              <Box flex="1">
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
            </HStack>

            <Box w="full">
              <Text fontSize="sm" mb="1">
                Tags (comma-separated)
              </Text>
              <Input
                value={form.tags}
                onChange={(e) =>
                  onFormChange({ ...form, tags: e.target.value })
                }
                placeholder="e.g., contract, signed, 2023"
              />
            </Box>

            <Box w="full">
              <HStack gap="2">
                <Checkbox.Root
                  checked={form.admissible}
                  onCheckedChange={(e) =>
                    onFormChange({ ...form, admissible: e.checked === true })
                  }
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                </Checkbox.Root>
                <Text fontSize="sm">Admissible in court</Text>
              </HStack>
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
                placeholder="Additional notes..."
                rows={2}
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
