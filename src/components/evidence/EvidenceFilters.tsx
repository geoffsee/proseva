import { Box, Button, Input, Text, VStack } from "@chakra-ui/react";
import { LuX } from "react-icons/lu";

interface EvidenceFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedType: string;
  onTypeChange: (type: string) => void;
  selectedRelevance: string;
  onRelevanceChange: (relevance: string) => void;
  selectedAdmissible: string;
  onAdmissibleChange: (admissible: string) => void;
  selectedCaseId: string;
  onCaseChange: (caseId: string) => void;
  cases: { id: string; name: string }[];
  onClearFilters: () => void;
}

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "document", label: "Document" },
  { value: "photo", label: "Photo" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "physical", label: "Physical" },
  { value: "testimony", label: "Testimony" },
  { value: "digital", label: "Digital" },
  { value: "other", label: "Other" },
];

const RELEVANCE_OPTIONS = [
  { value: "all", label: "All Relevance" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const ADMISSIBLE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "admissible", label: "Admissible" },
  { value: "inadmissible", label: "Inadmissible" },
];

export function EvidenceFilters({
  searchQuery,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedRelevance,
  onRelevanceChange,
  selectedAdmissible,
  onAdmissibleChange,
  selectedCaseId,
  onCaseChange,
  cases,
  onClearFilters,
}: EvidenceFiltersProps) {
  const hasActiveFilters =
    searchQuery !== "" ||
    selectedType !== "all" ||
    selectedRelevance !== "all" ||
    selectedAdmissible !== "all" ||
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
          placeholder="Search evidence..."
          data-testid="evidence-search"
        />
      </Box>

      <Box>
        <Text fontSize="xs" mb="1" color="fg.muted">
          Type
        </Text>
        <select
          data-testid="evidence-type-filter"
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
          Relevance
        </Text>
        <select
          data-testid="evidence-relevance-filter"
          value={selectedRelevance}
          onChange={(e) => onRelevanceChange(e.target.value)}
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
          {RELEVANCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </Box>

      <Box>
        <Text fontSize="xs" mb="1" color="fg.muted">
          Admissibility
        </Text>
        <select
          data-testid="evidence-admissibility-filter"
          value={selectedAdmissible}
          onChange={(e) => onAdmissibleChange(e.target.value)}
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
          {ADMISSIBLE_OPTIONS.map((opt) => (
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
          data-testid="evidence-case-filter"
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
