import {
  Box,
  Button,
  HStack,
  Text,
  VStack,
  Badge,
  IconButton,
} from "@chakra-ui/react";
import { LuPlus, LuTrash2, LuUser } from "react-icons/lu";
import { EmptyState } from "../../shared/EmptyState";

interface Beneficiary {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
}

interface Props {
  beneficiaries: Beneficiary[];
  onAdd: () => void;
  onRemove: (id: string) => void;
}

export function BeneficiaryList({ beneficiaries, onAdd, onRemove }: Props) {
  return (
    <Box>
      <HStack justifyContent="space-between" mb="4">
        <Text fontWeight="semibold" fontSize="lg">
          Beneficiaries
        </Text>
        <Button size="sm" onClick={onAdd}>
          <LuPlus /> Add
        </Button>
      </HStack>

      {beneficiaries.length === 0 ? (
        <EmptyState
          icon={LuUser}
          title="No beneficiaries yet"
          description="Add the people or organizations who will inherit from this plan."
        />
      ) : (
        <VStack align="stretch" gap="3">
          {beneficiaries.map((b) => (
            <HStack
              key={b.id}
              borderWidth="1px"
              borderRadius="md"
              p="3"
              justifyContent="space-between"
            >
              <Box>
                <Text fontWeight="medium">{b.name}</Text>
                <HStack gap="2" mt="1">
                  {b.relationship && <Badge size="sm">{b.relationship}</Badge>}
                  {b.email && (
                    <Text fontSize="xs" color="fg.muted">
                      {b.email}
                    </Text>
                  )}
                  {b.phone && (
                    <Text fontSize="xs" color="fg.muted">
                      {b.phone}
                    </Text>
                  )}
                </HStack>
              </Box>
              <IconButton
                aria-label="Remove beneficiary"
                variant="ghost"
                size="sm"
                colorPalette="red"
                onClick={() => onRemove(b.id)}
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
