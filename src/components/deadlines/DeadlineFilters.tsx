import { Box, Button, Input, Text, VStack } from "@chakra-ui/react";
import { LuX } from "react-icons/lu";

interface DeadlineFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedType: string;
  onTypeChange: (type: string) => void;
  selectedUrgency: string;
  onUrgencyChange: (urgency: string) => void;
  selectedCaseId: string;
  onCaseChange: (caseId: string) => void;
  cases: { id: string; name: string }[];
  onClearFilters: () => void;
}

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "filing", label: "Filing" },
  { value: "hearing", label: "Hearing" },
  { value: "discovery", label: "Discovery" },
  { value: "other", label: "Other" },
];

const URGENCY_OPTIONS = [
  { value: "all", label: "All Urgencies" },
  { value: "overdue", label: "Overdue" },
  { value: "urgent", label: "Urgent (≤3 days)" },
  { value: "upcoming", label: "Upcoming (≤14 days)" },
  { value: "future", label: "Future" },
];

export function DeadlineFilters({
  searchQuery,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedUrgency,
  onUrgencyChange,
  selectedCaseId,
  onCaseChange,
  cases,
  onClearFilters,
}: DeadlineFiltersProps) {
  const hasActiveFilters =
    searchQuery !== "" ||
    selectedType !== "all" ||
    selectedUrgency !== "all" ||
    selectedCaseId !== "all";

  return (
    <VStack
      align="stretch"
      gap="4"
      p="4"
      borderWidth="1px"
      borderRadius="md"
      bg="bg.panel"
    >
      <Text fontWeight="semibold" fontSize="sm">
        Filters
      </Text>

      <Box>
        <Text fontSize="xs" mb="1" color="fg.muted">
          Search
        </Text>
        <Input
          size="sm"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search deadlines..."
          data-testid="deadlines-search"
        />
      </Box>

      <Box>
        <Text fontSize="xs" mb="1" color="fg.muted">
          Type
        </Text>
        <select
          data-testid="deadlines-type-filter"
          value={selectedType}
          onChange={(e) => onTypeChange(e.target.value)}
          style={{
            width: "100%",
            padding: "6px 8px",
            fontSize: "14px",
            borderRadius: "6px",
            border: "1px solid var(--chakra-colors-border)",
            background: "transparent",
            color: "inherit",
          }}
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </Box>

      <Box>
        <Text fontSize="xs" mb="1" color="fg.muted">
          Urgency
        </Text>
        <select
          data-testid="deadlines-urgency-filter"
          value={selectedUrgency}
          onChange={(e) => onUrgencyChange(e.target.value)}
          style={{
            width: "100%",
            padding: "6px 8px",
            fontSize: "14px",
            borderRadius: "6px",
            border: "1px solid var(--chakra-colors-border)",
            background: "transparent",
            color: "inherit",
          }}
        >
          {URGENCY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </Box>

      <Box>
        <Text fontSize="xs" mb="1" color="fg.muted">
          Case
        </Text>
        <select
          data-testid="deadlines-case-filter"
          value={selectedCaseId}
          onChange={(e) => onCaseChange(e.target.value)}
          style={{
            width: "100%",
            padding: "6px 8px",
            fontSize: "14px",
            borderRadius: "6px",
            border: "1px solid var(--chakra-colors-border)",
            background: "transparent",
            color: "inherit",
          }}
        >
          <option value="all">All Cases</option>
          <option value="">No Case</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Box>

      {hasActiveFilters && (
        <Button size="sm" variant="outline" onClick={onClearFilters}>
          <LuX /> Clear Filters
        </Button>
      )}
    </VStack>
  );
}
