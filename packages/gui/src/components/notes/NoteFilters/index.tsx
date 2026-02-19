import { Box, HStack, Input, Text, Badge, Button } from "@chakra-ui/react";

interface NoteFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  availableTags: string[];
  onClearFilters: () => void;
}

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "case-notes", label: "Case Notes" },
  { value: "research", label: "Research" },
  { value: "todo", label: "To-Do" },
  { value: "general", label: "General" },
  { value: "other", label: "Other" },
];

export function NoteFilters({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedTags,
  onToggleTag,
  availableTags,
  onClearFilters,
}: NoteFiltersProps) {
  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    selectedCategory !== "all" ||
    selectedTags.length > 0;

  return (
    <Box borderWidth="1px" borderRadius="md" p="4">
      <HStack mb="3" justifyContent="space-between">
        <Text fontWeight="medium">Filters</Text>
        {hasActiveFilters && (
          <Button size="xs" variant="ghost" onClick={onClearFilters}>
            Clear All
          </Button>
        )}
      </HStack>

      {/* Search */}
      <Box mb="3">
        <Text fontSize="sm" mb="1">
          Search
        </Text>
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search notes..."
          size="sm"
        />
      </Box>

      {/* Category */}
      <Box mb="3">
        <Text fontSize="sm" mb="1">
          Category
        </Text>
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
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
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </Box>

      {/* Tags */}
      {availableTags.length > 0 && (
        <Box>
          <Text fontSize="sm" mb="1">
            Tags
          </Text>
          <HStack gap="2" flexWrap="wrap">
            {availableTags.map((tag) => (
              <Badge
                key={tag}
                colorPalette={selectedTags.includes(tag) ? "blue" : "gray"}
                cursor="pointer"
                onClick={() => onToggleTag(tag)}
                variant={selectedTags.includes(tag) ? "solid" : "outline"}
              >
                {tag}
              </Badge>
            ))}
          </HStack>
        </Box>
      )}
    </Box>
  );
}
