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
import type { Contact } from "../../../types";

const ROLE_OPTIONS: { value: Contact["role"]; label: string }[] = [
  { value: "attorney", label: "Attorney" },
  { value: "judge", label: "Judge" },
  { value: "clerk", label: "Clerk" },
  { value: "witness", label: "Witness" },
  { value: "expert", label: "Expert Witness" },
  { value: "opposing_party", label: "Opposing Party" },
  { value: "other", label: "Other" },
];

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: Omit<Contact, "id">;
  onFormChange: (form: Omit<Contact, "id">) => void;
  onSave: () => void;
  isEdit?: boolean;
  cases?: { id: string; name: string }[];
}

export function AddContactDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSave,
  isEdit = false,
  cases = [],
}: AddContactDialogProps) {
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
          <DialogTitle>{isEdit ? "Edit Contact" : "Add Contact"}</DialogTitle>
        </DialogHeader>
        <DialogBody overflowY="auto" maxH="calc(90vh - 150px)">
          <VStack gap="3">
            <Box w="full">
              <Text fontSize="sm" mb="1">
                Name *
              </Text>
              <Input
                value={form.name}
                onChange={(e) =>
                  onFormChange({ ...form, name: e.target.value })
                }
                placeholder="Full name"
              />
            </Box>
            <Box w="full">
              <Text fontSize="sm" mb="1">
                Role *
              </Text>
              <select
                value={form.role}
                onChange={(e) =>
                  onFormChange({
                    ...form,
                    role: e.target.value as Contact["role"],
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
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Box>
            <Box w="full">
              <Text fontSize="sm" mb="1">
                Organization
              </Text>
              <Input
                value={form.organization ?? ""}
                onChange={(e) =>
                  onFormChange({ ...form, organization: e.target.value })
                }
                placeholder="Firm, court, or company"
              />
            </Box>
            <Box w="full">
              <Text fontSize="sm" mb="1">
                Phone
              </Text>
              <Input
                type="tel"
                value={form.phone ?? ""}
                onChange={(e) =>
                  onFormChange({ ...form, phone: e.target.value })
                }
                placeholder="(555) 123-4567"
              />
            </Box>
            <Box w="full">
              <Text fontSize="sm" mb="1">
                Email
              </Text>
              <Input
                type="email"
                value={form.email ?? ""}
                onChange={(e) =>
                  onFormChange({ ...form, email: e.target.value })
                }
                placeholder="email@example.com"
              />
            </Box>
            <Box w="full">
              <Text fontSize="sm" mb="1">
                Address
              </Text>
              <Input
                value={form.address ?? ""}
                onChange={(e) =>
                  onFormChange({ ...form, address: e.target.value })
                }
                placeholder="Street address, city, state"
              />
            </Box>
            <Box w="full">
              <Text fontSize="sm" mb="1">
                Case
              </Text>
              <select
                value={form.caseId ?? ""}
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
                Notes
              </Text>
              <Input
                value={form.notes ?? ""}
                onChange={(e) =>
                  onFormChange({ ...form, notes: e.target.value })
                }
                placeholder="Additional details"
              />
            </Box>
          </VStack>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!form.name.trim()}>
            {isEdit ? "Save" : "Add"}
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
}
