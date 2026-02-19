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
import type { Filing } from "../../../types";

interface FilingsTabProps {
  filings: Filing[];
  onAddFiling: (filing: Omit<Filing, "id">) => void;
  onRemoveFiling: (filingId: string) => void;
}

export function FilingsTab({
  filings,
  onAddFiling,
  onRemoveFiling,
}: FilingsTabProps) {
  const [form, setForm] = useState({
    title: "",
    date: "",
    type: "",
    notes: "",
  });

  const handleAdd = () => {
    if (!form.title || !form.date) return;
    onAddFiling(form);
    setForm({ title: "", date: "", type: "", notes: "" });
  };

  return (
    <VStack align="stretch" gap="4" mt="4">
      {filings
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((f) => (
          <HStack
            key={f.id}
            borderWidth="1px"
            p="3"
            borderRadius="md"
            justifyContent="space-between"
          >
            <Box>
              <Text fontWeight="medium">{f.title}</Text>
              <Text fontSize="sm" color="fg.muted">
                {f.type} · {f.date}
                {f.notes ? ` · ${f.notes}` : ""}
              </Text>
            </Box>
            <IconButton
              aria-label="Remove filing"
              variant="ghost"
              size="sm"
              onClick={() => onRemoveFiling(f.id)}
            >
              <LuTrash2 />
            </IconButton>
          </HStack>
        ))}
      <Box borderWidth="1px" p="4" borderRadius="md">
        <Text fontSize="sm" fontWeight="medium" mb="2">
          Add Filing
        </Text>
        <VStack gap="2">
          <HStack w="full" gap="2">
            <Input
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </HStack>
          <HStack w="full" gap="2">
            <Input
              placeholder="Type (e.g., Motion, Order)"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            />
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!form.title || !form.date}
            >
              <LuPlus /> Add
            </Button>
          </HStack>
        </VStack>
      </Box>
    </VStack>
  );
}
