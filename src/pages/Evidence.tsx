import { useState } from "react";
import {
  Button,
  Heading,
  HStack,
  VStack,
  Grid,
  GridItem,
} from "@chakra-ui/react";
import { LuPlus, LuFile } from "react-icons/lu";
import { observer } from "mobx-react-lite";
import { useStore } from "../store/StoreContext";
import { EmptyState } from "../components/shared/EmptyState";
import { StatCard } from "../components/shared/StatCard";
import { AddEditEvidenceDialog } from "../components/evidence/AddEditEvidenceDialog";
import { EvidenceList } from "../components/evidence/EvidenceList";
import { EvidenceFilters } from "../components/evidence/EvidenceFilters";
import type { Evidence } from "../types";

type EvidenceFormData = {
  title: string;
  exhibitNumber: string;
  description: string;
  type:
    | "document"
    | "photo"
    | "video"
    | "audio"
    | "physical"
    | "testimony"
    | "digital"
    | "other";
  fileUrl: string;
  dateCollected: string;
  location: string;
  tags: string;
  relevance: "high" | "medium" | "low";
  admissible: boolean;
  notes: string;
  caseId: string;
};

const INITIAL_FORM: EvidenceFormData = {
  title: "",
  exhibitNumber: "",
  description: "",
  type: "other",
  fileUrl: "",
  dateCollected: "",
  location: "",
  tags: "",
  relevance: "medium",
  admissible: false,
  notes: "",
  caseId: "",
};

const EvidencePage = observer(function EvidencePage() {
  const { evidenceStore, caseStore } = useStore();
  const [open, setOpen] = useState(false);
  const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null);
  const [form, setForm] = useState<EvidenceFormData>({ ...INITIAL_FORM });

  const handleAdd = () => {
    if (!form.title.trim()) return;
    evidenceStore.addEvidence({
      ...form,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setForm({ ...INITIAL_FORM });
    setOpen(false);
  };

  const handleEdit = (evidence: Evidence) => {
    setEditingEvidence(evidence);
    setForm({
      title: evidence.title,
      exhibitNumber: evidence.exhibitNumber || "",
      description: evidence.description || "",
      type: evidence.type,
      fileUrl: evidence.fileUrl || "",
      dateCollected: evidence.dateCollected || "",
      location: evidence.location || "",
      tags: evidence.tags.join(", "),
      relevance: evidence.relevance,
      admissible: evidence.admissible || false,
      notes: evidence.notes || "",
      caseId: evidence.caseId || "",
    });
    setOpen(true);
  };

  const handleSave = () => {
    if (editingEvidence) {
      evidenceStore.updateEvidence(editingEvidence.id, {
        ...form,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setEditingEvidence(null);
    } else {
      handleAdd();
    }
    setForm({ ...INITIAL_FORM });
    setOpen(false);
  };

  const handleDialogClose = (open: boolean) => {
    setOpen(open);
    if (!open) {
      setEditingEvidence(null);
      setForm({ ...INITIAL_FORM });
    }
  };

  const getCaseName = (caseId?: string) => {
    if (!caseId) return undefined;
    const caseObj = caseStore.cases.find((c) => c.id === caseId);
    return caseObj?.name;
  };

  const filteredEvidences = evidenceStore.filteredEvidences;
  const totalEvidences = evidenceStore.evidences.length;
  const highRelevanceCount = evidenceStore.highRelevanceEvidences.length;
  const admissibleCount = evidenceStore.admissibleEvidences.length;

  const cases = caseStore.cases.map((c) => ({ id: c.id, name: c.name }));

  return (
    <VStack align="stretch" gap="6">
      <HStack justifyContent="space-between">
        <Heading size="2xl">Evidence</Heading>
        <Button size="sm" onClick={() => setOpen(true)}>
          <LuPlus /> Add Evidence
        </Button>
      </HStack>

      <HStack gap="4" flexWrap="wrap">
        <StatCard label="Total Evidence" value={totalEvidences.toString()} />
        <StatCard
          label="High Relevance"
          value={highRelevanceCount.toString()}
          helpText={highRelevanceCount > 0 ? "Critical to case" : undefined}
        />
        <StatCard
          label="Admissible"
          value={admissibleCount.toString()}
          helpText={admissibleCount > 0 ? "Court-approved" : undefined}
        />
      </HStack>

      <Grid templateColumns={{ base: "1fr", lg: "280px 1fr" }} gap="6">
        <GridItem>
          <EvidenceFilters
            searchQuery={evidenceStore.searchQuery}
            onSearchChange={(q) => evidenceStore.setSearchQuery(q)}
            selectedType={evidenceStore.selectedType}
            onTypeChange={(t) => evidenceStore.setSelectedType(t)}
            selectedRelevance={evidenceStore.selectedRelevance}
            onRelevanceChange={(r) => evidenceStore.setSelectedRelevance(r)}
            selectedAdmissible={evidenceStore.selectedAdmissible}
            onAdmissibleChange={(a) => evidenceStore.setSelectedAdmissible(a)}
            selectedCaseId={evidenceStore.selectedCaseId}
            onCaseChange={(c) => evidenceStore.setSelectedCaseId(c)}
            cases={cases}
            onClearFilters={() => evidenceStore.clearFilters()}
          />
        </GridItem>

        <GridItem>
          {filteredEvidences.length === 0 && totalEvidences === 0 ? (
            <EmptyState
              icon={LuFile}
              title="No evidence yet"
              description="Organize exhibits, documents, photos, and other evidence for your cases."
            />
          ) : filteredEvidences.length === 0 ? (
            <EmptyState
              icon={LuFile}
              title="No matching evidence"
              description="Try adjusting your search or filters."
            />
          ) : (
            <EvidenceList
              evidences={filteredEvidences as unknown as Evidence[]}
              onEdit={handleEdit}
              onDelete={(id) => evidenceStore.deleteEvidence(id)}
              getCaseName={getCaseName}
            />
          )}
        </GridItem>
      </Grid>

      <AddEditEvidenceDialog
        open={open}
        onOpenChange={handleDialogClose}
        form={form}
        onFormChange={setForm}
        onSave={handleSave}
        isEdit={!!editingEvidence}
        cases={cases}
      />
    </VStack>
  );
});

export default EvidencePage;
