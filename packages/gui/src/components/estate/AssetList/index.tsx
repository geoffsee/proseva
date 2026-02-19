import {
  Box,
  Button,
  HStack,
  Text,
  VStack,
  Badge,
  IconButton,
} from "@chakra-ui/react";
import { LuPlus, LuTrash2, LuWallet } from "react-icons/lu";
import { EmptyState } from "../../shared/EmptyState";

const CATEGORY_LABELS: Record<string, string> = {
  "real-property": "Real Property",
  "bank-account": "Bank Account",
  investment: "Investment",
  retirement: "Retirement",
  insurance: "Insurance",
  vehicle: "Vehicle",
  "personal-property": "Personal Property",
  "business-interest": "Business Interest",
  "digital-asset": "Digital Asset",
  other: "Other",
};

interface Asset {
  id: string;
  name: string;
  category: string;
  estimatedValue: number;
  ownershipType: string;
  institution: string;
}

interface Props {
  assets: Asset[];
  onAdd: () => void;
  onRemove: (id: string) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function AssetList({ assets, onAdd, onRemove }: Props) {
  const totalValue = assets.reduce((sum, a) => sum + a.estimatedValue, 0);

  return (
    <Box>
      <HStack justifyContent="space-between" mb="4">
        <HStack gap="3">
          <Text fontWeight="semibold" fontSize="lg">
            Assets
          </Text>
          {assets.length > 0 && (
            <Badge colorPalette="green" size="sm">
              Total: {formatCurrency(totalValue)}
            </Badge>
          )}
        </HStack>
        <Button size="sm" onClick={onAdd}>
          <LuPlus /> Add
        </Button>
      </HStack>

      {assets.length === 0 ? (
        <EmptyState
          icon={LuWallet}
          title="No assets yet"
          description="Add your real property, accounts, investments, and other assets."
        />
      ) : (
        <VStack align="stretch" gap="3">
          {assets.map((a) => (
            <HStack
              key={a.id}
              borderWidth="1px"
              borderRadius="md"
              p="3"
              justifyContent="space-between"
            >
              <Box>
                <Text fontWeight="medium">{a.name}</Text>
                <HStack gap="2" mt="1">
                  <Badge size="sm" colorPalette="blue">
                    {CATEGORY_LABELS[a.category] ?? a.category}
                  </Badge>
                  <Text fontSize="sm" fontWeight="semibold" color="green.600">
                    {formatCurrency(a.estimatedValue)}
                  </Text>
                  {a.ownershipType && (
                    <Text fontSize="xs" color="fg.muted">
                      {a.ownershipType}
                    </Text>
                  )}
                  {a.institution && (
                    <Text fontSize="xs" color="fg.muted">
                      {a.institution}
                    </Text>
                  )}
                </HStack>
              </Box>
              <IconButton
                aria-label="Remove asset"
                variant="ghost"
                size="sm"
                colorPalette="red"
                onClick={() => onRemove(a.id)}
              >
                <LuTrash2 />
              </IconButton>
            </HStack>
          ))}
        </VStack>
      )}
    </Box>
  );
}
