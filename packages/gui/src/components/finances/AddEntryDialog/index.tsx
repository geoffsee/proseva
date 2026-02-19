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
import type { FinancialEntry } from "../../../types";

const SUBCATEGORIES = {
  income: [
    "Employment",
    "Child Support Received",
    "Spousal Support Received",
    "Other Income",
  ],
  expense: [
    "Housing",
    "Utilities",
    "Food",
    "Transportation",
    "Medical",
    "Child Care",
    "Insurance",
    "Child Support Paid",
    "Spousal Support Paid",
    "Debt Payments",
    "Other",
  ],
};

interface AddEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: Omit<FinancialEntry, "id">;
  onFormChange: (form: Omit<FinancialEntry, "id">) => void;
  onAdd: () => void;
}

export function AddEntryDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onAdd,
}: AddEntryDialogProps) {
  return (
    <DialogRoot open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Financial Entry</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <VStack gap="3">
            <Box w="full">
              <Text fontSize="sm" mb="1">
                Category
              </Text>
              <select
                value={form.category}
                onChange={(e) =>
                  onFormChange({
                    ...form,
                    category: e.target.value as "income" | "expense",
                    subcategory: "",
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
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </Box>
            <Box w="full">
              <Text fontSize="sm" mb="1">
                Subcategory
              </Text>
              <select
                value={form.subcategory}
                onChange={(e) =>
                  onFormChange({ ...form, subcategory: e.target.value })
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
                <option value="">Select...</option>
                {SUBCATEGORIES[form.category].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Box>
            <Box w="full">
              <Text fontSize="sm" mb="1">
                Amount
              </Text>
              <Input
                type="number"
                value={form.amount || ""}
                onChange={(e) =>
                  onFormChange({
                    ...form,
                    amount: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </Box>
            <Box w="full">
              <Text fontSize="sm" mb="1">
                Frequency
              </Text>
              <select
                value={form.frequency}
                onChange={(e) =>
                  onFormChange({
                    ...form,
                    frequency: e.target.value as FinancialEntry["frequency"],
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
                <option value="one-time">One-time</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
                <option value="annually">Annually</option>
              </select>
            </Box>
            <Box w="full">
              <Text fontSize="sm" mb="1">
                Date
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
                Description (optional)
              </Text>
              <Input
                value={form.description ?? ""}
                onChange={(e) =>
                  onFormChange({ ...form, description: e.target.value })
                }
              />
            </Box>
          </VStack>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onAdd}
            disabled={!form.subcategory || form.amount <= 0}
          >
            Add
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
}
