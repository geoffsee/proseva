import { useState } from "react";
import {
  Box,
  Button,
  HStack,
  Input,
  Text,
  VStack,
  IconButton,
} from "@chakra-ui/react";
import { LuPlus, LuTrash2 } from "react-icons/lu";
import type { Party } from "../../../types";

interface PartiesTabProps {
  parties: Party[];
  onAddParty: (party: Omit<Party, "id">) => void;
  onRemoveParty: (partyId: string) => void;
}

export function PartiesTab({
  parties,
  onAddParty,
  onRemoveParty,
}: PartiesTabProps) {
  const [form, setForm] = useState({ name: "", role: "", contact: "" });

  const handleAdd = () => {
    if (!form.name || !form.role) return;
    onAddParty(form);
    setForm({ name: "", role: "", contact: "" });
  };

  return (
    <VStack align="stretch" gap="4" mt="4">
      {parties.map((p) => (
        <HStack
          key={p.id}
          borderWidth="1px"
          p="3"
          borderRadius="md"
          justifyContent="space-between"
        >
          <Box>
            <Text fontWeight="medium">{p.name}</Text>
            <Text fontSize="sm" color="fg.muted">
              {p.role}
              {p.contact ? ` · ${p.contact}` : ""}
            </Text>
          </Box>
          <IconButton
            aria-label="Remove party"
            variant="ghost"
            size="sm"
            onClick={() => onRemoveParty(p.id)}
          >
            <LuTrash2 />
          </IconButton>
        </HStack>
      ))}
      <Box borderWidth="1px" p="4" borderRadius="md">
        <Text fontSize="sm" fontWeight="medium" mb="2">
          Add Party
        </Text>
        <VStack gap="2">
          <HStack w="full" gap="2">
            <Input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              placeholder="Role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            />
          </HStack>
          <HStack w="full" gap="2">
            <Input
              placeholder="Contact (optional)"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
            />
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!form.name || !form.role}
            >
              <LuPlus /> Add
            </Button>
          </HStack>
        </VStack>
      </Box>
    </VStack>
  );
}
