import { useState } from "react";
import {
  Button,
  Heading,
  HStack,
  VStack,
  Grid,
  GridItem,
} from "@chakra-ui/react";
import { LuPlus, LuFileText } from "react-icons/lu";
import { observer } from "mobx-react-lite";
import { useStore } from "../store/StoreContext";
import { EmptyState } from "../components/shared/EmptyState";
import { StatCard } from "../components/shared/StatCard";
import { AddEditFilingDialog } from "../components/filings/AddEditFilingDialog";
import { SendFaxDialog } from "../components/filings/SendFaxDialog";
import { FilingList } from "../components/filings/FilingList";
import { FilingFilters } from "../components/filings/FilingFilters";
import type { Filing } from "../types";

type FilingFormData = {
  title: string;
  date: string;
  type: string;
  notes: string;
  caseId: string;
};

const INITIAL_FORM: FilingFormData = {
  title: "",
  date: "",
  type: "",
  notes: "",
  caseId: "",
};

const Filings = observer(function Filings() {
  const { filingStore, caseStore } = useStore();
  const [open, setOpen] = useState(false);
  const [editingFiling, setEditingFiling] = useState<Filing | null>(null);
  const [form, setForm] = useState<FilingFormData>({ ...INITIAL_FORM });
  const [faxFiling, setFaxFiling] = useState<Filing | null>(null);

  const handleAdd = () => {
    if (!form.title.trim() || !form.date) return;
    filingStore.addFiling(form);
    setForm({ ...INITIAL_FORM });
    setOpen(false);
  };

  const handleEdit = (filing: Filing) => {
    setEditingFiling(filing);
    setForm({
      title: filing.title,
      date: filing.date,
      type: filing.type || "",
      notes: filing.notes || "",
      caseId: filing.caseId || "",
    });
    setOpen(true);
  };

  const handleSave = () => {
    if (editingFiling) {
      filingStore.updateFiling(editingFiling.id, form);
      setEditingFiling(null);
    } else {
      handleAdd();
    }
    setForm({ ...INITIAL_FORM });
    setOpen(false);
  };

  const handleDialogClose = (open: boolean) => {
    setOpen(open);
    if (!open) {
      setEditingFiling(null);
      setForm({ ...INITIAL_FORM });
    }
  };

  const getCaseName = (caseId?: string) => {
    if (!caseId) return undefined;
    const caseObj = caseStore.cases.find((c) => c.id === caseId);
    return caseObj?.name;
  };

  const getCourtName = (caseId?: string) => {
    if (!caseId) return undefined;
    const caseObj = caseStore.cases.find((c) => c.id === caseId);
    return caseObj?.court;
  };

  const filteredFilings = filingStore.filteredFilings;
  const totalFilings = filingStore.filings.length;
  const filingTypes = filingStore.filingTypes;

  const cases = caseStore.cases.map((c) => ({ id: c.id, name: c.name }));

  return (
    <VStack align="stretch" gap="6">
      <HStack justifyContent="space-between">
        <Heading size="2xl">Filings</Heading>
        <Button size="sm" onClick={() => setOpen(true)}>
          <LuPlus /> Add Filing
        </Button>
      </HStack>

      <HStack gap="4" flexWrap="wrap">
        <StatCard label="Total Filings" value={totalFilings.toString()} />
        <StatCard
          label="Filtered Results"
          value={filteredFilings.length.toString()}
          helpText={
            filteredFilings.length !== totalFilings
              ? "Active filters applied"
              : undefined
          }
        />
      </HStack>

      <Grid templateColumns={{ base: "1fr", lg: "280px 1fr" }} gap="6">
        <GridItem>
          <FilingFilters
            searchQuery={filingStore.searchQuery}
            onSearchChange={(q) => filingStore.setSearchQuery(q)}
            selectedType={filingStore.selectedType}
            onTypeChange={(t) => filingStore.setSelectedType(t)}
            selectedCaseId={filingStore.selectedCaseId}
            onCaseChange={(c) => filingStore.setSelectedCaseId(c)}
            dateFrom={filingStore.dateFrom}
            onDateFromChange={(d) => filingStore.setDateFrom(d)}
            dateTo={filingStore.dateTo}
            onDateToChange={(d) => filingStore.setDateTo(d)}
            filingTypes={filingTypes}
            cases={cases}
            onClearFilters={() => filingStore.clearFilters()}
          />
        </GridItem>

        <GridItem>
          {filteredFilings.length === 0 && totalFilings === 0 ? (
            <EmptyState
              icon={LuFileText}
              title="No filings yet"
              description="Create filings to track court documents, submissions, and filing receipts."
            />
          ) : filteredFilings.length === 0 ? (
            <EmptyState
              icon={LuFileText}
              title="No matching filings"
              description="Try adjusting your search or filters."
            />
          ) : (
            <FilingList
              filings={filteredFilings}
              onEdit={handleEdit}
              onDelete={(id) => filingStore.deleteFiling(id)}
              onSendFax={(filing) => setFaxFiling(filing)}
              getCaseName={getCaseName}
            />
          )}
        </GridItem>
      </Grid>

      <AddEditFilingDialog
        open={open}
        onOpenChange={handleDialogClose}
        form={form}
        onFormChange={setForm}
        onSave={handleSave}
        isEdit={!!editingFiling}
        cases={cases}
      />

      <SendFaxDialog
        open={!!faxFiling}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setFaxFiling(null);
        }}
        filing={faxFiling}
        courtName={getCourtName(faxFiling?.caseId)}
        caseId={faxFiling?.caseId}
      />
    </VStack>
  );
});

export default Filings;
