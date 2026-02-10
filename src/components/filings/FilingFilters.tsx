import { Box, Button, Input, Text, VStack } from "@chakra-ui/react";
import { LuX } from "react-icons/lu";

interface FilingFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedType: string;
  onTypeChange: (type: string) => void;
  selectedCaseId: string;
  onCaseChange: (caseId: string) => void;
  dateFrom: string;
  onDateFromChange: (date: string) => void;
  dateTo: string;
  onDateToChange: (date: string) => void;
  filingTypes: string[];
  cases: { id: string; name: string }[];
  onClearFilters: () => void;
}

export function FilingFilters({
  searchQuery,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedCaseId,
  onCaseChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  filingTypes,
  cases,
  onClearFilters,
}: FilingFiltersProps) {
  const hasActiveFilters =
    searchQuery !== "" ||
    selectedType !== "all" ||
    selectedCaseId !== "all" ||
    dateFrom !== "" ||
    dateTo !== "";

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
          placeholder="Search filings..."
          data-testid="filings-search"
        />
      </Box>

      <Box>
        <Text fontSize="xs" mb="1" color="fg.muted">
          Type
        </Text>
        <select
          data-testid="filings-type-filter"
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
          <option value="all">All Types</option>
          {filingTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </Box>

      <Box>
        <Text fontSize="xs" mb="1" color="fg.muted">
          Case
        </Text>
        <select
          data-testid="filings-case-filter"
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

      <Box>
        <Text fontSize="xs" mb="1" color="fg.muted">
          Date From
        </Text>
        <Input
          type="date"
          size="sm"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          data-testid="filings-date-from"
        />
      </Box>

      <Box>
        <Text fontSize="xs" mb="1" color="fg.muted">
          Date To
        </Text>
        <Input
          type="date"
          size="sm"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          data-testid="filings-date-to"
        />
      </Box>

      {hasActiveFilters && (
        <Button size="sm" variant="outline" onClick={onClearFilters}>
          <LuX /> Clear Filters
        </Button>
      )}
    </VStack>
  );
}
