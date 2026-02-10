import { Box, Button, HStack, Text, VStack, Badge } from "@chakra-ui/react";
import { LuArrowLeft, LuPencil, LuTrash2, LuBookOpen } from "react-icons/lu";
import { BeneficiaryList } from "../BeneficiaryList";
import { AssetList } from "../AssetList";
import { EstateDocumentList } from "../EstateDocumentList";
import { VIRGINIA_ESTATE_STATUTES } from "../../../lib/virginia/estate-statutes";
import { ESTATE_GLOSSARY } from "../../../lib/virginia/estate-glossary";

const STATUS_COLORS: Record<string, string> = {
  planning: "gray",
  drafting: "yellow",
  review: "blue",
  complete: "green",
};

const STATUS_LABELS: Record<string, string> = {
  planning: "Planning",
  drafting: "Drafting",
  review: "Review",
  complete: "Complete",
};

interface Plan {
  id: string;
  title: string;
  status: string;
  testatorName: string;
  testatorDateOfBirth: string;
  testatorAddress: string;
  executorName: string;
  executorPhone: string;
  executorEmail: string;
  guardianName: string;
  guardianPhone: string;
  beneficiaries: {
    id: string;
    name: string;
    relationship: string;
    phone: string;
    email: string;
  }[];
  assets: {
    id: string;
    name: string;
    category: string;
    estimatedValue: number;
    ownershipType: string;
    institution: string;
  }[];
  documents: {
    id: string;
    type: string;
    title: string;
    status: string;
    reviewDate: string;
    updatedAt: string;
  }[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  plan: Plan;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddBeneficiary: () => void;
  onRemoveBeneficiary: (id: string) => void;
  onAddAsset: () => void;
  onRemoveAsset: (id: string) => void;
  onDraftDocument: () => void;
  onEditDocument: (docId: string) => void;
  onRemoveDocument: (docId: string) => void;
  onDocumentStatusChange: (docId: string, status: string) => void;
}

export function EstatePlanDetail({
  plan,
  onBack,
  onEdit,
  onDelete,
  onAddBeneficiary,
  onRemoveBeneficiary,
  onAddAsset,
  onRemoveAsset,
  onDraftDocument,
  onEditDocument,
  onRemoveDocument,
  onDocumentStatusChange,
}: Props) {
  return (
    <VStack align="stretch" gap="6">
      {/* Header */}
      <HStack justifyContent="space-between" flexWrap="wrap" gap="2">
        <HStack gap="3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <LuArrowLeft /> Back
          </Button>
          <Text fontWeight="bold" fontSize="2xl">
            {plan.title}
          </Text>
          <Badge colorPalette={STATUS_COLORS[plan.status] ?? "gray"} size="lg">
            {STATUS_LABELS[plan.status] ?? plan.status}
          </Badge>
        </HStack>
        <HStack gap="2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <LuPencil /> Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            colorPalette="red"
            onClick={onDelete}
          >
            <LuTrash2 /> Delete
          </Button>
        </HStack>
      </HStack>

      {/* Plan Info */}
      <Box borderWidth="1px" borderRadius="lg" p="5">
        <Text fontWeight="semibold" fontSize="lg" mb="3">
          Plan Information
        </Text>
        <VStack align="stretch" gap="2">
          {plan.testatorName && (
            <HStack>
              <Text fontWeight="medium" minW="140px">
                Testator:
              </Text>
              <Text>{plan.testatorName}</Text>
            </HStack>
          )}
          {plan.testatorDateOfBirth && (
            <HStack>
              <Text fontWeight="medium" minW="140px">
                Date of Birth:
              </Text>
              <Text>{plan.testatorDateOfBirth}</Text>
            </HStack>
          )}
          {plan.testatorAddress && (
            <HStack>
              <Text fontWeight="medium" minW="140px">
                Address:
              </Text>
              <Text>{plan.testatorAddress}</Text>
            </HStack>
          )}
          {plan.executorName && (
            <HStack>
              <Text fontWeight="medium" minW="140px">
                Executor:
              </Text>
              <Text>{plan.executorName}</Text>
            </HStack>
          )}
          {plan.executorPhone && (
            <HStack>
              <Text fontWeight="medium" minW="140px">
                Executor Phone:
              </Text>
              <Text>{plan.executorPhone}</Text>
            </HStack>
          )}
          {plan.executorEmail && (
            <HStack>
              <Text fontWeight="medium" minW="140px">
                Executor Email:
              </Text>
              <Text>{plan.executorEmail}</Text>
            </HStack>
          )}
          {plan.guardianName && (
            <HStack>
              <Text fontWeight="medium" minW="140px">
                Guardian:
              </Text>
              <Text>{plan.guardianName}</Text>
            </HStack>
          )}
          {plan.guardianPhone && (
            <HStack>
              <Text fontWeight="medium" minW="140px">
                Guardian Phone:
              </Text>
              <Text>{plan.guardianPhone}</Text>
            </HStack>
          )}
          {plan.notes && (
            <HStack alignItems="flex-start">
              <Text fontWeight="medium" minW="140px">
                Notes:
              </Text>
              <Text>{plan.notes}</Text>
            </HStack>
          )}
        </VStack>
      </Box>

      {/* Beneficiaries */}
      <Box borderWidth="1px" borderRadius="lg" p="5">
        <BeneficiaryList
          beneficiaries={plan.beneficiaries}
          onAdd={onAddBeneficiary}
          onRemove={onRemoveBeneficiary}
        />
      </Box>

      {/* Assets */}
      <Box borderWidth="1px" borderRadius="lg" p="5">
        <AssetList
          assets={plan.assets}
          onAdd={onAddAsset}
          onRemove={onRemoveAsset}
        />
      </Box>

      {/* Documents */}
      <Box borderWidth="1px" borderRadius="lg" p="5">
        <EstateDocumentList
          documents={plan.documents}
          onDraft={onDraftDocument}
          onEdit={onEditDocument}
          onRemove={onRemoveDocument}
          onStatusChange={onDocumentStatusChange}
        />
      </Box>

      {/* Virginia Legal References */}
      <Box borderWidth="1px" borderRadius="lg" p="5">
        <HStack mb="4" gap="2">
          <LuBookOpen />
          <Text fontWeight="semibold" fontSize="lg">
            Virginia Legal References
          </Text>
        </HStack>

        <Text fontWeight="medium" mb="2">
          Key Statutes
        </Text>
        <VStack align="stretch" gap="2" mb="4">
          {VIRGINIA_ESTATE_STATUTES.slice(0, 6).map((statute) => (
            <HStack
              key={statute.code}
              justifyContent="space-between"
              p="2"
              borderWidth="1px"
              borderRadius="md"
            >
              <Box>
                <Text fontSize="sm" fontWeight="semibold">
                  {statute.code}
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  {statute.title} — {statute.description}
                </Text>
              </Box>
            </HStack>
          ))}
        </VStack>

        <Text fontWeight="medium" mb="2">
          Estate Planning Glossary
        </Text>
        <VStack align="stretch" gap="1">
          {ESTATE_GLOSSARY.slice(0, 8).map((entry) => (
            <HStack key={entry.term} p="2" gap="3">
              <Text fontSize="sm" fontWeight="semibold" minW="160px">
                {entry.term}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {entry.definition}
              </Text>
            </HStack>
          ))}
        </VStack>
      </Box>
    </VStack>
  );
}
