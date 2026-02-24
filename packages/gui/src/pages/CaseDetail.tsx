import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Button,
  Heading,
  HStack,
  Text,
  VStack,
  Badge,
  Tabs,
} from "@chakra-ui/react";
import { LuArrowLeft } from "react-icons/lu";
import { observer } from "mobx-react-lite";
import { useStore } from "../store/StoreContext";
import { ConfirmDialog } from "../components/shared/ConfirmDialog";
import { DetailsTab } from "../components/cases/DetailsTab";
import { PartiesTab } from "../components/cases/PartiesTab";
import { FilingsTab } from "../components/cases/FilingsTab";

const STATUS_COLOR: Record<string, string> = {
  active: "green",
  pending: "yellow",
  closed: "gray",
};

const CaseDetail = observer(function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { caseStore } = useStore();
  const caseData = caseStore.cases.find((c) => c.id === id);

  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    console.log("confirmDelete state changed:", confirmDelete);
  }, [confirmDelete]);

  if (!caseData) {
    return (
      <VStack py="20">
        <Text>Case not found.</Text>
        <Button variant="outline" onClick={() => navigate("/cases")}>
          <LuArrowLeft /> Back to Cases
        </Button>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" gap="6">
      <HStack>
        <Button variant="ghost" size="sm" onClick={() => navigate("/cases")}>
          <LuArrowLeft />
        </Button>
        <Heading size="xl" flex="1">
          {caseData.name}
        </Heading>
        <Badge colorPalette={STATUS_COLOR[caseData.status]} fontSize="sm">
          {caseData.status}
        </Badge>
      </HStack>

      <HStack gap="4" fontSize="sm" color="fg.muted" flexWrap="wrap">
        <Text>Case #: {caseData.caseNumber || "N/A"}</Text>
        <Text>Court: {caseData.court || "N/A"}</Text>
        <Text>Type: {caseData.caseType || "N/A"}</Text>
      </HStack>

      <Tabs.Root defaultValue="details" variant="line">
        <Tabs.List>
          <Tabs.Trigger value="details">Details</Tabs.Trigger>
          <Tabs.Trigger value="parties">
            Parties ({caseData.parties.length})
          </Tabs.Trigger>
          <Tabs.Trigger value="filings">
            Filings ({caseData.filings.length})
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="details">
          <DetailsTab
            caseData={caseData as unknown as import("../types").Case}
            onUpdateCase={(id, updates) => caseStore.updateCase(id, updates)}
            onDeleteClick={() => {
              console.log(
                "onDeleteClick called, setting confirmDelete to true",
              );
              setConfirmDelete(true);
            }}
          />
        </Tabs.Content>

        <Tabs.Content value="parties">
          <PartiesTab
            parties={[...caseData.parties]}
            onAddParty={(party) => caseStore.addParty(caseData.id, party)}
            onRemoveParty={(partyId) =>
              caseStore.removeParty(caseData.id, partyId)
            }
          />
        </Tabs.Content>

        <Tabs.Content value="filings">
          <FilingsTab
            filings={[...caseData.filings]}
            onAddFiling={(filing) => caseStore.addFiling(caseData.id, filing)}
            onRemoveFiling={(filingId) =>
              caseStore.removeFiling(caseData.id, filingId)
            }
          />
        </Tabs.Content>
      </Tabs.Root>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => {
          console.log("ConfirmDialog onClose called");
          setConfirmDelete(false);
        }}
        onConfirm={() => {
          console.log("ConfirmDialog onConfirm called, deleting case");
          caseStore.deleteCase(caseData.id);
          navigate("/cases");
        }}
        title="Delete Case"
      >
        <Text>
          Are you sure you want to delete "{caseData.name}"? This cannot be
          undone.
        </Text>
      </ConfirmDialog>
    </VStack>
  );
});

export default CaseDetail;
