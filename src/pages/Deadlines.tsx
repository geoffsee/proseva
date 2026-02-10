import { useState } from "react";
import {
  Button,
  Heading,
  HStack,
  VStack,
  Grid,
  GridItem,
} from "@chakra-ui/react";
import { LuPlus, LuClock } from "react-icons/lu";
import { observer } from "mobx-react-lite";
import { useStore } from "../store/StoreContext";
import { EmptyState } from "../components/shared/EmptyState";
import { StatCard } from "../components/shared/StatCard";
import { AddEditDeadlineDialog } from "../components/deadlines/AddEditDeadlineDialog";
import { DeadlineList } from "../components/deadlines/DeadlineList";
import { DeadlineFilters } from "../components/deadlines/DeadlineFilters";
import type { Deadline } from "../types";

type DeadlineFormData = {
  title: string;
  date: string;
  type: "filing" | "hearing" | "discovery" | "other";
  description: string;
  priority: "low" | "medium" | "high";
  caseId: string;
};

const INITIAL_FORM: DeadlineFormData = {
  title: "",
  date: "",
  type: "other",
  description: "",
  priority: "medium",
  caseId: "",
};

const Deadlines = observer(function Deadlines() {
  const { deadlineStore, caseStore } = useStore();
  const [open, setOpen] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null);
  const [form, setForm] = useState<DeadlineFormData>({ ...INITIAL_FORM });

  const handleAdd = () => {
    if (!form.title.trim() || !form.date) return;
    deadlineStore.addDeadline(form);
    setForm({ ...INITIAL_FORM });
    setOpen(false);
  };

  const handleEdit = (deadline: Deadline) => {
    setEditingDeadline(deadline);
    setForm({
      title: deadline.title,
      date: deadline.date,
      type: deadline.type,
      description: deadline.description || "",
      priority: deadline.priority || "medium",
      caseId: deadline.caseId || "",
    });
    setOpen(true);
  };

  const handleSave = () => {
    if (editingDeadline) {
      deadlineStore.updateDeadline(editingDeadline.id, form);
      setEditingDeadline(null);
    } else {
      handleAdd();
    }
    setForm({ ...INITIAL_FORM });
    setOpen(false);
  };

  const handleDialogClose = (open: boolean) => {
    setOpen(open);
    if (!open) {
      setEditingDeadline(null);
      setForm({ ...INITIAL_FORM });
    }
  };

  const getCaseName = (caseId?: string) => {
    if (!caseId) return undefined;
    const caseObj = caseStore.cases.find((c) => c.id === caseId);
    return caseObj?.name;
  };

  const filteredDeadlines =
    deadlineStore.filteredDeadlines as unknown as (Deadline & {
      urgency: "overdue" | "urgent" | "upcoming" | "future";
      daysUntil: number;
    })[];
  const totalDeadlines = deadlineStore.deadlines.length;
  const overdueCount = deadlineStore.overdueDeadlines.length;
  const urgentCount = deadlineStore.urgentDeadlines.length;
  const upcomingCount = deadlineStore.upcomingDeadlines.length;
  const futureCount = deadlineStore.futureDeadlines.length;

  const cases = caseStore.cases.map((c) => ({ id: c.id, name: c.name }));

  return (
    <VStack align="stretch" gap="6">
      <HStack justifyContent="space-between">
        <Heading size="2xl">Deadlines</Heading>
        <Button size="sm" onClick={() => setOpen(true)}>
          <LuPlus /> Add Deadline
        </Button>
      </HStack>

      <HStack gap="4" flexWrap="wrap">
        <StatCard label="Total Deadlines" value={totalDeadlines.toString()} />
        <StatCard
          label="Overdue"
          value={overdueCount.toString()}
          helpText={
            overdueCount > 0 ? "Requires immediate attention" : undefined
          }
        />
        <StatCard
          label="Urgent"
          value={urgentCount.toString()}
          helpText={urgentCount > 0 ? "Due within 3 days" : undefined}
        />
        <StatCard
          label="Upcoming"
          value={upcomingCount.toString()}
          helpText={upcomingCount > 0 ? "Due within 14 days" : undefined}
        />
        <StatCard
          label="Future"
          value={futureCount.toString()}
          helpText={futureCount > 0 ? "Beyond 14 days" : undefined}
        />
      </HStack>

      <Grid templateColumns={{ base: "1fr", lg: "280px 1fr" }} gap="6">
        <GridItem>
          <DeadlineFilters
            searchQuery={deadlineStore.searchQuery}
            onSearchChange={(q) => deadlineStore.setSearchQuery(q)}
            selectedType={deadlineStore.selectedType}
            onTypeChange={(t) => deadlineStore.setSelectedType(t)}
            selectedUrgency={deadlineStore.selectedUrgency}
            onUrgencyChange={(u) => deadlineStore.setSelectedUrgency(u)}
            selectedCaseId={deadlineStore.selectedCaseId}
            onCaseChange={(c) => deadlineStore.setSelectedCaseId(c)}
            cases={cases}
            onClearFilters={() => deadlineStore.clearFilters()}
          />
        </GridItem>

        <GridItem>
          {filteredDeadlines.length === 0 && totalDeadlines === 0 ? (
            <EmptyState
              icon={LuClock}
              title="No deadlines yet"
              description="Create deadlines to track critical court dates, filing deadlines, and time-sensitive requirements."
            />
          ) : filteredDeadlines.length === 0 ? (
            <EmptyState
              icon={LuClock}
              title="No matching deadlines"
              description="Try adjusting your search or filters."
            />
          ) : (
            <DeadlineList
              deadlines={filteredDeadlines}
              onToggleComplete={(id) => deadlineStore.toggleComplete(id)}
              onEdit={handleEdit}
              onDelete={(id) => deadlineStore.deleteDeadline(id)}
              getCaseName={getCaseName}
            />
          )}
        </GridItem>
      </Grid>

      <AddEditDeadlineDialog
        open={open}
        onOpenChange={handleDialogClose}
        form={form}
        onFormChange={setForm}
        onSave={handleSave}
        isEdit={!!editingDeadline}
        cases={cases}
      />
    </VStack>
  );
});

export default Deadlines;
