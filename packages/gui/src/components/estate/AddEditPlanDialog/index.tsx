import { Box, Button, Input, Text, Textarea } from "@chakra-ui/react";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from "@chakra-ui/react";

export interface PlanFormData {
  title: string;
  testatorName: string;
  testatorDateOfBirth: string;
  testatorAddress: string;
  executorName: string;
  executorPhone: string;
  executorEmail: string;
  guardianName: string;
  guardianPhone: string;
  notes: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: PlanFormData;
  onFormChange: (form: PlanFormData) => void;
  onSave: () => void;
  isEdit?: boolean;
}

export function AddEditPlanDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSave,
  isEdit,
}: Props) {
  const update = (field: keyof PlanFormData, value: string) =>
    onFormChange({ ...form, [field]: value });

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
          <DialogTitle>
            {isEdit ? "Edit Estate Plan" : "New Estate Plan"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody overflowY="auto" maxH="calc(90vh - 150px)">
          <Box mb="4">
            <Text fontWeight="medium" mb="1">
              Plan Title *
            </Text>
            <Input
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g. My Estate Plan 2025"
            />
          </Box>

          <Text fontWeight="semibold" fontSize="md" mb="2" mt="4">
            Testator Information
          </Text>
          <Box mb="3">
            <Text fontWeight="medium" mb="1">
              Full Legal Name
            </Text>
            <Input
              value={form.testatorName}
              onChange={(e) => update("testatorName", e.target.value)}
            />
          </Box>
          <Box mb="3">
            <Text fontWeight="medium" mb="1">
              Date of Birth
            </Text>
            <Input
              type="date"
              value={form.testatorDateOfBirth}
              onChange={(e) => update("testatorDateOfBirth", e.target.value)}
            />
          </Box>
          <Box mb="3">
            <Text fontWeight="medium" mb="1">
              Address
            </Text>
            <Input
              value={form.testatorAddress}
              onChange={(e) => update("testatorAddress", e.target.value)}
            />
          </Box>

          <Text fontWeight="semibold" fontSize="md" mb="2" mt="4">
            Executor Information
          </Text>
          <Box mb="3">
            <Text fontWeight="medium" mb="1">
              Executor Name
            </Text>
            <Input
              value={form.executorName}
              onChange={(e) => update("executorName", e.target.value)}
            />
          </Box>
          <Box mb="3">
            <Text fontWeight="medium" mb="1">
              Executor Phone
            </Text>
            <Input
              value={form.executorPhone}
              onChange={(e) => update("executorPhone", e.target.value)}
            />
          </Box>
          <Box mb="3">
            <Text fontWeight="medium" mb="1">
              Executor Email
            </Text>
            <Input
              value={form.executorEmail}
              onChange={(e) => update("executorEmail", e.target.value)}
            />
          </Box>

          <Text fontWeight="semibold" fontSize="md" mb="2" mt="4">
            Guardian Information (optional)
          </Text>
          <Box mb="3">
            <Text fontWeight="medium" mb="1">
              Guardian Name
            </Text>
            <Input
              value={form.guardianName}
              onChange={(e) => update("guardianName", e.target.value)}
            />
          </Box>
          <Box mb="3">
            <Text fontWeight="medium" mb="1">
              Guardian Phone
            </Text>
            <Input
              value={form.guardianPhone}
              onChange={(e) => update("guardianPhone", e.target.value)}
            />
          </Box>

          <Box mb="3">
            <Text fontWeight="medium" mb="1">
              Notes
            </Text>
            <Textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
            />
          </Box>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!form.title.trim()}>
            {isEdit ? "Save Changes" : "Create Plan"}
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
}
