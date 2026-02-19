import { Box, Button, HStack, Text, VStack, Badge } from "@chakra-ui/react";
import { LuScroll } from "react-icons/lu";
import { EmptyState } from "../../shared/EmptyState";

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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

interface Plan {
  id: string;
  title: string;
  status: string;
  testatorName: string;
  beneficiaries: { id: string }[];
  assets: { id: string; estimatedValue: number }[];
  documents: { id: string }[];
  updatedAt: string;
}

interface Props {
  plans: Plan[];
  onSelect: (planId: string) => void;
  onNewPlan: () => void;
}

export function EstatePlanList({ plans, onSelect, onNewPlan }: Props) {
  if (plans.length === 0) {
    return (
      <EmptyState
        icon={LuScroll}
        title="No estate plans yet"
        description="Create your first estate plan to organize your will, beneficiaries, assets, and important documents."
      >
        <Button onClick={onNewPlan} size="sm" mt="2">
          Create First Plan
        </Button>
      </EmptyState>
    );
  }

  return (
    <VStack align="stretch" gap="4">
      {plans.map((plan) => {
        const totalValue = plan.assets.reduce(
          (sum, a) => sum + a.estimatedValue,
          0,
        );
        return (
          <Box
            key={plan.id}
            borderWidth="1px"
            borderRadius="lg"
            p="5"
            cursor="pointer"
            _hover={{ bg: "bg.muted" }}
            onClick={() => onSelect(plan.id)}
          >
            <HStack justifyContent="space-between" mb="2">
              <Text fontWeight="bold" fontSize="lg">
                {plan.title}
              </Text>
              <Badge colorPalette={STATUS_COLORS[plan.status] ?? "gray"}>
                {STATUS_LABELS[plan.status] ?? plan.status}
              </Badge>
            </HStack>
            {plan.testatorName && (
              <Text fontSize="sm" color="fg.muted" mb="2">
                Testator: {plan.testatorName}
              </Text>
            )}
            <HStack gap="4" flexWrap="wrap">
              <Text fontSize="sm">
                {plan.beneficiaries.length} beneficiar
                {plan.beneficiaries.length === 1 ? "y" : "ies"}
              </Text>
              <Text fontSize="sm">
                {plan.assets.length} asset{plan.assets.length === 1 ? "" : "s"}
              </Text>
              <Text fontSize="sm">
                {plan.documents.length} document
                {plan.documents.length === 1 ? "" : "s"}
              </Text>
              {totalValue > 0 && (
                <Text fontSize="sm" fontWeight="semibold" color="green.600">
                  {formatCurrency(totalValue)}
                </Text>
              )}
            </HStack>
            <Text fontSize="xs" color="fg.muted" mt="2">
              Updated {new Date(plan.updatedAt).toLocaleDateString()}
            </Text>
          </Box>
        );
      })}
    </VStack>
  );
}
