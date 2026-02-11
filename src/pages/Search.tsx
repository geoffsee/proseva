import { useState, useCallback } from "react";
import {
  Box,
  Heading,
  HStack,
  VStack,
  Input,
  Text,
  Badge,
  Card,
  Spinner,
  Icon,
  Checkbox,
  Grid,
  GridItem,
} from "@chakra-ui/react";
import {
  LuSearch,
  LuFolder,
  LuUsers,
  LuClock,
  LuDollarSign,
  LuImage,
  LuUpload,
  LuStickyNote,
  LuFileText,
} from "react-icons/lu";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/shared/EmptyState";
import { searchApi } from "../lib/api";

type EntityType =
  | "cases"
  | "contacts"
  | "deadlines"
  | "finances"
  | "evidences"
  | "filings"
  | "notes"
  | "documents";

interface SearchHighlight {
  field: string;
  snippet: string;
}

interface SearchResultItem {
  id: string;
  type: EntityType;
  score: number;
  matchedFields: string[];
  highlights: SearchHighlight[];
  data: Record<string, unknown>;
}

interface EntityResults {
  total: number;
  hasMore: boolean;
  items: SearchResultItem[];
}

interface SearchResponse {
  query: string;
  totalResults: number;
  results: Record<EntityType, EntityResults>;
  timing: { searchMs: number };
}

const ENTITY_CONFIG: Record<
  EntityType,
  { label: string; icon: React.ElementType; color: string; linkPrefix: string }
> = {
  cases: {
    label: "Cases",
    icon: LuFolder,
    color: "blue",
    linkPrefix: "/cases",
  },
  contacts: {
    label: "Contacts",
    icon: LuUsers,
    color: "green",
    linkPrefix: "/contacts",
  },
  deadlines: {
    label: "Deadlines",
    icon: LuClock,
    color: "orange",
    linkPrefix: "/deadlines",
  },
  finances: {
    label: "Finances",
    icon: LuDollarSign,
    color: "purple",
    linkPrefix: "/finances",
  },
  evidences: {
    label: "Evidence",
    icon: LuImage,
    color: "red",
    linkPrefix: "/evidence",
  },
  filings: {
    label: "Filings",
    icon: LuUpload,
    color: "cyan",
    linkPrefix: "/filings",
  },
  notes: {
    label: "Notes",
    icon: LuStickyNote,
    color: "yellow",
    linkPrefix: "/notes",
  },
  documents: {
    label: "Documents",
    icon: LuFileText,
    color: "teal",
    linkPrefix: "/documents",
  },
};

const ALL_TYPES: EntityType[] = [
  "cases",
  "contacts",
  "deadlines",
  "finances",
  "evidences",
  "filings",
  "notes",
  "documents",
];

function HighlightedText({ html }: { html: string }) {
  return (
    <Text
      as="span"
      fontSize="sm"
      color="fg.muted"
      dangerouslySetInnerHTML={{ __html: html }}
      css={{
        "& mark": {
          backgroundColor: "var(--chakra-colors-yellow-200)",
          color: "var(--chakra-colors-yellow-900)",
          padding: "0 2px",
          borderRadius: "2px",
        },
        ".dark & mark": {
          backgroundColor: "var(--chakra-colors-yellow-700)",
          color: "var(--chakra-colors-yellow-100)",
        },
      }}
    />
  );
}

function getResultTitle(item: SearchResultItem): string {
  const { type, data } = item;
  switch (type) {
    case "cases":
      return (data.name as string) || "Untitled Case";
    case "contacts":
      return (data.name as string) || "Untitled Contact";
    case "deadlines":
      return (data.title as string) || "Untitled Deadline";
    case "finances":
      return (
        (data.description as string) ||
        (data.subcategory as string) ||
        "Financial Entry"
      );
    case "evidences":
      return (data.title as string) || "Untitled Evidence";
    case "filings":
      return (data.title as string) || "Untitled Filing";
    case "notes":
      return (data.title as string) || "Untitled Note";
    case "documents":
      return (
        (data.title as string) ||
        (data.filename as string) ||
        "Untitled Document"
      );
    default:
      return "Unknown";
  }
}

function getResultSubtitle(item: SearchResultItem): string | null {
  const { type, data } = item;
  switch (type) {
    case "cases":
      return data.caseNumber ? `Case #${data.caseNumber}` : null;
    case "contacts":
      return (data.role as string) || (data.organization as string) || null;
    case "deadlines":
      return data.date ? `Due: ${data.date}` : null;
    case "finances":
      return data.amount ? `$${Number(data.amount).toLocaleString()}` : null;
    case "evidences":
      return data.exhibitNumber ? `Exhibit ${data.exhibitNumber}` : null;
    case "filings":
      return data.date ? `Filed: ${data.date}` : null;
    case "notes":
      return (data.category as string) || null;
    case "documents":
      return (data.category as string) || null;
    default:
      return null;
  }
}

function SearchResultCard({ item }: { item: SearchResultItem }) {
  const config = ENTITY_CONFIG[item.type];
  const title = getResultTitle(item);
  const subtitle = getResultSubtitle(item);

  return (
    <Card.Root size="sm" variant="outline">
      <Card.Body>
        <HStack justify="space-between" align="start" gap="4">
          <HStack gap="3" align="start" flex="1">
            <Box
              p="2"
              borderRadius="md"
              bg={`${config.color}.100`}
              _dark={{ bg: `${config.color}.900` }}
            >
              <Icon
                fontSize="lg"
                color={`${config.color}.600`}
                _dark={{ color: `${config.color}.300` }}
              >
                <config.icon />
              </Icon>
            </Box>
            <VStack align="start" gap="1" flex="1">
              <HStack gap="2" flexWrap="wrap">
                <Text fontWeight="medium">{title}</Text>
                <Badge size="sm" colorPalette={config.color}>
                  {config.label}
                </Badge>
              </HStack>
              {subtitle && (
                <Text fontSize="sm" color="fg.muted">
                  {subtitle}
                </Text>
              )}
              {item.highlights.length > 0 && (
                <Box mt="1">
                  {item.highlights.slice(0, 2).map((h, idx) => (
                    <Box key={idx}>
                      <Text as="span" fontSize="xs" color="fg.subtle" mr="1">
                        {h.field}:
                      </Text>
                      <HighlightedText html={h.snippet} />
                    </Box>
                  ))}
                </Box>
              )}
            </VStack>
          </HStack>
          <Badge variant="subtle" size="sm">
            {item.score}%
          </Badge>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
}

function TypeFilter({
  types,
  selectedTypes,
  onToggle,
}: {
  types: EntityType[];
  selectedTypes: Set<EntityType>;
  onToggle: (type: EntityType) => void;
}) {
  return (
    <Card.Root size="sm">
      <Card.Header>
        <Card.Title fontSize="sm">Filter by Type</Card.Title>
      </Card.Header>
      <Card.Body pt="0">
        <VStack align="start" gap="2">
          {types.map((type) => {
            const config = ENTITY_CONFIG[type];
            return (
              <Checkbox.Root
                key={type}
                checked={selectedTypes.has(type)}
                onCheckedChange={() => onToggle(type)}
                size="sm"
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control />
                <Checkbox.Label>
                  <HStack gap="2">
                    <Icon fontSize="sm" color={`${config.color}.500`}>
                      <config.icon />
                    </Icon>
                    <Text fontSize="sm">{config.label}</Text>
                  </HStack>
                </Checkbox.Label>
              </Checkbox.Root>
            );
          })}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
}

export default function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<Set<EntityType>>(
    new Set(ALL_TYPES),
  );
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const typesArray =
        selectedTypes.size === ALL_TYPES.length
          ? undefined
          : Array.from(selectedTypes);
      const response = await searchApi.search(query, {
        types: typesArray,
        limit: 50,
      });

      if (response.error) {
        setError(response.error);
        setResults(null);
      } else {
        setResults(response);
      }
    } catch (err) {
      setError("Failed to perform search. Please try again.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, [query, selectedTypes]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const toggleType = (type: EntityType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const allResults: SearchResultItem[] = results
    ? ALL_TYPES.flatMap((type) => results.results[type]?.items || []).sort(
        (a, b) => b.score - a.score,
      )
    : [];

  return (
    <VStack align="stretch" gap="6">
      <Heading size="2xl">Search</Heading>

      <HStack gap="3">
        <Box position="relative" flex="1">
          <Box
            position="absolute"
            left="3"
            top="50%"
            transform="translateY(-50%)"
            zIndex="1"
          >
            <Icon color="fg.muted">
              <LuSearch />
            </Icon>
          </Box>
          <Input
            placeholder="Search across all data..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            pl="10"
            size="lg"
          />
        </Box>
      </HStack>

      <Grid templateColumns={{ base: "1fr", lg: "220px 1fr" }} gap="6">
        <GridItem>
          <TypeFilter
            types={ALL_TYPES}
            selectedTypes={selectedTypes}
            onToggle={toggleType}
          />
        </GridItem>

        <GridItem>
          {loading && (
            <VStack py="16" gap="4">
              <Spinner size="lg" />
              <Text color="fg.muted">Searching...</Text>
            </VStack>
          )}

          {error && (
            <Card.Root borderColor="red.500">
              <Card.Body>
                <Text color="red.500">{error}</Text>
              </Card.Body>
            </Card.Root>
          )}

          {!loading && !error && !hasSearched && (
            <EmptyState
              icon={LuSearch}
              title="Search your data"
              description="Enter a search term to find cases, contacts, deadlines, evidence, and more."
            />
          )}

          {!loading &&
            !error &&
            hasSearched &&
            results &&
            allResults.length === 0 && (
              <EmptyState
                icon={LuSearch}
                title="No results found"
                description={`No matches found for "${query}". Try different keywords or adjust your filters.`}
              />
            )}

          {!loading && !error && results && allResults.length > 0 && (
            <VStack align="stretch" gap="4">
              <HStack justify="space-between">
                <Text color="fg.muted" fontSize="sm">
                  Found {results.totalResults} result
                  {results.totalResults !== 1 ? "s" : ""} in{" "}
                  {results.timing.searchMs}ms
                </Text>
              </HStack>

              <VStack align="stretch" gap="3">
                {allResults.map((item) => (
                  <Link
                    key={`${item.type}-${item.id}`}
                    to={`${ENTITY_CONFIG[item.type].linkPrefix}/${item.id}`}
                    style={{ textDecoration: "none" }}
                  >
                    <Box
                      _hover={{ transform: "translateY(-1px)", shadow: "md" }}
                      transition="all 0.2s"
                    >
                      <SearchResultCard item={item} />
                    </Box>
                  </Link>
                ))}
              </VStack>
            </VStack>
          )}
        </GridItem>
      </Grid>
    </VStack>
  );
}
