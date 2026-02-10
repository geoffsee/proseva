import { useState } from "react";
import {
  Box,
  Button,
  Heading,
  HStack,
  Input,
  Text,
  VStack,
  Badge,
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { LuPlus, LuFolder } from "react-icons/lu";
import { observer } from "mobx-react-lite";
import { useStore } from "../store/StoreContext";
import { EmptyState } from "../components/shared/EmptyState";
import { VIRGINIA_COURTS } from "../lib/virginia";

const STATUS_COLOR: Record<string, string> = {
  active: "green",
  pending: "yellow",
  closed: "gray",
};

const CaseTracker = observer(function CaseTracker() {
  const { caseStore } = useStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    caseNumber: "",
    court: "",
    caseType: "",
    status: "active" as const,
    notes: "",
  });

  const handleAdd = () => {
    if (!form.name) return;
    caseStore.addCase(form);
    setForm({
      name: "",
      caseNumber: "",
      court: "",
      caseType: "",
      status: "active",
      notes: "",
    });
    setOpen(false);
  };

  return (
    <VStack align="stretch" gap="6">
      <HStack justifyContent="space-between">
        <Heading size="2xl">Cases</Heading>
        <Button size="sm" onClick={() => setOpen(true)}>
          <LuPlus /> Add Case
        </Button>
      </HStack>

      {caseStore.cases.length === 0 ? (
        <EmptyState
          icon={LuFolder}
          title="No cases yet"
          description="Create your first case to start tracking."
        >
          <Button size="sm" onClick={() => setOpen(true)}>
            <LuPlus /> Add Case
          </Button>
        </EmptyState>
      ) : (
        <VStack align="stretch" gap="3">
          {caseStore.cases.map((c) => (
            <Link key={c.id} to={`/cases/${c.id}`}>
              <HStack
                borderWidth="1px"
                p="4"
                borderRadius="md"
                justifyContent="space-between"
                _hover={{ bg: "bg.muted" }}
              >
                <Box>
                  <Text fontWeight="bold">{c.name}</Text>
                  <Text fontSize="sm" color="fg.muted">
                    {c.caseNumber} &middot; {c.court}
                  </Text>
                </Box>
                <Badge colorPalette={STATUS_COLOR[c.status]}>{c.status}</Badge>
              </HStack>
            </Link>
          ))}
        </VStack>
      )}

      <DialogRoot open={open} onOpenChange={(e) => setOpen(e.open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Case</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <VStack gap="3">
              <Input
                placeholder="Case name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                placeholder="Case number"
                value={form.caseNumber}
                onChange={(e) =>
                  setForm({ ...form, caseNumber: e.target.value })
                }
              />
              <Box w="full">
                <select
                  value={form.court}
                  onChange={(e) => setForm({ ...form, court: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid var(--chakra-colors-border)",
                    background: "transparent",
                    color: "inherit",
                  }}
                >
                  <option value="">Select court...</option>
                  {VIRGINIA_COURTS.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Box>
              <Input
                placeholder="Case type (e.g., Divorce, Custody)"
                value={form.caseType}
                onChange={(e) => setForm({ ...form, caseType: e.target.value })}
              />
            </VStack>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!form.name}>
              Create
            </Button>
          </DialogFooter>
          <DialogCloseTrigger />
        </DialogContent>
      </DialogRoot>
    </VStack>
  );
});

export default CaseTracker;
