import { Box, Button, Input, Text } from "@chakra-ui/react";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from "@chakra-ui/react";

export interface BeneficiaryFormData {
  name: string;
  relationship: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: BeneficiaryFormData;
  onFormChange: (form: BeneficiaryFormData) => void;
  onSave: () => void;
}

export function AddEditBeneficiaryDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSave,
}: Props) {
  const update = (field: keyof BeneficiaryFormData, value: string) =>
    onFormChange({ ...form, [field]: value });

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
          <DialogTitle>Add Beneficiary</DialogTitle>
        </DialogHeader>
        <DialogBody overflowY="auto" maxH="calc(90vh - 150px)">
          <Box mb="3">
            <Text fontWeight="medium" mb="1">
              Name *
            </Text>
            <Input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Full legal name"
            />
          </Box>
          <Box mb="3">
            <Text fontWeight="medium" mb="1">
              Relationship
            </Text>
            <Input
              value={form.relationship}
              onChange={(e) => update("relationship", e.target.value)}
              placeholder="e.g. Spouse, Child, Sibling"
            />
          </Box>
          <Box mb="3">
            <Text fontWeight="medium" mb="1">
              Date of Birth
            </Text>
            <Input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => update("dateOfBirth", e.target.value)}
            />
          </Box>
          <Box mb="3">
            <Text fontWeight="medium" mb="1">
              Phone
            </Text>
            <Input
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
            />
          </Box>
          <Box mb="3">
            <Text fontWeight="medium" mb="1">
              Email
            </Text>
            <Input
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </Box>
          <Box mb="3">
            <Text fontWeight="medium" mb="1">
              Address
            </Text>
            <Input
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
            />
          </Box>
          <Box mb="3">
            <Text fontWeight="medium" mb="1">
              Notes
            </Text>
            <Input
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </Box>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!form.name.trim()}>
            Add Beneficiary
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
}
