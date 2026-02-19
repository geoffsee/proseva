import { Box, Button, Input, Text, VStack } from "@chakra-ui/react";
import { LuX } from "react-icons/lu";

interface ContactFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedRole: string;
  onRoleChange: (role: string) => void;
  selectedCaseId: string;
  onCaseChange: (caseId: string) => void;
  cases: { id: string; name: string }[];
  onClearFilters: () => void;
}

const ROLE_OPTIONS = [
  { value: "all", label: "All Roles" },
  { value: "Attorney", label: "Attorney" },
  { value: "Judge", label: "Judge" },
  { value: "Clerk", label: "Clerk" },
  { value: "Witness", label: "Witness" },
  { value: "Expert", label: "Expert" },
  { value: "Opposing Party", label: "Opposing Party" },
  { value: "Petitioner", label: "Petitioner" },
  { value: "Respondent", label: "Respondent" },
  { value: "Court", label: "Court" },
  { value: "Other", label: "Other" },
];

export function ContactFilters({
  searchQuery,
  onSearchChange,
  selectedRole,
  onRoleChange,
  selectedCaseId,
  onCaseChange,
  cases,
  onClearFilters,
}: ContactFiltersProps) {
  const hasActiveFilters =
    searchQuery || selectedRole !== "all" || selectedCaseId !== "all";

  return (
    <Box borderWidth="1px" borderRadius="md" p="4">
      <VStack align="stretch" gap="4">
        <Box>
          <Text fontSize="lg" fontWeight="semibold" mb="3">
            Filters
          </Text>
        </Box>

        <Box>
          <Text fontSize="sm" mb="1">
            Search
          </Text>
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            size="sm"
            data-testid="contacts-search"
          />
        </Box>

        <Box>
          <Text fontSize="sm" mb="1">
            Role
          </Text>
          <select
            data-testid="contacts-role-filter"
            value={selectedRole}
            onChange={(e) => onRoleChange(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 8px",
              borderRadius: "6px",
              border: "1px solid var(--chakra-colors-border)",
              background: "transparent",
              color: "inherit",
              fontSize: "14px",
            }}
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Box>

        <Box>
          <Text fontSize="sm" mb="1">
            Case
          </Text>
          <select
            data-testid="contacts-case-filter"
            value={selectedCaseId}
            onChange={(e) => onCaseChange(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 8px",
              borderRadius: "6px",
              border: "1px solid var(--chakra-colors-border)",
              background: "transparent",
              color: "inherit",
              fontSize: "14px",
            }}
          >
            <option value="all">All Cases</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Box>

        {hasActiveFilters && (
          <Button size="sm" variant="ghost" onClick={onClearFilters}>
            <LuX /> Clear Filters
          </Button>
        )}
      </VStack>
    </Box>
  );
}
