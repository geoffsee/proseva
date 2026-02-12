import { useState } from "react";
import { observer } from "mobx-react-lite";
import { Box, Button, Heading, HStack, Input, VStack } from "@chakra-ui/react";
import { LuPlus } from "react-icons/lu";
import { useStore } from "../store/StoreContext";
import { StatCard } from "../components/shared/StatCard";
import { EstatePlanList } from "../components/estate/EstatePlanList";
import { EstatePlanDetail } from "../components/estate/EstatePlanDetail";
import {
  AddEditPlanDialog,
  type PlanFormData,
} from "../components/estate/AddEditPlanDialog";
import {
  AddEditBeneficiaryDialog,
  type BeneficiaryFormData,
} from "../components/estate/AddEditBeneficiaryDialog";
import {
  AddEditAssetDialog,
  type AssetFormData,
} from "../components/estate/AddEditAssetDialog";
import { EstateDocumentWizard } from "../components/estate/EstateDocumentWizard";

type View = "overview" | "plan-detail" | "draft-document";

const INITIAL_PLAN_FORM: PlanFormData = {
  title: "",
  testatorName: "",
  testatorDateOfBirth: "",
  testatorAddress: "",
  executorName: "",
  executorPhone: "",
  executorEmail: "",
  guardianName: "",
  guardianPhone: "",
  notes: "",
};

const INITIAL_BENEFICIARY_FORM: BeneficiaryFormData = {
  name: "",
  relationship: "",
  dateOfBirth: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

const INITIAL_ASSET_FORM: AssetFormData = {
  name: "",
  category: "other",
  estimatedValue: "",
  ownershipType: "",
  accountNumber: "",
  institution: "",
  notes: "",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

const EstatePlanning = observer(function EstatePlanning() {
  const { estatePlanStore } = useStore();

  const [view, setView] = useState<View>("overview");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // Plan dialog
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planForm, setPlanForm] = useState<PlanFormData>(INITIAL_PLAN_FORM);
  const [isEditingPlan, setIsEditingPlan] = useState(false);

  // Beneficiary dialog
  const [beneficiaryDialogOpen, setBeneficiaryDialogOpen] = useState(false);
  const [beneficiaryForm, setBeneficiaryForm] = useState<BeneficiaryFormData>(
    INITIAL_BENEFICIARY_FORM,
  );

  // Asset dialog
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [assetForm, setAssetForm] = useState<AssetFormData>(INITIAL_ASSET_FORM);

  const selectedPlan = selectedPlanId
    ? estatePlanStore.getPlan(selectedPlanId)
    : null;

  // Plan actions
  const handleNewPlan = () => {
    setPlanForm(INITIAL_PLAN_FORM);
    setIsEditingPlan(false);
    setPlanDialogOpen(true);
  };

  const handleEditPlan = () => {
    if (!selectedPlan) return;
    setPlanForm({
      title: selectedPlan.title,
      testatorName: selectedPlan.testatorName,
      testatorDateOfBirth: selectedPlan.testatorDateOfBirth,
      testatorAddress: selectedPlan.testatorAddress,
      executorName: selectedPlan.executorName,
      executorPhone: selectedPlan.executorPhone,
      executorEmail: selectedPlan.executorEmail,
      guardianName: selectedPlan.guardianName,
      guardianPhone: selectedPlan.guardianPhone,
      notes: selectedPlan.notes,
    });
    setIsEditingPlan(true);
    setPlanDialogOpen(true);
  };

  const handleSavePlan = async () => {
    if (isEditingPlan && selectedPlanId) {
      await estatePlanStore.updatePlan(selectedPlanId, { ...planForm });
    } else {
      await estatePlanStore.addPlan(planForm);
    }
    setPlanDialogOpen(false);
  };

  const handleDeletePlan = async () => {
    if (!selectedPlanId) return;
    await estatePlanStore.deletePlan(selectedPlanId);
    setSelectedPlanId(null);
    setView("overview");
  };

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    setView("plan-detail");
  };

  // Beneficiary actions
  const handleAddBeneficiary = () => {
    setBeneficiaryForm(INITIAL_BENEFICIARY_FORM);
    setBeneficiaryDialogOpen(true);
  };

  const handleSaveBeneficiary = async () => {
    if (!selectedPlanId) return;
    await estatePlanStore.addBeneficiary(selectedPlanId, beneficiaryForm);
    setBeneficiaryDialogOpen(false);
  };

  const handleRemoveBeneficiary = async (id: string) => {
    if (!selectedPlanId) return;
    await estatePlanStore.removeBeneficiary(selectedPlanId, id);
  };

  // Asset actions
  const handleAddAsset = () => {
    setAssetForm(INITIAL_ASSET_FORM);
    setAssetDialogOpen(true);
  };

  const handleSaveAsset = async () => {
    if (!selectedPlanId) return;
    await estatePlanStore.addAsset(selectedPlanId, {
      ...assetForm,
      estimatedValue: parseFloat(assetForm.estimatedValue) || 0,
    });
    setAssetDialogOpen(false);
  };

  const handleRemoveAsset = async (id: string) => {
    if (!selectedPlanId) return;
    await estatePlanStore.removeAsset(selectedPlanId, id);
  };

  // Document actions
  const handleDraftDocument = () => {
    setView("draft-document");
  };

  const handleSaveDocument = async (data: {
    type: string;
    title: string;
    content: string;
    fieldValues: Record<string, string>;
    templateId: string;
  }) => {
    if (!selectedPlanId) return;
    await estatePlanStore.addEstateDocument(selectedPlanId, {
      type: data.type,
      title: data.title,
      content: data.content,
      fieldValues: data.fieldValues,
      templateId: data.templateId,
      status: "draft",
    });
    setView("plan-detail");
  };

  const handleEditDocument = (docId: string) => {
    // For simplicity, clicking edit on a document just shows the content
    // Could open a dialog to edit status/notes
    if (!selectedPlanId || !selectedPlan) return;
    const doc = selectedPlan.documents.find((d) => d.id === docId);
    if (doc) {
      // Cycle to next status as a quick edit
      const statusOrder = [
        "not-started",
        "draft",
        "review",
        "signed",
        "notarized",
        "filed",
      ];
      const idx = statusOrder.indexOf(doc.status);
      if (idx >= 0 && idx < statusOrder.length - 1) {
        estatePlanStore.updateEstateDocument(selectedPlanId, docId, {
          status: statusOrder[idx + 1],
        });
      }
    }
  };

  const handleRemoveDocument = async (docId: string) => {
    if (!selectedPlanId) return;
    await estatePlanStore.removeEstateDocument(selectedPlanId, docId);
  };

  const handleDocumentStatusChange = async (docId: string, status: string) => {
    if (!selectedPlanId) return;
    await estatePlanStore.updateEstateDocument(selectedPlanId, docId, {
      status,
    });
  };

  // Overview view
  if (view === "overview") {
    return (
      <VStack align="stretch" gap="6">
        <HStack justifyContent="space-between">
          <Heading size="2xl">Estate Planning</Heading>
          <Button onClick={handleNewPlan}>
            <LuPlus /> New Plan
          </Button>
        </HStack>

        <HStack gap="4" flexWrap="wrap">
          <StatCard label="Estate Plans" value={estatePlanStore.plans.length} />
          <StatCard
            label="Total Estate Value"
            value={formatCurrency(estatePlanStore.totalEstateValue)}
          />
          <StatCard
            label="Reviews Due"
            value={estatePlanStore.documentsNeedingReview.length}
            helpText={
              estatePlanStore.documentsNeedingReview.length > 0
                ? "Documents need review"
                : "All up to date"
            }
          />
        </HStack>

        {/* Filters */}
        <HStack gap="4" flexWrap="wrap">
          <Box flex="1" minW="200px">
            <Input
              placeholder="Search plans..."
              value={estatePlanStore.searchQuery}
              onChange={(e) => estatePlanStore.setSearchQuery(e.target.value)}
            />
          </Box>
          <select
            value={estatePlanStore.selectedStatus}
            onChange={(e) => estatePlanStore.setSelectedStatus(e.target.value)}
            style={{
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
            }}
          >
            <option value="all">All Statuses</option>
            <option value="planning">Planning</option>
            <option value="drafting">Drafting</option>
            <option value="review">Review</option>
            <option value="complete">Complete</option>
          </select>
        </HStack>

        <EstatePlanList
          plans={estatePlanStore.filteredPlans}
          onSelect={handleSelectPlan}
          onNewPlan={handleNewPlan}
        />

        <AddEditPlanDialog
          open={planDialogOpen}
          onOpenChange={setPlanDialogOpen}
          form={planForm}
          onFormChange={setPlanForm}
          onSave={handleSavePlan}
          isEdit={isEditingPlan}
        />
      </VStack>
    );
  }

  // Draft document view
  if (view === "draft-document") {
    return (
      <EstateDocumentWizard
        onSave={handleSaveDocument}
        onCancel={() => setView("plan-detail")}
      />
    );
  }

  // Plan detail view
  if (view === "plan-detail" && selectedPlan) {
    return (
      <>
        <EstatePlanDetail
          plan={selectedPlan}
          onBack={() => {
            setView("overview");
            setSelectedPlanId(null);
          }}
          onEdit={handleEditPlan}
          onDelete={handleDeletePlan}
          onAddBeneficiary={handleAddBeneficiary}
          onRemoveBeneficiary={handleRemoveBeneficiary}
          onAddAsset={handleAddAsset}
          onRemoveAsset={handleRemoveAsset}
          onDraftDocument={handleDraftDocument}
          onEditDocument={handleEditDocument}
          onRemoveDocument={handleRemoveDocument}
          onDocumentStatusChange={handleDocumentStatusChange}
        />

        <AddEditPlanDialog
          open={planDialogOpen}
          onOpenChange={setPlanDialogOpen}
          form={planForm}
          onFormChange={setPlanForm}
          onSave={handleSavePlan}
          isEdit={isEditingPlan}
        />

        <AddEditBeneficiaryDialog
          open={beneficiaryDialogOpen}
          onOpenChange={setBeneficiaryDialogOpen}
          form={beneficiaryForm}
          onFormChange={setBeneficiaryForm}
          onSave={handleSaveBeneficiary}
        />

        <AddEditAssetDialog
          open={assetDialogOpen}
          onOpenChange={setAssetDialogOpen}
          form={assetForm}
          onFormChange={setAssetForm}
          onSave={handleSaveAsset}
        />
      </>
    );
  }

  // Fallback — go back to overview
  return null;
});

export default EstatePlanning;
