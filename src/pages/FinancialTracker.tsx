import { useState } from "react";
import { Button, Heading, HStack, VStack } from "@chakra-ui/react";
import { LuPlus, LuDollarSign } from "react-icons/lu";
import { observer } from "mobx-react-lite";
import { useStore } from "../store/StoreContext";
import { EmptyState } from "../components/shared/EmptyState";
import { StatCard } from "../components/shared/StatCard";
import { AddEntryDialog } from "../components/finances/AddEntryDialog";
import { EntryList } from "../components/finances/EntryList";
import type { FinancialEntry } from "../types";

const FinancialTracker = observer(function FinancialTracker() {
  const { financeStore } = useStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<FinancialEntry, "id">>({
    category: "income",
    subcategory: "",
    amount: 0,
    frequency: "monthly",
    date: new Date().toISOString().split("T")[0],
    description: "",
  });

  const totalIncome = financeStore.entries
    .filter((e) => e.category === "income")
    .reduce((s, e) => s + e.amount, 0);
  const totalExpenses = financeStore.entries
    .filter((e) => e.category === "expense")
    .reduce((s, e) => s + e.amount, 0);

  const handleAdd = () => {
    if (!form.subcategory || form.amount <= 0) return;
    financeStore.addEntry(form);
    setForm({
      category: "income",
      subcategory: "",
      amount: 0,
      frequency: "monthly",
      date: new Date().toISOString().split("T")[0],
      description: "",
    });
    setOpen(false);
  };

  return (
    <VStack align="stretch" gap="6">
      <HStack justifyContent="space-between">
        <Heading size="2xl">Finances</Heading>
        <Button size="sm" onClick={() => setOpen(true)}>
          <LuPlus /> Add Entry
        </Button>
      </HStack>

      <HStack gap="4" flexWrap="wrap">
        <StatCard
          label="Total Income"
          value={`$${totalIncome.toLocaleString()}`}
        />
        <StatCard
          label="Total Expenses"
          value={`$${totalExpenses.toLocaleString()}`}
        />
        <StatCard
          label="Net"
          value={`$${(totalIncome - totalExpenses).toLocaleString()}`}
        />
      </HStack>

      {financeStore.entries.length === 0 ? (
        <EmptyState
          icon={LuDollarSign}
          title="No entries yet"
          description="Track income and expenses for your financial declaration."
        />
      ) : (
        <EntryList
          entries={[...financeStore.entries] as unknown as FinancialEntry[]}
          onDelete={(id) => financeStore.deleteEntry(id)}
        />
      )}

      <AddEntryDialog
        open={open}
        onOpenChange={setOpen}
        form={form}
        onFormChange={setForm}
        onAdd={handleAdd}
      />
    </VStack>
  );
});

export default FinancialTracker;
