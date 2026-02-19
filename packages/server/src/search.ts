import { join } from "path";
import { readFile } from "fs/promises";
import { db } from "./db";
import type { DocumentEntry } from "./ingest";

// --- Type Definitions ---

export type EntityType =
  | "cases"
  | "contacts"
  | "deadlines"
  | "finances"
  | "evidences"
  | "filings"
  | "notes"
  | "documents";

export interface SearchParams {
  query: string;
  types?: EntityType[];
  limit?: number;
  offset?: number;
  caseId?: string;
}

export interface SearchHighlight {
  field: string;
  snippet: string;
}

export interface SearchResultItem {
  id: string;
  type: EntityType;
  score: number;
  matchedFields: string[];
  highlights: SearchHighlight[];
  data: Record<string, unknown>;
}

export interface EntityResults {
  total: number;
  hasMore: boolean;
  items: SearchResultItem[];
}

export interface SearchResponse {
  query: string;
  totalResults: number;
  results: Record<EntityType, EntityResults>;
  timing: { searchMs: number };
}

// --- Field Configuration ---

interface FieldConfig {
  path: string;
  weight: number;
}

const FIELD_CONFIGS: Record<EntityType, FieldConfig[]> = {
  cases: [
    { path: "name", weight: 1.0 },
    { path: "caseNumber", weight: 0.9 },
    { path: "court", weight: 0.6 },
    { path: "notes", weight: 0.4 },
    { path: "parties[].name", weight: 0.5 },
  ],
  contacts: [
    { path: "name", weight: 1.0 },
    { path: "role", weight: 0.7 },
    { path: "organization", weight: 0.6 },
    { path: "email", weight: 0.5 },
    { path: "notes", weight: 0.4 },
  ],
  deadlines: [
    { path: "title", weight: 1.0 },
    { path: "type", weight: 0.6 },
  ],
  finances: [
    { path: "description", weight: 1.0 },
    { path: "subcategory", weight: 0.7 },
  ],
  evidences: [
    { path: "title", weight: 1.0 },
    { path: "description", weight: 0.7 },
    { path: "exhibitNumber", weight: 0.8 },
    { path: "tags", weight: 0.6 },
    { path: "notes", weight: 0.4 },
  ],
  filings: [
    { path: "title", weight: 1.0 },
    { path: "notes", weight: 0.5 },
    { path: "type", weight: 0.6 },
  ],
  notes: [
    { path: "title", weight: 1.0 },
    { path: "content", weight: 0.8 },
    { path: "tags", weight: 0.6 },
  ],
  documents: [
    { path: "title", weight: 1.0 },
    { path: "filename", weight: 0.7 },
    { path: "category", weight: 0.5 },
  ],
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

// --- Helper Functions ---

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getFieldValue(obj: Record<string, unknown>, path: string): string[] {
  // Handle array paths like "parties[].name"
  if (path.includes("[]")) {
    const [arrayField, subPath] = path.split("[].");
    const arr = obj[arrayField];
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item) => {
        const val = (item as Record<string, unknown>)?.[subPath];
        return typeof val === "string" ? val : "";
      })
      .filter(Boolean);
  }

  // Handle array fields like "tags"
  const val = obj[path];
  if (Array.isArray(val)) {
    return val.filter((v): v is string => typeof v === "string");
  }

  if (typeof val === "string") {
    return [val];
  }

  return [];
}

export function calculateScore(
  fieldValue: string,
  query: string,
  weight: number,
): number {
  const lowerValue = fieldValue.toLowerCase();
  const lowerQuery = query.toLowerCase();

  if (!lowerValue.includes(lowerQuery)) {
    return 0;
  }

  let score = 0;

  // Field weight contribution (40 pts max)
  score += weight * 40;

  // Match position contribution (30 pts max) - earlier is better
  const position = lowerValue.indexOf(lowerQuery);
  const positionScore = Math.max(0, 30 - (position / lowerValue.length) * 30);
  score += positionScore;

  // Match frequency contribution (20 pts max)
  const escapedQuery = escapeRegex(lowerQuery);
  const matches = lowerValue.match(new RegExp(escapedQuery, "gi"));
  const frequency = matches ? matches.length : 0;
  const frequencyScore = Math.min(20, frequency * 5);
  score += frequencyScore;

  // Exact match bonus (10 pts)
  if (lowerValue === lowerQuery) {
    score += 10;
  }

  return Math.min(100, Math.round(score));
}

export function generateHighlight(
  fieldValue: string,
  query: string,
  contextChars: number = 50,
): string {
  const lowerValue = fieldValue.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerValue.indexOf(lowerQuery);

  if (matchIndex === -1) {
    return fieldValue;
  }

  const escapedQuery = escapeRegex(query);
  const regex = new RegExp(`(${escapedQuery})`, "gi");

  // Get a snippet around the first match
  const start = Math.max(0, matchIndex - contextChars);
  const end = Math.min(
    fieldValue.length,
    matchIndex + query.length + contextChars,
  );

  let snippet = fieldValue.slice(start, end);

  // Add ellipsis if truncated
  if (start > 0) snippet = "..." + snippet;
  if (end < fieldValue.length) snippet = snippet + "...";

  // Wrap matches in <mark> tags
  return snippet.replace(regex, "<mark>$1</mark>");
}

// --- Generic Search Function ---

function searchEntity<T extends { id: string; caseId?: string }>(
  entities: T[],
  entityType: EntityType,
  query: string,
  caseId?: string,
): SearchResultItem[] {
  const fieldConfigs = FIELD_CONFIGS[entityType];
  const results: SearchResultItem[] = [];

  for (const entity of entities) {
    // Filter by caseId if specified
    if (caseId && "caseId" in entity && entity.caseId !== caseId) {
      continue;
    }

    let maxScore = 0;
    const matchedFields: string[] = [];
    const highlights: SearchHighlight[] = [];

    for (const config of fieldConfigs) {
      const values = getFieldValue(
        entity as unknown as Record<string, unknown>,
        config.path,
      );

      for (const value of values) {
        const score = calculateScore(value, query, config.weight);
        if (score > 0) {
          maxScore = Math.max(maxScore, score);
          const fieldName = config.path.replace("[].", ".");
          if (!matchedFields.includes(fieldName)) {
            matchedFields.push(fieldName);
            highlights.push({
              field: fieldName,
              snippet: generateHighlight(value, query),
            });
          }
        }
      }
    }

    if (maxScore > 0) {
      results.push({
        id: entity.id,
        type: entityType,
        score: maxScore,
        matchedFields,
        highlights,
        data: entity as unknown as Record<string, unknown>,
      });
    }
  }

  // Sort by score descending
  return results.sort((a, b) => b.score - a.score);
}

// --- Document Loading ---

async function loadDocuments(): Promise<DocumentEntry[]> {
  const __dir =
    import.meta.dir ??
    import.meta.dirname ??
    new URL(".", import.meta.url).pathname;
  const appRoot = process.env.PROSEVA_DATA_DIR ?? join(__dir, "../..");
  const indexPath = join(appRoot, "case-data/case-documents-app/index.json");

  try {
    const raw = await readFile(indexPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// --- Main Search Function ---

export async function executeSearch(
  params: SearchParams,
): Promise<SearchResponse> {
  const startTime = performance.now();

  const { query, limit = 20, offset = 0, caseId } = params;

  // Clamp limit and offset
  const clampedLimit = Math.max(1, Math.min(100, limit));
  const clampedOffset = Math.max(0, offset);

  // Determine which types to search
  let types = params.types ?? ALL_TYPES;
  // Filter out invalid types
  types = types.filter((t) => ALL_TYPES.includes(t));
  if (types.length === 0) {
    types = ALL_TYPES;
  }

  const results: Record<EntityType, EntityResults> = {
    cases: { total: 0, hasMore: false, items: [] },
    contacts: { total: 0, hasMore: false, items: [] },
    deadlines: { total: 0, hasMore: false, items: [] },
    finances: { total: 0, hasMore: false, items: [] },
    evidences: { total: 0, hasMore: false, items: [] },
    filings: { total: 0, hasMore: false, items: [] },
    notes: { total: 0, hasMore: false, items: [] },
    documents: { total: 0, hasMore: false, items: [] },
  };

  let totalResults = 0;

  // Search each entity type
  for (const entityType of types) {
    let allResults: SearchResultItem[];

    if (entityType === "documents") {
      const documents = await loadDocuments();
      // Filter documents by caseId if specified
      const filtered = caseId
        ? documents.filter((d) => d.caseId === caseId)
        : documents;
      allResults = searchEntity(filtered, entityType, query);
    } else {
      const entityMap = db[entityType] as Map<
        string,
        { id: string; caseId?: string }
      >;
      const entities = [...entityMap.values()];
      allResults = searchEntity(entities, entityType, query, caseId);
    }

    const total = allResults.length;
    const paginatedResults = allResults.slice(
      clampedOffset,
      clampedOffset + clampedLimit,
    );
    const hasMore = clampedOffset + clampedLimit < total;

    results[entityType] = {
      total,
      hasMore,
      items: paginatedResults,
    };

    totalResults += total;
  }

  const endTime = performance.now();

  return {
    query,
    totalResults,
    results,
    timing: { searchMs: Math.round(endTime - startTime) },
  };
}
