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

const ASSET_CATEGORIES = [
  { value: "real-property", label: "Real Property" },
  { value: "bank-account", label: "Bank Account" },
  { value: "investment", label: "Investment" },
  { value: "retirement", label: "Retirement" },
  { value: "insurance", label: "Insurance" },
  { value: "vehicle", label: "Vehicle" },
  { value: "personal-property", label: "Personal Property" },
  { value: "business-interest", label: "Business Interest" },
  { value: "digital-asset", label: "Digital Asset" },
  { value: "other", label: "Other" },
];

export interface AssetFormData {
  name: string;
  category: string;
  estimatedValue: string;
  ownershipType: string;
  accountNumber: string;
  institution: string;
  notes: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: AssetFormData;
  onFormChange: (form: AssetFormData) => void;
  onSave: () => void;
}

export function AddEditAssetDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSave,
}: Props) {
  const update = (field: keyof AssetFormData, value: string) =>
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
          <DialogTitle>Add Asset</DialogTitle>
        </DialogHeader>
        <DialogBody overflowY="auto" maxH="calc(90vh - 150px)">
          <Box mb="3">
            <Text fontWeight="medium" mb="1">
              Asset Name *
            </Text>
            <Input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Primary Residence, Savings Account"
            />
          </Box>
          <Box mb="3">
            <Text fontWeight="medium" mb="1">
              Category
            </Text>
            <select
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
              }}
            >
              {ASSET_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Box>
          <Box mb="3">
            <Text fontWeight="medium" mb="1">
              Estimated Value ($)
            </Text>
            <Input
              type="number"
              value={form.estimatedValue}
              onChange={(e) => update("estimatedValue", e.target.value)}
              placeholder="0"
            />
          </Box>
          <Box mb="3">
            <Text fontWeight="medium" mb="1">
              Ownership Type
            </Text>
            <Input
              value={form.ownershipType}
              onChange={(e) => update("ownershipType", e.target.value)}
              placeholder="e.g. Sole, Joint, Community"
            />
          </Box>
          <Box mb="3">
            <Text fontWeight="medium" mb="1">
              Account Number
            </Text>
            <Input
              value={form.accountNumber}
              onChange={(e) => update("accountNumber", e.target.value)}
            />
          </Box>
          <Box mb="3">
            <Text fontWeight="medium" mb="1">
              Institution
            </Text>
            <Input
              value={form.institution}
              onChange={(e) => update("institution", e.target.value)}
              placeholder="e.g. Bank of America, Fidelity"
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
            Add Asset
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
}
