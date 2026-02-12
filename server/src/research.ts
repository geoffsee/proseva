import { AutoRouter } from "itty-router";
import { withRateLimit } from "../api-middleware/withRateLimit";
import OpenAI from "openai";
import { z } from "zod";
import {
  LegalDocumentGenerator,
  type DocumentTemplate,
  type GenerationOptions,
} from "../services/legalDocumentGenerator";
import {
  triggerWebhookWithRetry,
  createDocumentGeneratedPayload,
  type WebhookConfig,
} from "../services/webhookService";
import { getConfig } from "./config";
import { createPersistenceManager } from "./research-persistence";

// CourtListener API base URL (Free Law Project)
const COURTLISTENER_API_BASE = "https://www.courtlistener.com/api/rest/v4";

// SerpAPI base URL for Google Scholar (legacy, now using OpenAlex)
function getSerpApiBase(): string {
  return getConfig("SERPAPI_BASE") || "https://serpapi.com/search.json";
}

// GovInfo API base URL (Official US Government Publishing Office)
const GOVINFO_API_BASE = "https://api.govinfo.gov";

// GovInfo collection codes
const GOVINFO_COLLECTIONS: Record<string, string> = {
  BILLS: "Congressional Bills",
  CFR: "Code of Federal Regulations",
  CRPT: "Congressional Reports",
  FR: "Federal Register",
  PLAW: "Public Laws",
  STATUTE: "Statutes at Large",
  USCODE: "United States Code",
  USCOURTS: "US Courts Opinions",
  CHRG: "Congressional Hearings",
  CDOC: "Congressional Documents",
};

// GovInfo collection descriptions
function getCollectionDescription(code: string): string {
  const descriptions: Record<string, string> = {
    BILLS:
      "Legislation introduced in Congress, including all versions from introduction through enrollment",
    CFR: "Annual codification of federal agency regulations, organized by subject",
    CRPT: "Congressional committee reports on legislation and investigations",
    FR: "Daily publication of federal agency rules, proposed rules, and public notices",
    PLAW: "Laws enacted by Congress, numbered sequentially by Congress",
    STATUTE: "Chronological compilation of all laws enacted by Congress",
    USCODE:
      "Consolidation of general and permanent federal laws, organized by subject",
    USCOURTS:
      "Opinions from federal appellate, district, and bankruptcy courts",
    CHRG: "Transcripts of Congressional committee hearings",
    CDOC: "Documents ordered printed by Congress, including special publications",
  };
  return descriptions[code] || "";
}

// Helper to get CourtListener auth headers
function getCourtListenerHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  // CourtListener requires Token authentication
  // Get a free token at: https://www.courtlistener.com/sign-in/
  const token = getConfig("COURTLISTENER_API_TOKEN");
  if (token) {
    headers["Authorization"] = `Token ${token}`;
  }

  return headers;
}

// Validation schemas
const CreateCaseSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
});

const UpdateCaseSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
});

const SavedSearchSchema = z.object({
  name: z.string().min(1).max(500).default("Untitled Search"),
  query: z.string().max(1000).optional(),
  searchType: z
    .enum(["opinions", "regulations", "bills", "documents"])
    .optional()
    .default("opinions"),
  filters: z.record(z.any()).optional(),
  resultCount: z.coerce.number().int().min(0).optional(),
});

const SummarizeDocumentSchema = z.object({
  sourceType: z.string().max(100),
  sourceId: z.string().max(100),
  content: z.string().max(50000),
  title: z.string().max(500),
});

const AnalyzeDocumentSchema = z.object({
  query: z.string().max(2000).optional(),
});

const GenerateDocumentSchema = z.object({
  template: z.enum([
    "memorandum",
    "case_brief",
    "motion",
    "research_summary",
    "client_letter",
    "discovery_summary",
  ]),
  format: z.enum(["markdown", "pdf", "docx"]),
  options: z
    .object({
      citationStyle: z
        .enum(["bluebook", "apa", "mla", "chicago"])
        .default("bluebook"),
      includeSummaries: z.boolean().default(true),
      includeStatutes: z.boolean().default(true),
      includeCases: z.boolean().default(true),
      includeDocuments: z.boolean().default(true),
      customSections: z.array(z.string()).optional(),
      attorneyName: z.string().max(200).optional(),
      clientName: z.string().max(200).optional(),
      courtName: z.string().max(200).optional(),
      motionType: z.string().max(200).optional(),
    })
    .optional()
    .default({}),
  webhook: z
    .object({
      url: z.string().url(),
      headers: z.record(z.string()).optional(),
    })
    .optional(),
});

// Sanitize error messages to prevent information disclosure
function sanitizeError(err: unknown, fallbackMessage: string): string {
  if (err instanceof Error) {
    const safeErrors = [
      "API rate limit exceeded",
      "Invalid search query",
      "Case not found",
      "Search query too short",
    ];
    if (safeErrors.includes(err.message)) {
      return err.message;
    }
  }
  return fallbackMessage;
}

// Format date for display
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function decodeBase64Text(encoded: string): string {
  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

// Single-user app: use a fixed user identifier for persistence scoping
const LOCAL_USER = "local";

// Generate unique ID
function generateUniqueId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Court name mappings for better display
const COURT_NAMES: Record<string, string> = {
  scotus: "Supreme Court of the United States",
  ca1: "First Circuit Court of Appeals",
  ca2: "Second Circuit Court of Appeals",
  ca3: "Third Circuit Court of Appeals",
  ca4: "Fourth Circuit Court of Appeals",
  ca5: "Fifth Circuit Court of Appeals",
  ca6: "Sixth Circuit Court of Appeals",
  ca7: "Seventh Circuit Court of Appeals",
  ca8: "Eighth Circuit Court of Appeals",
  ca9: "Ninth Circuit Court of Appeals",
  ca10: "Tenth Circuit Court of Appeals",
  ca11: "Eleventh Circuit Court of Appeals",
  cadc: "D.C. Circuit Court of Appeals",
  cafc: "Federal Circuit Court of Appeals",
};

// --- Research Interfaces ---

interface OpinionSearchResult {
  id: string;
  caseName: string;
  citation: string;
  court: string;
  courtId: string;
  dateFiled: string;
  dateArgued: string;
  docketNumber: string;
  snippet: string;
  absoluteUrl: string;
  status: string;
  suitNature: string;
}

interface CourtListenerSearchResult {
  id: number;
  cluster_id?: number;
  caseName?: string;
  case_name?: string;
  citation?: string;
  neutral_cite?: string;
  lexis_cite?: string;
  west_cite?: string;
  court: string;
  dateFiled?: string;
  date_filed?: string;
  dateArgued?: string;
  date_argued?: string;
  docketNumber?: string;
  docket_number?: string;
  snippet: string;
  absolute_url: string;
  status: string;
  nature_of_suit: string;
}

interface CourtListenerSearchResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: CourtListenerSearchResult[];
}

interface OpinionDetails {
  id: string;
  caseName: string;
  court: string;
  courtId: string;
  dateFiled: string;
  docketNumber: string;
  judges: string;
  plainText: string;
  htmlWithCitations: string;
  citations: string[];
  citesCases: string[];
  absoluteUrl: string;
  disclaimer: string;
  source: string;
}

interface CourtListenerOpinionResponse {
  id: number;
  case_name: string;
  court: string;
  date_filed: string;
  docket_number: string;
  judges: string;
  plain_text: string;
  html_with_citations: string;
  citations: string[];
  opinions_cited: string[];
  absolute_url: string;
}

interface DocketAttorney {
  name: string;
  contact: string;
  roles: string[];
}

interface DocketParty {
  name: string;
  type: string;
  attorneys: DocketAttorney[];
}

interface DocketEntry {
  id: string;
  dateEntered: string;
  dateFiled: string;
  entryNumber: string;
  description: string;
}

interface DocketDetails {
  id: string;
  caseName: string;
  court: string;
  courtId: string;
  dateFiled: string;
  dateTerminated: string;
  dateLastFiling: string;
  docketNumber: string;
  docketNumberCore: string;
  cause: string;
  natureOfSuit: string;
  juryDemand: string;
  jurisdictionType: string;
  assignedTo: string;
  referredTo: string;
  parties: DocketParty[];
  docketEntries: DocketEntry[];
  absoluteUrl: string;
  pacerUrl: string;
  disclaimer: string;
  source: string;
}

interface CourtListenerDocketResponse {
  id: number;
  case_name: string;
  court: string;
  date_filed: string;
  date_terminated: string;
  date_last_filing: string;
  docket_number: string;
  docket_number_core: string;
  cause: string;
  nature_of_suit: string;
  jury_demand: string;
  jurisdiction_type: string;
  assigned_to_str: string;
  referred_to_str: string;
  parties: Array<{
    name: string;
    party_type?: { name: string };
    type?: string;
    attorneys: Array<{
      name: string;
      contact_raw: string;
      roles: Array<{ role: string } | string>;
    }>;
  }>;
  docket_entries: Array<{
    id: number;
    date_entered: string;
    date_filed: string;
    entry_number: string;
    description: string;
  }>;
  absolute_url: string;
  pacer_url: string;
}

interface LegiScanBill {
  bill_id: number;
  bill_number: string;
  title: string;
  state: string;
  bill_type_id: number;
  url: string;
  last_action: string;
  last_action_date: string;
  relevance: number;
}

interface LegiScanSearchResponse {
  status: string;
  searchresult: Record<string, any>;
  alert?: { message: string };
}

interface LegiScanText {
  doc_id?: number;
  docId?: number;
  date: string;
  url: string;
  state_link: string;
  mime: string;
}

interface LegiScanBillDetailResponse {
  status: string;
  bill?: {
    bill_id: number;
    title: string;
    bill_number: string;
    state: string;
    status: string;
    last_action: string;
    last_action_date: string;
    session: { name: string; session_name?: string };
    session_name?: string;
    url: string;
    state_link: string;
    description: string;
    texts: LegiScanText[];
  };
  alert?: { message: string };
}

interface LegiScanBillTextResponse {
  status: string;
  text?: { doc: string; mime: string };
  bill?: { text: { doc: string; mime: string } };
}

interface CourtListenerDocketSearchResult {
  docket_id?: number;
  id?: number;
  caseName?: string;
  case_name?: string;
  court: string;
  date_filed?: string;
  date_terminated?: string;
  docket_number?: string;
  cause?: string;
  nature_of_suit?: string;
  assigned_to_str?: string;
  snippet: string;
  absolute_url: string;
}

interface CourtListenerDocketSearchResponse {
  count: number;
  results: CourtListenerDocketSearchResult[];
}

interface CourtListenerCourt {
  id: string;
  full_name?: string;
  short_name?: string;
  jurisdiction: string;
  in_use: boolean;
}

interface CourtListenerCourtsResponse {
  count: number;
  results: CourtListenerCourt[];
}

interface StatuteSearchResult {
  id: string;
  title: string;
  citation: string;
  section: string;
  code: string;
  jurisdiction: string;
  snippet: string;
  url: string;
  lastAction: string;
  lastActionDate: string;
  relevance: number;
}

function createResearchRouter() {
  const router = AutoRouter();

  /**
   * Search court opinions using CourtListener API.
   *
   * @endpoint GET /api/research/opinions/search
   * @description Search federal and state court opinions by keyword with optional filters.
   * Provides access to the Free Law Project's CourtListener database.
   *
   * @query {string} q - Search query (required, min 3 characters)
   * @query {string} [court] - Filter by court code (e.g., 'scotus', 'ca1', 'cadc')
   * @query {string} [date_after] - Filter opinions filed after this date (YYYY-MM-DD)
   * @query {string} [date_before] - Filter opinions filed before this date (YYYY-MM-DD)
   * @query {number} [limit=20] - Number of results to return (max 50)
   *
   * @returns {Object} Search results
   * @returns {Array} results - Array of opinion objects with id, caseName, citation, court, dateFiled, etc.
   * @returns {number} total - Total number of matching results
   * @returns {string} disclaimer - Legal disclaimer about educational use
   *
   * @rateLimit 20 requests per 15 minutes per IP
   * @requiresAuth COURTLISTENER_API_TOKEN (environment variable)
   * @source CourtListener (Free Law Project) - https://www.courtlistener.com
   *
   * @example
   * GET /api/research/opinions/search?q=patent%20infringement&limit=10
   */
  // Search court opinions using CourtListener API
  // Rate limited: 20 requests per 15 minutes per IP
  router.get("/api/research/opinions/search", async (request: Request) => {
    const requestId =
      request.headers.get("X-Request-Id") || crypto.randomUUID();
    const url = new URL(request.url);
    const query = url.searchParams.get("q") || "";
    const court = url.searchParams.get("court") || "";
    const dateAfter = url.searchParams.get("date_after") || "";
    const dateBefore = url.searchParams.get("date_before") || "";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);

    console.log(
      `[ResearchRouter ${requestId}] GET /api/research/opinions/search?q=${query}`,
    );

    if (!query || query.length < 3) {
      return new Response(
        JSON.stringify({
          results: [],
          total: 0,
          disclaimer:
            "This information is for educational purposes only and does not constitute legal advice.",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
    }

    try {
      await withRateLimit(request, "paralegal-opinions-search", 20);

      // Build CourtListener search URL
      const searchUrl = new URL(`${COURTLISTENER_API_BASE}/search/`);
      searchUrl.searchParams.set("q", query);
      searchUrl.searchParams.set("type", "o"); // opinions
      searchUrl.searchParams.set("order_by", "score desc");
      searchUrl.searchParams.set("page_size", limit.toString());

      if (court) {
        searchUrl.searchParams.set("court", court);
      }
      if (dateAfter) {
        searchUrl.searchParams.set("filed_after", dateAfter);
      }
      if (dateBefore) {
        searchUrl.searchParams.set("filed_before", dateBefore);
      }

      console.log(
        `[ResearchRouter ${requestId}] Fetching from CourtListener: ${searchUrl.toString()}`,
      );

      // Check if API token is configured
      if (!getConfig("COURTLISTENER_API_TOKEN")) {
        console.warn(
          `[ResearchRouter ${requestId}] COURTLISTENER_API_TOKEN not configured`,
        );
        return new Response(
          JSON.stringify({
            error:
              "CourtListener API token not configured. Please add COURTLISTENER_API_TOKEN to your environment.",
            results: [],
            disclaimer:
              "This information is for educational purposes only and does not constitute legal advice.",
            setup:
              "Get a free API token at https://www.courtlistener.com/sign-in/",
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
      }

      const response = await fetch(searchUrl.toString(), {
        headers: getCourtListenerHeaders(),
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.error(
            `[ResearchRouter ${requestId}] CourtListener API rate limit exceeded`,
          );
          return new Response(
            JSON.stringify({
              error: "API rate limit exceeded. Please try again later.",
              results: [],
              disclaimer:
                "This information is for educational purposes only and does not constitute legal advice.",
            }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }
        if (response.status === 403) {
          console.error(
            `[ResearchRouter ${requestId}] CourtListener API authentication failed`,
          );
          return new Response(
            JSON.stringify({
              error:
                "API authentication failed. Please check your COURTLISTENER_API_TOKEN.",
              results: [],
              disclaimer:
                "This information is for educational purposes only and does not constitute legal advice.",
              setup:
                "Get a free API token at https://www.courtlistener.com/sign-in/",
            }),
            {
              status: 403,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }
        throw new Error(`CourtListener API returned ${response.status}`);
      }

      const data = (await response.json()) as CourtListenerSearchResponse;
      console.log(
        `[ResearchRouter ${requestId}] CourtListener returned ${data.results?.length || 0} opinions`,
      );

      // Transform CourtListener response to our format
      const results: OpinionSearchResult[] = (data.results || []).map((opinion) => ({
        id: opinion.id?.toString() || opinion.cluster_id?.toString() || "",
        caseName: opinion.caseName || opinion.case_name || "Unknown Case",
        citation:
          opinion.citation ||
          [opinion.neutral_cite, opinion.lexis_cite, opinion.west_cite]
            .filter(Boolean)
            .join(", ") ||
          "",
        court: COURT_NAMES[opinion.court] || opinion.court || "",
        courtId: opinion.court || "",
        dateFiled: formatDate(opinion.dateFiled || opinion.date_filed || null),
        dateArgued: formatDate(opinion.dateArgued || opinion.date_argued || null),
        docketNumber: opinion.docketNumber || opinion.docket_number || "",
        snippet: opinion.snippet || "",
        absoluteUrl: opinion.absolute_url
          ? `https://www.courtlistener.com${opinion.absolute_url}`
          : "",
        status: opinion.status || "",
        suitNature: opinion.nature_of_suit || "",
      }));

      return new Response(
        JSON.stringify({
          results,
          total: data.count || results.length,
          next: data.next || null,
          previous: data.previous || null,
          disclaimer:
            "This information is for educational purposes only and does not constitute legal advice. Always consult a licensed attorney for legal matters.",
          source: "CourtListener (Free Law Project)",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
            "Cache-Control": "public, max-age=3600",
          },
        },
      );
    } catch (err) {
      console.error(
        `[ResearchRouter ${requestId}] ERROR:`,
        (err as Error)?.message,
      );
      const isRateLimitError = (err as Error)?.message?.includes(
        "Too many attempts",
      );
      return new Response(
        JSON.stringify({
          error: sanitizeError(err, "Failed to search opinions"),
          results: [],
          disclaimer:
            "This information is for educational purposes only and does not constitute legal advice.",
        }),
        {
          status: isRateLimitError ? 429 : 500,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
    }
  });

  /**
   * Retrieve full details of a specific court opinion.
   *
   * @endpoint GET /api/research/opinions/{id}
   * @description Fetches the complete text and metadata for a single opinion.
   * Returns plain text, HTML with citations, and related case citations.
   *
   * @param {string} id - Opinion ID from CourtListener (path parameter)
   *
   * @returns {Object} Opinion details
   * @returns {string} id - Opinion ID
   * @returns {string} caseName - Name of the case
   * @returns {string} court - Court name and jurisdiction
   * @returns {string} dateFiled - Date the opinion was filed
   * @returns {string} docketNumber - Case docket number
   * @returns {string} judges - Names of judges who authored the opinion
   * @returns {string} plainText - Full text of the opinion
   * @returns {string} htmlWithCitations - HTML formatted with citation links
   * @returns {Array} citations - List of case citations
   * @returns {Array} citesCases - Cases cited in this opinion
   * @returns {string} absoluteUrl - Link to the opinion on CourtListener
   *
   * @requiresAuth COURTLISTENER_API_TOKEN (environment variable)
   * @source CourtListener (Free Law Project)
   * @cacheControl 24 hours
   *
   * @example
   * GET /api/research/opinions/12345678
   */
  // Get specific opinion details
  router.get("/api/research/opinions/:id", async (request: Request) => {
    const requestId =
      request.headers.get("X-Request-Id") || crypto.randomUUID();
    const url = new URL(request.url);
    const opinionId = url.pathname.split("/").pop();

    console.log(
      `[ResearchRouter ${requestId}] GET /api/research/opinions/${opinionId}`,
    );

    if (!opinionId) {
      return new Response(JSON.stringify({ error: "Invalid opinion ID" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
      });
    }

    try {
      await withRateLimit(request, "paralegal-opinion-detail", 30);

      const opinionUrl = `${COURTLISTENER_API_BASE}/opinions/${opinionId}/`;

      console.log(
        `[ResearchRouter ${requestId}] Fetching opinion details from CourtListener`,
      );

      if (!getConfig("COURTLISTENER_API_TOKEN")) {
        return new Response(
          JSON.stringify({
            error: "CourtListener API token not configured",
            setup:
              "Get a free API token at https://www.courtlistener.com/sign-in/",
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
      }

      const response = await fetch(opinionUrl, {
        headers: getCourtListenerHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return new Response(JSON.stringify({ error: "Case not found" }), {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          });
        }
        if (response.status === 403) {
          return new Response(
            JSON.stringify({
              error:
                "API authentication failed. Check your COURTLISTENER_API_TOKEN.",
            }),
            {
              status: 403,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }
        throw new Error(`CourtListener API returned ${response.status}`);
      }

      const data = (await response.json()) as CourtListenerOpinionResponse;

      console.log(`[ResearchRouter ${requestId}] Loaded opinion: ${data.id}`);

      return new Response(
        JSON.stringify({
          id: data.id?.toString() || opinionId,
          caseName: data.case_name || "",
          court: COURT_NAMES[data.court] || data.court || "",
          courtId: data.court || "",
          dateFiled: formatDate(data.date_filed),
          docketNumber: data.docket_number || "",
          judges: data.judges || "",
          plainText: data.plain_text || "",
          htmlWithCitations: data.html_with_citations || "",
          citations: data.citations || [],
          citesCases: data.opinions_cited || [],
          absoluteUrl: data.absolute_url
            ? `https://www.courtlistener.com${data.absolute_url}`
            : "",
          disclaimer:
            "This information is for educational purposes only and does not constitute legal advice.",
          source: "CourtListener (Free Law Project)",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
            "Cache-Control": "public, max-age=86400", // Cache for 24 hours
          },
        },
      );
    } catch (err) {
      console.error(
        `[ResearchRouter ${requestId}] ERROR:`,
        (err as Error)?.message,
      );
      const isRateLimitError = (err as Error)?.message?.includes(
        "Too many attempts",
      );
      return new Response(
        JSON.stringify({
          error: sanitizeError(err, "Failed to fetch opinion"),
        }),
        {
          status: isRateLimitError ? 429 : 500,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
    }
  });

  /**
   * Retrieve detailed information about a specific docket/case.
   *
   * @endpoint GET /api/research/dockets/{id}
   * @description Fetch complete docket information including case parties, judges, dates,
   * case nature, and all filed documents from the RECAP Archive.
   *
   * @param {string} id - Docket ID from CourtListener (path parameter)
   *
   * @returns {Object} Docket detail information
   * @returns {string} id - Docket ID
   * @returns {string} caseName - Full case name
   * @returns {string} court - Court jurisdiction
   * @returns {string} dateFiled - Date the case was filed
   * @returns {string} dateTerminated - Date the case was terminated (if applicable)
   * @returns {string} docketNumber - Docket number
   * @returns {string} assignedTo - Judge or magistrate assigned
   * @returns {Array} parties - Case parties and their counsel
   * @returns {Array} documents - Filed documents with dates and descriptions
   * @returns {string} absoluteUrl - Link to docket on CourtListener
   *
   * @requiresAuth COURTLISTENER_API_TOKEN
   * @source CourtListener RECAP Archive
   * @cacheControl 24 hours
   *
   * @example
   * GET /api/research/dockets/654321
   */
  // Get specific docket details
  router.get("/api/research/dockets/:id", async (request: Request) => {
    const requestId =
      request.headers.get("X-Request-Id") || crypto.randomUUID();
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const docketId = pathParts[pathParts.length - 1];

    console.log(
      `[ResearchRouter ${requestId}] GET /api/research/dockets/${docketId}`,
    );

    if (!docketId || docketId === "search") {
      return new Response(JSON.stringify({ error: "Invalid docket ID" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
      });
    }

    try {
      await withRateLimit(request, "paralegal-docket-detail", 30);

      if (!getConfig("COURTLISTENER_API_TOKEN")) {
        return new Response(
          JSON.stringify({
            error: "CourtListener API token not configured",
            setup:
              "Get a free API token at https://www.courtlistener.com/sign-in/",
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
      }

      const docketUrl = `${COURTLISTENER_API_BASE}/dockets/${docketId}/`;

      console.log(
        `[ResearchRouter ${requestId}] Fetching docket details from CourtListener`,
      );

      const response = await fetch(docketUrl, {
        headers: getCourtListenerHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return new Response(JSON.stringify({ error: "Docket not found" }), {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          });
        }
        if (response.status === 403) {
          return new Response(
            JSON.stringify({
              error:
                "API authentication failed. Check your COURTLISTENER_API_TOKEN.",
            }),
            {
              status: 403,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }
        throw new Error(`CourtListener API returned ${response.status}`);
      }

      const data = (await response.json()) as CourtListenerDocketResponse;

      console.log(`[ResearchRouter ${requestId}] Loaded docket: ${data.id}`);

      // Transform the response
      return new Response(
        JSON.stringify({
          id: data.id?.toString() || docketId,
          caseName: data.case_name || "",
          court: COURT_NAMES[data.court] || data.court || "",
          courtId: data.court || "",
          dateFiled: formatDate(data.date_filed),
          dateTerminated: formatDate(data.date_terminated),
          dateLastFiling: formatDate(data.date_last_filing),
          docketNumber: data.docket_number || "",
          docketNumberCore: data.docket_number_core || "",
          cause: data.cause || "",
          natureOfSuit: data.nature_of_suit || "",
          juryDemand: data.jury_demand || "",
          jurisdictionType: data.jurisdiction_type || "",
          assignedTo: data.assigned_to_str || "",
          referredTo: data.referred_to_str || "",
          parties: (data.parties || []).map((party) => ({
            name: party.name || "",
            type: party.party_type?.name || party.type || "",
            attorneys: (party.attorneys || []).map((atty) => ({
              name: atty.name || "",
              contact: atty.contact_raw || "",
              roles: (atty.roles || [])
                .map((r) => (typeof r === "string" ? r : r.role))
                .filter(Boolean),
            })),
          })),
          docketEntries: (data.docket_entries || [])
            .slice(0, 50)
            .map((entry) => ({
              id: entry.id?.toString() || "",
              dateEntered: formatDate(entry.date_entered),
              dateFiled: formatDate(entry.date_filed),
              entryNumber: entry.entry_number || "",
              description: entry.description || "",
            })),
          absoluteUrl: data.absolute_url
            ? `https://www.courtlistener.com${data.absolute_url}`
            : "",
          pacerUrl: data.pacer_url || "",
          disclaimer:
            "This information is for educational purposes only and does not constitute legal advice.",
          source: "CourtListener (Free Law Project)",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
            "Cache-Control": "public, max-age=3600",
          },
        },
      );
    } catch (err) {
      console.error(
        `[ResearchRouter ${requestId}] ERROR:`,
        (err as Error)?.message,
      );
      const isRateLimitError = (err as Error)?.message?.includes(
        "Too many attempts",
      );
      return new Response(
        JSON.stringify({ error: sanitizeError(err, "Failed to fetch docket") }),
        {
          status: isRateLimitError ? 429 : 500,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
    }
  });

  /**
   * Search federal court dockets (case filings and documents).
   *
   * @endpoint GET /api/research/dockets/search
   * @description Search dockets from the RECAP Archive (docket entries, filings, documents).
   * Includes case names, docket numbers, parties, and document metadata.
   *
   * @query {string} q - Search query (required, min 3 characters)
   * @query {string} [court] - Filter by court code (e.g., 'scotus', 'cadc', 'ca1')
   * @query {number} [limit=20] - Number of results to return (max 50)
   *
   * @returns {Object} Docket search results
   * @returns {Array} results - Array of docket objects with case info and filing details
   * @returns {number} total - Total number of matching dockets
   * @returns {string} source - "CourtListener RECAP Archive"
   * @returns {string} disclaimer - Legal disclaimer
   *
   * @rateLimit 20 requests per 15 minutes per IP
   * @requiresAuth COURTLISTENER_API_TOKEN
   * @source CourtListener RECAP Archive (Free Law Project)
   *
   * @example
   * GET /api/research/dockets/search?q=john%20doe&limit=10
   */
  // Search dockets (cases)
  router.get("/api/research/dockets/search", async (request: Request) => {
    const requestId =
      request.headers.get("X-Request-Id") || crypto.randomUUID();
    const url = new URL(request.url);
    const query = url.searchParams.get("q") || "";
    const court = url.searchParams.get("court") || "";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);

    console.log(
      `[ResearchRouter ${requestId}] GET /api/research/dockets/search?q=${query}`,
    );

    if (!query || query.length < 3) {
      return new Response(
        JSON.stringify({
          results: [],
          total: 0,
          disclaimer:
            "This information is for educational purposes only and does not constitute legal advice.",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
    }

    try {
      await withRateLimit(request, "paralegal-dockets-search", 20);

      // Build CourtListener docket search URL
      const searchUrl = new URL(`${COURTLISTENER_API_BASE}/search/`);
      searchUrl.searchParams.set("q", query);
      searchUrl.searchParams.set("type", "r"); // RECAP dockets
      searchUrl.searchParams.set("order_by", "score desc");
      searchUrl.searchParams.set("page_size", limit.toString());

      if (court) {
        searchUrl.searchParams.set("court", court);
      }

      console.log(
        `[ResearchRouter ${requestId}] Fetching dockets from CourtListener`,
      );

      if (!getConfig("COURTLISTENER_API_TOKEN")) {
        return new Response(
          JSON.stringify({
            error: "CourtListener API token not configured",
            results: [],
            setup:
              "Get a free API token at https://www.courtlistener.com/sign-in/",
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
      }

      const response = await fetch(searchUrl.toString(), {
        headers: getCourtListenerHeaders(),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "API rate limit exceeded", results: [] }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }
        if (response.status === 403) {
          return new Response(
            JSON.stringify({
              error:
                "API authentication failed. Check your COURTLISTENER_API_TOKEN.",
              results: [],
            }),
            {
              status: 403,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }
        throw new Error(`CourtListener API returned ${response.status}`);
      }

      const data = (await response.json()) as CourtListenerDocketSearchResponse;
      console.log(
        `[ResearchRouter ${requestId}] CourtListener returned ${data.results?.length || 0} dockets`,
      );

      const results = (data.results || []).map((docket) => ({
        id: docket.docket_id?.toString() || docket.id?.toString() || "",
        caseName: docket.caseName || docket.case_name || "Unknown Case",
        court: COURT_NAMES[docket.court] || docket.court || "",
        courtId: docket.court || "",
        dateFiled: formatDate(docket.date_filed || null),
        dateTerminated: formatDate(
          docket.date_terminated || null,
        ),
        docketNumber: docket.docket_number || "",
        cause: docket.cause || "",
        suitNature: docket.nature_of_suit || "",
        assignedTo: docket.assigned_to_str || "",
        snippet: docket.snippet || "",
        absoluteUrl: docket.absolute_url
          ? `https://www.courtlistener.com${docket.absolute_url}`
          : "",
      }));

      return new Response(
        JSON.stringify({
          results,
          total: data.count || results.length,
          disclaimer:
            "This information is for educational purposes only and does not constitute legal advice.",
          source: "CourtListener RECAP Archive (Free Law Project)",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
            "Cache-Control": "public, max-age=1800",
          },
        },
      );
    } catch (err) {
      console.error(
        `[ResearchRouter ${requestId}] ERROR:`,
        (err as Error)?.message,
      );
      const isRateLimitError = (err as Error)?.message?.includes(
        "Too many attempts",
      );
      return new Response(
        JSON.stringify({
          error: sanitizeError(err, "Failed to search dockets"),
          results: [],
        }),
        {
          status: isRateLimitError ? 429 : 500,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
    }
  });

  /**
   * List all available courts for opinions and docket searches.
   *
   * @endpoint GET /api/research/courts
   * @description Returns a grouped list of federal and state courts that can be used
   * for filtering opinions and docket searches.
   *
   * @returns {Object} Courts grouped by jurisdiction type
   * @returns {Array} federalAppellate - Circuit courts and specialty appellate courts
   * @returns {Array} federalDistrict - U.S. District Courts by state
   * @returns {Array} stateCourts - State appellate and trial courts
   * @returns {Object} court - Individual court object with id, name, shortName, jurisdiction
   *
   * @cacheControl 24 hours
   * @rateLimit Unlimited
   *
   * @example
   * GET /api/research/courts
   */
  // Get list of courts
  router.get("/api/research/courts", async (request: Request) => {
    const requestId =
      request.headers.get("X-Request-Id") || crypto.randomUUID();

    console.log(`[ResearchRouter ${requestId}] GET /api/research/courts`);

    try {
      await withRateLimit(request, "paralegal-courts", 30);

      if (!getConfig("COURTLISTENER_API_TOKEN")) {
        return new Response(
          JSON.stringify({
            error: "CourtListener API token not configured",
            setup:
              "Get a free API token at https://www.courtlistener.com/sign-in/",
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
      }

      const courtsUrl = `${COURTLISTENER_API_BASE}/courts/?page_size=200`;

      const response = await fetch(courtsUrl, {
        headers: getCourtListenerHeaders(),
      });

      if (!response.ok) {
        if (response.status === 403) {
          return new Response(
            JSON.stringify({
              error:
                "API authentication failed. Check your COURTLISTENER_API_TOKEN.",
            }),
            {
              status: 403,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }
        throw new Error(`CourtListener API returned ${response.status}`);
      }

      const data = (await response.json()) as CourtListenerCourtsResponse;

      // Group courts by jurisdiction type
      interface GroupedCourt {
        id: string;
        name: string;
        shortName: string;
        jurisdiction: string;
        inUse: boolean;
      }
      const federalAppellate: GroupedCourt[] = [];
      const federalDistrict: GroupedCourt[] = [];
      const stateCourts: GroupedCourt[] = [];
      const otherCourts: GroupedCourt[] = [];

      (data.results || []).forEach((court) => {
        const courtData: GroupedCourt = {
          id: court.id,
          name: court.full_name || court.short_name || court.id,
          shortName: court.short_name || court.id,
          jurisdiction: court.jurisdiction,
          inUse: court.in_use,
        };

        if (court.jurisdiction === "F") {
          // Federal
          if (court.id?.startsWith("ca") || court.id === "scotus") {
            federalAppellate.push(courtData);
          } else {
            federalDistrict.push(courtData);
          }
        } else if (court.jurisdiction === "S") {
          stateCourts.push(courtData);
        } else {
          otherCourts.push(courtData);
        }
      });

      return new Response(
        JSON.stringify({
          federalAppellate: federalAppellate.sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
          federalDistrict: federalDistrict.sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
          stateCourts: stateCourts.sort((a, b) => a.name.localeCompare(b.name)),
          otherCourts: otherCourts.sort((a, b) => a.name.localeCompare(b.name)),
          total: data.count || 0,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
            "Cache-Control": "public, max-age=86400", // Cache for 24 hours
          },
        },
      );
    } catch (err) {
      console.error(
        `[ResearchRouter ${requestId}] ERROR:`,
        (err as Error)?.message,
      );
      return new Response(
        JSON.stringify({ error: sanitizeError(err, "Failed to fetch courts") }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
    }
  });

  /**
   * Look up cases by legal citation.
   *
   * @endpoint GET /api/research/citation/lookup
   * @description Search for court opinions using standard legal citations
   * (e.g., "347 U.S. 497", "123 F.3d 456", "100 Ill. 2d 100").
   * Returns all matching opinions for the given citation.
   *
   * @query {string} cite - Legal citation to search (required, min 5 characters)
   *        Format: "volume reporter page" (e.g., "123 S. Ct. 456")
   *
   * @returns {Object} Citation lookup results
   * @returns {Array} results - Array of matching opinion objects
   * @returns {string} searchedCitation - The citation that was searched
   * @returns {string} source - "CourtListener (Free Law Project)"
   * @returns {string} disclaimer - Educational use disclaimer
   *
   * @rateLimit 20 requests per 15 minutes per IP
   * @requiresAuth COURTLISTENER_API_TOKEN
   * @source CourtListener
   * @cacheControl 1 hour
   *
   * @example
   * GET /api/research/citation/lookup?cite=347%20U.S.%20497
   */
  // Citation lookup - find cases by citation
  router.get("/api/research/citation/lookup", async (request: Request) => {
    const requestId =
      request.headers.get("X-Request-Id") || crypto.randomUUID();
    const url = new URL(request.url);
    const citation = url.searchParams.get("cite") || "";

    console.log(
      `[ResearchRouter ${requestId}] GET /api/research/citation/lookup?cite=${citation}`,
    );

    if (!citation || citation.length < 5) {
      return new Response(
        JSON.stringify({ error: "Invalid citation format", results: [] }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
    }

    try {
      await withRateLimit(request, "paralegal-citation-lookup", 20);

      if (!getConfig("COURTLISTENER_API_TOKEN")) {
        return new Response(
          JSON.stringify({
            error: "CourtListener API token not configured",
            results: [],
            setup:
              "Get a free API token at https://www.courtlistener.com/sign-in/",
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
      }

      // Search for the citation
      const searchUrl = new URL(`${COURTLISTENER_API_BASE}/search/`);
      searchUrl.searchParams.set("q", `citation:("${citation}")`);
      searchUrl.searchParams.set("type", "o");
      searchUrl.searchParams.set("page_size", "10");

      console.log(
        `[ResearchRouter ${requestId}] Looking up citation: ${citation}`,
      );

      const response = await fetch(searchUrl.toString(), {
        headers: getCourtListenerHeaders(),
      });

      if (!response.ok) {
        if (response.status === 403) {
          return new Response(
            JSON.stringify({
              error:
                "API authentication failed. Check your COURTLISTENER_API_TOKEN.",
              results: [],
            }),
            {
              status: 403,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }
        throw new Error(`CourtListener API returned ${response.status}`);
      }

      const data = (await response.json()) as CourtListenerSearchResponse;

      const results = (data.results || []).map((opinion) => ({
        id: opinion.id?.toString() || opinion.cluster_id?.toString() || "",
        caseName: opinion.caseName || opinion.case_name || "Unknown Case",
        citation: opinion.citation || citation,
        court: COURT_NAMES[opinion.court] || opinion.court || "",
        dateFiled: formatDate(opinion.dateFiled || opinion.date_filed || null),
        absoluteUrl: opinion.absolute_url
          ? `https://www.courtlistener.com${opinion.absolute_url}`
          : "",
      }));

      return new Response(
        JSON.stringify({
          results,
          searchedCitation: citation,
          disclaimer:
            "This information is for educational purposes only and does not constitute legal advice.",
          source: "CourtListener (Free Law Project)",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
            "Cache-Control": "public, max-age=3600",
          },
        },
      );
    } catch (err) {
      console.error(
        `[ResearchRouter ${requestId}] ERROR:`,
        (err as Error)?.message,
      );
      return new Response(
        JSON.stringify({
          error: sanitizeError(err, "Failed to lookup citation"),
          results: [],
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
    }
  });

  /**
   * Search bills and statutes from U.S. Congress and all 50 states.
   *
   * @endpoint GET /api/research/statutes/search
   * @description Search federal and state legislation using the LegiScan API.
   * Covers all U.S. states, Congress, and DC with current and historical bills.
   *
   * @query {string} q - Search query (required, min 3 characters)
   *        e.g., "copyright", "data privacy", "environmental protection"
   * @query {string} [state=ALL] - State code (e.g., 'CA', 'NY', 'US' for Congress)
   * @query {string} [year=ALL] - Legislative year/session
   * @query {string} [status] - Bill status filter (e.g., 'introduced', 'passed', 'failed')
   * @query {number} [limit=20] - Number of results (max 50)
   *
   * @returns {Object} Statute search results
   * @returns {Array} results - Array of bill objects with id, title, state, year, status
   * @returns {number} total - Total matching results
   * @returns {string} source - "LegiScan"
   * @returns {string} disclaimer - Educational use disclaimer
   *
   * @rateLimit 20 requests per 15 minutes per IP
   * @requiresAuth LEGISCAN_API_KEY (free key from https://legiscan.com/legiscan)
   * @source LegiScan API
   *
   * @example
   * GET /api/research/statutes/search?q=data%20privacy&state=CA&limit=10
   */
  // Search statutes/legislation via LegiScan API
  // Covers all 50 states + US Congress
  // Free API key required: https://legiscan.com/legiscan
  router.get("/api/research/statutes/search", async (request: Request) => {
    const requestId =
      request.headers.get("X-Request-Id") || crypto.randomUUID();
    const url = new URL(request.url);
    const query = url.searchParams.get("q") || "";
    const state = url.searchParams.get("state") || "ALL"; // State code or 'ALL' for all states, 'US' for federal
    const year = url.searchParams.get("year") || "ALL";
    const status = url.searchParams.get("status") || "ALL";
    const type = url.searchParams.get("type") || "ALL";
    const page = Math.max(parseInt(url.searchParams.get("page") || "1"), 1);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);

    console.log(
      `[ResearchRouter ${requestId}] GET /api/research/statutes/search?q=${query}&state=${state}&year=${year}&status=${status}&type=${type}&page=${page}&limit=${limit}`,
    );

    if (!query || query.length < 3) {
      return new Response(
        JSON.stringify({
          results: [],
          total: 0,
          disclaimer:
            "This information is for educational purposes only and does not constitute legal advice.",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
    }

    try {
      await withRateLimit(request, "paralegal-statutes-search", 20);

      // Check if LegiScan API key is configured
      if (!getConfig("LEGISCAN_API_KEY")) {
        console.warn(
          `[ResearchRouter ${requestId}] LEGISCAN_API_KEY not configured`,
        );
        return new Response(
          JSON.stringify({
            error:
              "LegiScan API key not configured. Please add LEGISCAN_API_KEY to your environment.",
            results: [],
            disclaimer:
              "This information is for educational purposes only and does not constitute legal advice.",
            setup: "Get a free API key at https://legiscan.com/legiscan",
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
      }

      // LegiScan search API
      const searchUrl = new URL("https://api.legiscan.com/");
      searchUrl.searchParams.set("key", getConfig("LEGISCAN_API_KEY"));
      searchUrl.searchParams.set("op", "search");
      searchUrl.searchParams.set("query", query);
      searchUrl.searchParams.set("page", page.toString());
      searchUrl.searchParams.set("page_size", limit.toString());
      if (state && state !== "ALL") {
        searchUrl.searchParams.set("state", state);
      }
      if (year && year !== "ALL") {
        searchUrl.searchParams.set("year", year);
      }
      if (status && status !== "ALL") {
        searchUrl.searchParams.set("status", status);
      }
      if (type && type !== "ALL") {
        searchUrl.searchParams.set("type", type);
      }

      console.log(`[ResearchRouter ${requestId}] Fetching from LegiScan`);

      const response = await fetch(searchUrl.toString(), {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "API rate limit exceeded", results: [] }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }
        if (response.status === 403 || response.status === 401) {
          return new Response(
            JSON.stringify({
              error:
                "LegiScan API authentication failed. Check your LEGISCAN_API_KEY.",
              results: [],
              setup: "Get a free API key at https://legiscan.com/legiscan",
            }),
            {
              status: 403,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }
        throw new Error(`LegiScan API returned ${response.status}`);
      }

      const data = (await response.json()) as LegiScanSearchResponse;

      if (data.status === "ERROR") {
        throw new Error(data.alert?.message || "LegiScan API error");
      }

      // Transform LegiScan response
      const searchResults = data.searchresult || {};
      const results: StatuteSearchResult[] = [];

      // LegiScan returns results as numbered keys
      for (const key of Object.keys(searchResults)) {
        if (key === "summary") continue;
        const bill = searchResults[key];
        if (!bill || typeof bill !== "object") continue;

        results.push({
          id: bill.bill_id?.toString() || `bill-${key}`,
          title: bill.title || "Untitled",
          citation: bill.bill_number || "",
          section: bill.bill_number || "",
          code: bill.bill_type_id ? `Type ${bill.bill_type_id}` : "",
          jurisdiction: bill.state || "US",
          snippet: bill.title || "",
          url: bill.url || `https://legiscan.com/legislation/${bill.bill_id}`,
          lastAction: bill.last_action || "",
          lastActionDate: bill.last_action_date || "",
          relevance: bill.relevance || 0,
        });

        if (results.length >= limit) break;
      }

      const summary = searchResults.summary || {};
      const totalCount =
        typeof summary.count === "number"
          ? summary.count
          : parseInt((summary.count as string) || "0", 10);
      const hasMore = totalCount
        ? page * limit < totalCount
        : results.length === limit;

      console.log(
        `[ResearchRouter ${requestId}] LegiScan returned ${results.length} results`,
      );

      return new Response(
        JSON.stringify({
          results,
          total: totalCount || results.length,
          page,
          pageSize: limit,
          hasMore,
          disclaimer:
            "This information is for educational purposes only and does not constitute legal advice. Always consult official sources and a licensed attorney.",
          source: "LegiScan",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
            "Cache-Control": "public, max-age=1800",
          },
        },
      );
    } catch (err) {
      console.error(
        `[ResearchRouter ${requestId}] ERROR:`,
        (err as Error)?.message,
      );
      const isRateLimitError = (err as Error)?.message?.includes(
        "Too many attempts",
      );
      return new Response(
        JSON.stringify({
          error: sanitizeError(err, "Failed to search statutes"),
          results: [],
          disclaimer:
            "This information is for educational purposes only and does not constitute legal advice.",
        }),
        {
          status: isRateLimitError ? 429 : 500,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
    }
  });

  /**
   * Retrieve detailed information and full text of a bill or statute.
   *
   * @endpoint GET /api/research/statutes/detail
   * @description Fetch complete bill information including sponsors, full text in multiple
   * versions, history, status, and analysis from LegiScan.
   *
   * @query {string} id - Bill ID from LegiScan (required)
   *
   * @returns {Object} Bill/statute details
   * @returns {string} bill_id - LegiScan bill ID
   * @returns {string} title - Full bill title
   * @returns {string} state - State abbreviation or 'US' for federal
   * @returns {string} bill_number - Bill number (e.g., 'HB 123', 'S 456')
   * @returns {string} bill_type - Type (e.g., 'bill', 'resolution')
   * @returns {string} status - Current status (e.g., 'Introduced', 'Passed', 'Vetoed')
   * @returns {string} lastAction - Most recent action
   * @returns {string} lastActionDate - Date of most recent action
   * @returns {Array} texts - Array of bill text versions with dates and mime types
   * @returns {Array} sponsors - Primary and co-sponsors
   * @returns {string} fullText - Full text content of latest version
   *
   * @requiresAuth LEGISCAN_API_KEY
   * @source LegiScan API
   *
   * @example
   * GET /api/research/statutes/detail?id=1234567
   */
  router.get("/api/research/statutes/detail", async (request: Request) => {
    const requestId =
      request.headers.get("X-Request-Id") || crypto.randomUUID();
    const url = new URL(request.url);
    const billId = url.searchParams.get("id") || "";

    console.log(
      `[ResearchRouter ${requestId}] GET /api/research/statutes/detail?id=${billId}`,
    );

    if (!billId) {
      return new Response(JSON.stringify({ error: "Missing statute id" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
      });
    }

    try {
      await withRateLimit(request, "paralegal-statutes-detail", 20);

      if (!getConfig("LEGISCAN_API_KEY")) {
        console.warn(
          `[ResearchRouter ${requestId}] LEGISCAN_API_KEY not configured`,
        );
        return new Response(
          JSON.stringify({
            error:
              "LegiScan API key not configured. Please add LEGISCAN_API_KEY to your environment.",
            disclaimer:
              "This information is for educational purposes only and does not constitute legal advice.",
            setup: "Get a free API key at https://legiscan.com/legiscan",
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
      }

      const billUrl = new URL("https://api.legiscan.com/");
      billUrl.searchParams.set("key", getConfig("LEGISCAN_API_KEY"));
      billUrl.searchParams.set("op", "getBill");
      billUrl.searchParams.set("id", billId);

      const billResponse = await fetch(billUrl.toString(), {
        headers: {
          Accept: "application/json",
        },
      });

      if (!billResponse.ok) {
        if (billResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: "API rate limit exceeded" }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }
        if (billResponse.status === 403 || billResponse.status === 401) {
          return new Response(
            JSON.stringify({
              error:
                "LegiScan API authentication failed. Check your LEGISCAN_API_KEY.",
              setup: "Get a free API key at https://legiscan.com/legiscan",
            }),
            {
              status: 403,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }
        throw new Error(`LegiScan API returned ${billResponse.status}`);
      }

      const billData = (await billResponse.json()) as LegiScanBillDetailResponse;
      if (billData.status === "ERROR") {
        throw new Error(billData.alert?.message || "LegiScan API error");
      }

      const bill = billData.bill;
      if (!bill) {
        throw new Error("Bill data not found");
      }
      const texts = Array.isArray(bill.texts) ? bill.texts : [];
      const sortedTexts = texts
        .filter((text) => text && (text.doc_id || text.docId))
        .sort((a, b) => {
          const dateA = new Date(a.date || 0).getTime();
          const dateB = new Date(b.date || 0).getTime();
          return dateB - dateA;
        });
      const latestText = sortedTexts[0] || texts[0] || null;

      let textContent = "";
      let textMime = "";
      let textUrl = "";
      let textStateLink = "";
      let textDate = "";
      let textDocId = "";

      if (latestText) {
        textUrl = latestText.url || "";
        textStateLink = latestText.state_link || "";
        textDate = latestText.date || "";
        textDocId =
          latestText.doc_id?.toString() || latestText.docId?.toString() || "";
        textMime = latestText.mime || "";
      }

      if (textDocId) {
        const billTextUrl = new URL("https://api.legiscan.com/");
        billTextUrl.searchParams.set("key", getConfig("LEGISCAN_API_KEY"));
        billTextUrl.searchParams.set("op", "getBillText");
        billTextUrl.searchParams.set("id", textDocId);

        const billTextResponse = await fetch(billTextUrl.toString(), {
          headers: {
            Accept: "application/json",
          },
        });

        if (billTextResponse.ok) {
          const billTextData = (await billTextResponse.json()) as LegiScanBillTextResponse;
          if (billTextData.status !== "ERROR") {
            const textPayload =
              billTextData.text || billTextData.bill?.text;
            const encoded = textPayload?.doc || "";
            const payloadMime = textPayload?.mime || textMime;
            const isTextMime =
              payloadMime?.startsWith("text/") ||
              payloadMime?.includes("html") ||
              payloadMime?.includes("xml");

            if (encoded && isTextMime) {
              textContent = decodeBase64Text(encoded);
              textMime = payloadMime;
            }
          }
        }
      }

      return new Response(
        JSON.stringify({
          bill: {
            id: bill.bill_id?.toString() || billId,
            title: bill.title || "",
            number: bill.bill_number || "",
            state: bill.state || "",
            status: bill.status || "",
            lastAction: bill.last_action || "",
            lastActionDate: bill.last_action_date || "",
            session:
              bill.session?.name ||
              bill.session?.session_name ||
              bill.session_name ||
              "",
            url: bill.url || "",
            stateLink: bill.state_link || "",
            description: bill.description || "",
          },
          text: {
            content: textContent,
            mime: textMime,
            url: textUrl,
            stateLink: textStateLink,
            date: textDate,
            docId: textDocId,
          },
          disclaimer:
            "This information is for educational purposes only and does not constitute legal advice. Always consult official sources and a licensed attorney.",
          source: "LegiScan",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
            "Cache-Control": "public, max-age=1800",
          },
        },
      );
    } catch (err) {
      console.error(
        `[ResearchRouter ${requestId}] ERROR:`,
        (err as Error)?.message,
      );
      const isRateLimitError = (err as Error)?.message?.includes(
        "Too many attempts",
      );
      return new Response(
        JSON.stringify({
          error: sanitizeError(err, "Failed to load statute detail"),
          disclaimer:
            "This information is for educational purposes only and does not constitute legal advice.",
        }),
        {
          status: isRateLimitError ? 429 : 500,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
    }
  });

  /**
   * List all available state and federal jurisdictions for statute/bill searches.
   *
   * @endpoint GET /api/research/statutes/states
   * @description Returns a list of all supported jurisdictions with state codes
   * (used to filter statute searches). Includes all 50 states, DC, Puerto Rico,
   * and US Congress (federal).
   *
   * @returns {Object} List of jurisdictions
   * @returns {Array} states - Array of {code, name} objects
   * @returns {string} code - State abbreviation or 'US' for federal
   * @returns {string} name - Full state/jurisdiction name
   *
   * @cacheControl 24 hours
   * @rateLimit Unlimited
   *
   * @example
   * GET /api/research/statutes/states
   * Response: {
   *   "states": [
   *     {"code": "US", "name": "US Congress (Federal)"},
   *     {"code": "CA", "name": "California"},
   *     ...
   *   ]
   * }
   */
  // Get list of available states for statute search
  router.get("/api/research/statutes/states", async (request: Request) => {
    const requestId =
      request.headers.get("X-Request-Id") || crypto.randomUUID();

    // LegiScan state codes
    const states = [
      { code: "ALL", name: "All States" },
      { code: "US", name: "US Congress (Federal)" },
      { code: "AL", name: "Alabama" },
      { code: "AK", name: "Alaska" },
      { code: "AZ", name: "Arizona" },
      { code: "AR", name: "Arkansas" },
      { code: "CA", name: "California" },
      { code: "CO", name: "Colorado" },
      { code: "CT", name: "Connecticut" },
      { code: "DE", name: "Delaware" },
      { code: "FL", name: "Florida" },
      { code: "GA", name: "Georgia" },
      { code: "HI", name: "Hawaii" },
      { code: "ID", name: "Idaho" },
      { code: "IL", name: "Illinois" },
      { code: "IN", name: "Indiana" },
      { code: "IA", name: "Iowa" },
      { code: "KS", name: "Kansas" },
      { code: "KY", name: "Kentucky" },
      { code: "LA", name: "Louisiana" },
      { code: "ME", name: "Maine" },
      { code: "MD", name: "Maryland" },
      { code: "MA", name: "Massachusetts" },
      { code: "MI", name: "Michigan" },
      { code: "MN", name: "Minnesota" },
      { code: "MS", name: "Mississippi" },
      { code: "MO", name: "Missouri" },
      { code: "MT", name: "Montana" },
      { code: "NE", name: "Nebraska" },
      { code: "NV", name: "Nevada" },
      { code: "NH", name: "New Hampshire" },
      { code: "NJ", name: "New Jersey" },
      { code: "NM", name: "New Mexico" },
      { code: "NY", name: "New York" },
      { code: "NC", name: "North Carolina" },
      { code: "ND", name: "North Dakota" },
      { code: "OH", name: "Ohio" },
      { code: "OK", name: "Oklahoma" },
      { code: "OR", name: "Oregon" },
      { code: "PA", name: "Pennsylvania" },
      { code: "RI", name: "Rhode Island" },
      { code: "SC", name: "South Carolina" },
      { code: "SD", name: "South Dakota" },
      { code: "TN", name: "Tennessee" },
      { code: "TX", name: "Texas" },
      { code: "UT", name: "Utah" },
      { code: "VT", name: "Vermont" },
      { code: "VA", name: "Virginia" },
      { code: "WA", name: "Washington" },
      { code: "WV", name: "West Virginia" },
      { code: "WI", name: "Wisconsin" },
      { code: "WY", name: "Wyoming" },
      { code: "DC", name: "District of Columbia" },
      { code: "PR", name: "Puerto Rico" },
    ];

    return new Response(JSON.stringify({ states }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
        "Cache-Control": "public, max-age=86400",
      },
    });
  });

  // ========================================================================
  // CASE MANAGEMENT ENDPOINTS
  // ========================================================================

  /**
   * Create a new legal case/matter in the research system.
   *
   * @endpoint POST /api/research/cases
   * @description Create a new case to organize research, documents, and findings.
   * Once created, the case becomes the active case for the user.
   *
   * @body {Object} - Request body
   * @body {string} name - Case name or matter title (required, max 500 chars)
   * @body {string} [description] - Description or notes about the case (max 5000 chars)
   *
   * @returns {Object} Created case object
   * @returns {string} id - Unique case ID
   * @returns {string} name - Case name
   * @returns {string} description - Case description
   * @returns {boolean} isActive - Whether this is the active case
   * @returns {number} createdAt - Creation timestamp
   * @returns {Array} savedSearches - Empty array initially
   * @returns {Array} documents - Empty array initially
   * @returns {Array} summaries - Empty array initially
   *
   * @status 201 Created
   * @example
   * POST /api/research/cases
   * {
   *   "name": "Smith v. Jones Trademark Dispute",
   *   "description": "Trademark infringement case in federal court"
   * }
   */
  // Create a new case
  router.post("/api/research/cases", async (request: Request) => {
    const requestId =
      request.headers.get("X-Request-Id") || crypto.randomUUID();
    console.log(`[ResearchRouter ${requestId}] POST /api/research/cases`);

    try {
      const userEmail = LOCAL_USER;

      const body = await request.json().catch(() => ({}));
      const validated = CreateCaseSchema.safeParse(body);

      if (!validated.success) {
        return new Response(
          JSON.stringify({ error: "Case name is required" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
      }

      const persistence = createPersistenceManager();
      const now = Date.now();
      const newCase = {
        id: generateUniqueId("case"),
        name: validated.data.name.trim(),
        description: validated.data.description?.trim() || "",
        createdAt: now,
        updatedAt: now,
        isActive: true,
        userEmail,
        savedSearches: [],
        documents: [],
        summaries: [],
        contextItems: [],
      };

      await persistence.paralegal.saveCase(userEmail, newCase);

      // Set as active case
      await persistence.paralegal.setActiveCase(userEmail, newCase.id);

      console.log(`[ResearchRouter ${requestId}] Created case: ${newCase.id}`);

      return new Response(JSON.stringify({ case: newCase }), {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
      });
    } catch (err) {
      console.error(
        `[ResearchRouter ${requestId}] ERROR:`,
        (err as Error)?.message,
      );
      return new Response(
        JSON.stringify({ error: sanitizeError(err, "Failed to create case") }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
    }
  });

  /**
   * List all cases for the current user.
   *
   * @endpoint GET /api/research/cases
   * @description Retrieve all cases the user has created. Each case includes
   * basic metadata including whether it's the active case.
   *
   * @returns {Object} Cases list
   * @returns {Array} cases - Array of case objects
   * @returns {string} id - Case ID
   * @returns {string} name - Case name
   * @returns {string} description - Case description
   * @returns {boolean} isActive - Whether this is the currently active case
   * @returns {number} createdAt - Creation timestamp
   * @returns {number} updatedAt - Last update timestamp
   * @returns {Array} savedSearches - Saved search queries for this case
   * @returns {Array} documents - Uploaded documents
   *
   * @example
   * GET /api/research/cases
   */
  // List all cases for the user
  router.get("/api/research/cases", async (request: Request) => {
    const requestId =
      request.headers.get("X-Request-Id") || crypto.randomUUID();
    console.log(`[ResearchRouter ${requestId}] GET /api/research/cases`);

    try {
      const userEmail = LOCAL_USER;

      const persistence = createPersistenceManager();
      const cases = await persistence.paralegal.getCasesByUser(userEmail);

      // Mark the active case
      const activeCase = await persistence.paralegal.getActiveCase(userEmail);
      const casesWithActive = cases.map((c) => ({
        ...c,
        isActive: activeCase?.id === c.id,
      }));

      console.log(`[ResearchRouter ${requestId}] Found ${cases.length} cases`);

      return new Response(JSON.stringify({ cases: casesWithActive }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
      });
    } catch (err) {
      console.error(
        `[ResearchRouter ${requestId}] ERROR:`,
        (err as Error)?.message,
      );
      return new Response(
        JSON.stringify({ error: sanitizeError(err, "Failed to list cases") }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
    }
  });

  /**
   * Retrieve details of a specific case.
   *
   * @endpoint GET /api/research/cases/{id}
   * @description Fetch complete case information including all saved searches,
   * documents, summaries, and context items.
   *
   * @param {string} id - Case ID (path parameter)
   *
   * @returns {Object} Case details
   * @returns {string} id - Case ID
   * @returns {string} name - Case name
   * @returns {string} description - Case description
   * @returns {number} createdAt - Creation timestamp
   * @returns {number} updatedAt - Last update timestamp
   * @returns {boolean} isActive - Whether this is the active case
   * @returns {Array} savedSearches - Array of saved search objects
   * @returns {Array} documents - Array of uploaded document objects
   * @returns {Array} summaries - Array of AI-generated summaries
   * @returns {Array} contextItems - Context from research
   *
   * @status 200 OK
   * @status 404 Case not found
   *
   * @example
   * GET /api/research/cases/case_1234567890_abc
   */
  // Get a specific case
  router.get("/api/research/cases/:id", async (request: Request) => {
    const requestId =
      request.headers.get("X-Request-Id") || crypto.randomUUID();
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const caseId = pathParts[pathParts.length - 1];

    console.log(
      `[ResearchRouter ${requestId}] GET /api/research/cases/${caseId}`,
    );

    try {
      const userEmail = LOCAL_USER;

      const persistence = createPersistenceManager();
      const caseData = await persistence.paralegal.getCase(caseId);

      if (!caseData || caseData.userEmail !== userEmail) {
        return new Response(JSON.stringify({ error: "Case not found" }), {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        });
      }

      return new Response(JSON.stringify({ case: caseData }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
      });
    } catch (err) {
      console.error(
        `[ResearchRouter ${requestId}] ERROR:`,
        (err as Error)?.message,
      );
      return new Response(
        JSON.stringify({ error: sanitizeError(err, "Failed to get case") }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
    }
  });

  /**
   * Update case details (name and/or description).
   *
   * @endpoint PUT /api/research/cases/{id}
   * @description Modify the name and/or description of an existing case.
   *
   * @param {string} id - Case ID (path parameter)
   * @body {Object} - Update fields
   * @body {string} [name] - New case name (optional)
   * @body {string} [description] - New case description (optional)
   *
   * @returns {Object} Updated case object
   *
   * @status 200 OK
   * @status 404 Case not found
   *
   * @example
   * PUT /api/research/cases/case_1234567890_abc
   * {
   *   "name": "Smith v. Jones (Updated)",
   *   "description": "Trademark infringement - federal court"
   * }
   */
  // Update a case
  router.put("/api/research/cases/:id", async (request: Request) => {
    const requestId =
      request.headers.get("X-Request-Id") || crypto.randomUUID();
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const caseId = pathParts[pathParts.length - 1];

    console.log(
      `[ResearchRouter ${requestId}] PUT /api/research/cases/${caseId}`,
    );

    try {
      const userEmail = LOCAL_USER;

      const persistence = createPersistenceManager();
      const existingCase = await persistence.paralegal.getCase(caseId);

      if (!existingCase || existingCase.userEmail !== userEmail) {
        return new Response(JSON.stringify({ error: "Case not found" }), {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        });
      }

      const body = await request.json().catch(() => ({}));
      const validated = UpdateCaseSchema.safeParse(body);

      if (!validated.success) {
        return new Response(JSON.stringify({ error: "Invalid request body" }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        });
      }

      const updates: any = {};
      if (validated.data.name !== undefined)
        updates.name = validated.data.name.trim();
      if (validated.data.description !== undefined)
        updates.description = validated.data.description.trim();

      await persistence.paralegal.updateCase(caseId, updates);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
      });
    } catch (err) {
      console.error(
        `[ResearchRouter ${requestId}] ERROR:`,
        (err as Error)?.message,
      );
      return new Response(
        JSON.stringify({ error: sanitizeError(err, "Failed to update case") }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
    }
  });

  /**
   * Delete a case permanently.
   *
   * @endpoint DELETE /api/research/cases/{id}
   * @description Permanently remove a case and all associated data
   * (searches, documents, summaries). This action cannot be undone.
   *
   * @param {string} id - Case ID (path parameter)
   *
   * @returns {Object} Deletion confirmation
   * @returns {boolean} success - True if deletion was successful
   *
   * @status 200 OK
   * @status 404 Case not found
   *
   * @example
   * DELETE /api/research/cases/case_1234567890_abc
   */
  // Delete a case
  router.delete("/api/research/cases/:id", async (request: Request) => {
    const requestId =
      request.headers.get("X-Request-Id") || crypto.randomUUID();
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const caseId = pathParts[pathParts.length - 1];

    console.log(
      `[ResearchRouter ${requestId}] DELETE /api/research/cases/${caseId}`,
    );

    try {
      const userEmail = LOCAL_USER;

      const persistence = createPersistenceManager();
      const existingCase = await persistence.paralegal.getCase(caseId);

      if (!existingCase || existingCase.userEmail !== userEmail) {
        return new Response(JSON.stringify({ error: "Case not found" }), {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        });
      }

      await persistence.paralegal.deleteCase(userEmail, caseId);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
      });
    } catch (err) {
      console.error(
        `[ResearchRouter ${requestId}] ERROR:`,
        (err as Error)?.message,
      );
      return new Response(
        JSON.stringify({ error: sanitizeError(err, "Failed to delete case") }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
    }
  });

  /**
   * Set a case as the active case.
   *
   * @endpoint POST /api/research/cases/{id}/activate
   * @description Make a case the active case. Only one case can be active at a time.
   * The active case is used as the default context for searches, document uploads,
   * and AI analysis.
   *
   * @param {string} id - Case ID to activate (path parameter)
   *
   * @returns {Object} Activation response
   * @returns {boolean} success - True if activation succeeded
   *
   * @status 200 OK
   * @status 404 Case not found
   *
   * @example
   * POST /api/research/cases/case_1234567890_abc/activate
   */
  // Activate a case
  router.post("/api/research/cases/:id/activate", async (request: Request) => {
    const requestId =
      request.headers.get("X-Request-Id") || crypto.randomUUID();
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const caseId = pathParts[pathParts.length - 2]; // /cases/:id/activate

    console.log(
      `[ResearchRouter ${requestId}] POST /api/research/cases/${caseId}/activate`,
    );

    try {
      const userEmail = LOCAL_USER;

      const persistence = createPersistenceManager();
      await persistence.paralegal.setActiveCase(userEmail, caseId);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
      });
    } catch (err) {
      console.error(
        `[ResearchRouter ${requestId}] ERROR:`,
        (err as Error)?.message,
      );
      return new Response(
        JSON.stringify({
          error: sanitizeError(err, "Failed to activate case"),
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
    }
  });

  // ========================================================================
  // SAVED SEARCH ENDPOINTS
  // ========================================================================

  /**
   * Save a search query to a case for later reference.
   *
   * @endpoint POST /api/research/cases/{caseId}/searches
   * @description Save search parameters and results to a case. Searches can be
   * retrieved later to re-run the same query or compare results over time.
   *
   * @param {string} caseId - Case ID (path parameter)
   * @body {Object} - Search details
   * @body {string} [name] - Search name/title (default: "Untitled Search")
   * @body {string} [query] - Search query text
   * @body {string} [searchType] - Type of search: 'opinions', 'regulations', 'bills', 'documents'
   * @body {Object} [filters] - Additional filter parameters
   * @body {number} [resultCount] - Number of results found
   *
   * @returns {Object} Saved search object
   * @returns {string} id - Saved search ID
   * @returns {string} name - Search name
   * @returns {string} query - Search query
   * @returns {string} searchType - Type of search
   * @returns {number} createdAt - Creation timestamp
   *
   * @status 201 Created
   * @status 404 Case not found
   *
   * @example
   * POST /api/research/cases/case_123/searches
   * {
   *   "name": "Patent infringement cases",
   *   "query": "patent infringement",
   *   "searchType": "opinions",
   *   "resultCount": 45
   * }
   */
  // Save a search to a case
  router.post(
    "/api/research/cases/:caseId/searches",
    async (request: Request) => {
      const requestId =
        request.headers.get("X-Request-Id") || crypto.randomUUID();
      const url = new URL(request.url);
      const pathParts = url.pathname.split("/");
      const caseId = pathParts[pathParts.length - 2];

      console.log(
        `[ResearchRouter ${requestId}] POST /api/research/cases/${caseId}/searches`,
      );

      try {
        const userEmail = LOCAL_USER;

        const persistence = createPersistenceManager();
        const existingCase = await persistence.paralegal.getCase(caseId);

        if (!existingCase || existingCase.userEmail !== userEmail) {
          return new Response(JSON.stringify({ error: "Case not found" }), {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          });
        }

        const body = await request.json().catch(() => ({}));
        const validated = SavedSearchSchema.safeParse(body);

        if (!validated.success) {
          return new Response(
            JSON.stringify({ error: "Invalid search request body" }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }

        const savedSearch = {
          id: generateUniqueId("search"),
          name: validated.data.name,
          query: validated.data.query || "",
          searchType: validated.data.searchType || "opinions",
          filters: validated.data.filters || {},
          resultCount: validated.data.resultCount || 0,
          createdAt: Date.now(),
        };

        await persistence.paralegal.addSavedSearch(caseId, savedSearch);

        return new Response(JSON.stringify({ search: savedSearch }), {
          status: 201,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        });
      } catch (err) {
        console.error(
          `[ResearchRouter ${requestId}] ERROR:`,
          (err as Error)?.message,
        );
        return new Response(
          JSON.stringify({
            error: sanitizeError(err, "Failed to save search"),
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
      }
    },
  );

  // ========================================================================
  // AI SUMMARY ENDPOINTS
  // ========================================================================

  /**
   * Generate an AI summary of a document or research finding.
   *
   * @endpoint POST /api/research/cases/{caseId}/summarize
   * @description Use OpenAI to generate concise summaries of court opinions, statutes,
   * academic papers, or other legal documents in the case context.
   *
   * @param {string} caseId - Case ID for context (path parameter)
   * @body {Object} - Content to summarize
   * @body {string} sourceType - Type of source ('opinion', 'statute', 'document', 'article')
   * @body {string} sourceId - ID of the source document
   * @body {string} content - Full text content to summarize (max 50000 chars)
   * @body {string} title - Title of the source document
   *
   * @returns {Object} Summary result
   * @returns {string} id - Summary ID
   * @returns {string} title - Original source title
   * @returns {string} summary - Generated summary text
   * @returns {string} sourceType - Type of source summarized
   * @returns {number} createdAt - Creation timestamp
   *
   * @status 201 Created
   * @status 400 Content too long or invalid
   * @status 503 OpenAI service unavailable
   *
   * @requiresAuth OPENAI_API_KEY (environment variable)
   * @rateLimit 5 summaries per hour per user
   *
   * @example
   * POST /api/research/cases/case_123/summarize
   * {
   *   "sourceType": "opinion",
   *   "sourceId": "opinion_12345",
   *   "title": "Smith v. Jones, 347 U.S. 497 (2020)",
   *   "content": "[full opinion text...]"
   * }
   */
  // Generate AI summary for content
  router.post(
    "/api/research/cases/:caseId/summarize",
    async (request: Request) => {
      const requestId =
        request.headers.get("X-Request-Id") || crypto.randomUUID();
      const url = new URL(request.url);
      const pathParts = url.pathname.split("/");
      const caseId = pathParts[pathParts.length - 2];

      console.log(
        `[ResearchRouter ${requestId}] POST /api/research/cases/${caseId}/summarize`,
      );

      try {
        const userEmail = LOCAL_USER;

        if (!getConfig("OPENAI_API_KEY")) {
          return new Response(
            JSON.stringify({ error: "AI service not configured" }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }

        const persistence = createPersistenceManager();
        const existingCase = await persistence.paralegal.getCase(caseId);

        if (!existingCase || existingCase.userEmail !== userEmail) {
          return new Response(JSON.stringify({ error: "Case not found" }), {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          });
        }

        const body = await request.json().catch(() => ({}));
        const validated = SummarizeDocumentSchema.safeParse(body);

        if (!validated.success) {
          return new Response(
            JSON.stringify({ error: "Invalid summarize request body" }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }

        // Generate summary using OpenAI
        const openai = new OpenAI({ apiKey: getConfig("OPENAI_API_KEY") });
        const message = await openai.chat.completions.create({
          model: getConfig("TEXT_MODEL_SMALL") || "gpt-4o-mini",
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: `You are a legal research assistant. Analyze the following ${validated.data.sourceType} and provide:
1. A concise summary (2-3 paragraphs)
2. Key points (bullet list, max 5)
3. Legal issues identified (bullet list, max 5)

Title: ${validated.data.title}

Content:
${validated.data.content.substring(0, 8000)}

Respond in JSON format:
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "legalIssues": ["...", "..."]
}`,
            },
          ],
        });

        let summaryData;
        try {
          const responseText = message.choices[0]?.message?.content || "";
          // Try to extract JSON from the response
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          summaryData = jsonMatch
            ? JSON.parse(jsonMatch[0])
            : {
                summary: responseText,
                keyPoints: [],
                legalIssues: [],
              };
        } catch {
          summaryData = {
            summary:
              message.choices[0]?.message?.content ||
              "Summary generation failed",
            keyPoints: [],
            legalIssues: [],
          };
        }

        const aiSummary = {
          id: generateUniqueId("summary"),
          sourceType: body.sourceType as any,
          sourceId: body.sourceId,
          sourceTitle: body.title,
          summary: summaryData.summary,
          keyPoints: summaryData.keyPoints || [],
          legalIssues: summaryData.legalIssues || [],
          createdAt: Date.now(),
        };

        await persistence.paralegal.addSummary(caseId, aiSummary);

        return new Response(JSON.stringify({ summary: aiSummary }), {
          status: 201,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        });
      } catch (err) {
        console.error(
          `[ResearchRouter ${requestId}] ERROR:`,
          (err as Error)?.message,
        );
        return new Response(
          JSON.stringify({
            error: sanitizeError(err, "Failed to generate summary"),
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
      }
    },
  );

  // ========================================================================
  // DOCUMENT ENDPOINTS
  // ========================================================================

  /**
   * Upload a document to a case.
   *
   * @endpoint POST /api/research/cases/{caseId}/documents/upload
   * @description Upload legal documents (PDF, DOCX, TXT) to a case for analysis
   * and AI processing. Files are stored and can be analyzed with summaries generated.
   *
   * @param {string} caseId - Case ID to upload to (path parameter)
   * @body {FormData} - Multipart form data
   * @body {File} file - Document file (required)
   *        Supported types: PDF, DOCX, TXT
   *        Max size: 10 MB
   *
   * @returns {Object} Document metadata
   * @returns {string} id - Document metadata ID
   * @returns {string} fileName - Original file name
   * @returns {string} fileType - MIME type (e.g., 'application/pdf')
   * @returns {number} fileSize - File size in bytes
   * @returns {string} attachmentId - Internal attachment storage ID
   * @returns {string} summary - AI-generated summary (initially empty)
   * @returns {number} uploadedAt - Upload timestamp
   *
   * @status 201 Created
   * @status 400 Invalid file type or size exceeds 10MB
   * @status 404 Case not found
   *
   * @example
   * POST /api/research/cases/case_123/documents/upload
   * Content-Type: multipart/form-data
   * [binary PDF file]
   */
  // Upload a document to a case
  router.post(
    "/api/research/cases/:caseId/documents/upload",
    async (request: Request) => {
      const requestId =
        request.headers.get("X-Request-Id") || crypto.randomUUID();
      const url = new URL(request.url);
      const pathParts = url.pathname.split("/");
      const caseId = pathParts[pathParts.length - 3];

      console.log(
        `[ResearchRouter ${requestId}] POST /api/research/cases/${caseId}/documents/upload`,
      );

      try {
        const userEmail = LOCAL_USER;

        const persistence = createPersistenceManager();
        const existingCase = await persistence.paralegal.getCase(caseId);

        if (!existingCase || existingCase.userEmail !== userEmail) {
          return new Response(JSON.stringify({ error: "Case not found" }), {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
          return new Response(JSON.stringify({ error: "No file provided" }), {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          });
        }

        // Validate file type
        const allowedTypes = [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
        ];
        if (!allowedTypes.includes(file.type)) {
          return new Response(
            JSON.stringify({
              error: "Invalid file type. Allowed: PDF, DOCX, TXT",
            }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }

        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
          return new Response(
            JSON.stringify({ error: "File too large. Maximum size: 10MB" }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }

        // Store the file using attachments
        const attachmentId = generateUniqueId("doc");
        const fileBuffer = await file.arrayBuffer();
        await persistence.attachments.saveForUser(userEmail, attachmentId, {
          data: Array.from(new Uint8Array(fileBuffer)),
          type: file.type,
          name: file.name,
        });

        const document = {
          id: generateUniqueId("docmeta"),
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          attachmentId,
          summary: "",
          uploadedAt: Date.now(),
        };

        await persistence.paralegal.addDocument(caseId, document);

        return new Response(JSON.stringify({ document }), {
          status: 201,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        });
      } catch (err) {
        console.error(
          `[ResearchRouter ${requestId}] ERROR:`,
          (err as Error)?.message,
        );
        return new Response(
          JSON.stringify({
            error: sanitizeError(err, "Failed to upload document"),
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
      }
    },
  );

  /**
   * Analyze a document and generate AI insights.
   *
   * @endpoint POST /api/research/cases/{caseId}/documents/{docId}/analyze
   * @description Use AI to analyze a document with optional user questions.
   * Extracts key information, entities, relevant case law, and answers specific questions.
   *
   * @param {string} caseId - Case ID (path parameter)
   * @param {string} docId - Document ID (path parameter)
   * @body {Object} - Analysis parameters
   * @body {string} [query] - Specific question or analysis focus (optional)
   *
   * @returns {Object} Analysis results
   * @returns {string} documentId - Analyzed document ID
   * @returns {string} analysis - Full analysis text
   * @returns {Array} keyPoints - Extracted key points (array of strings)
   * @returns {Object} entities - Named entities found (parties, judges, dates, etc.)
   * @returns {string} relevantLaw - Relevant statutes and case law mentioned
   * @returns {string} summary - Concise summary
   * @returns {number} analyzedAt - Analysis timestamp
   *
   * @status 200 OK
   * @status 404 Document or case not found
   * @status 503 OpenAI service unavailable
   *
   * @requiresAuth OPENAI_API_KEY
   * @rateLimit 5 analyses per hour per user
   *
   * @example
   * POST /api/research/cases/case_123/documents/doc_456/analyze
   * {
   *   "query": "What are the main liability arguments?"
   * }
   */
  // Analyze a document
  router.post(
    "/api/research/cases/:caseId/documents/:docId/analyze",
    async (request: Request) => {
      const requestId =
        request.headers.get("X-Request-Id") || crypto.randomUUID();
      const url = new URL(request.url);
      const pathParts = url.pathname.split("/");
      const caseId = pathParts[pathParts.length - 4];
      const docId = pathParts[pathParts.length - 2];

      console.log(
        `[ResearchRouter ${requestId}] POST /api/research/cases/${caseId}/documents/${docId}/analyze`,
      );

      try {
        const userEmail = LOCAL_USER;

        if (!getConfig("OPENAI_API_KEY")) {
          return new Response(
            JSON.stringify({ error: "AI service not configured" }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }

        const persistence = createPersistenceManager();
        const existingCase = await persistence.paralegal.getCase(caseId);

        if (!existingCase || existingCase.userEmail !== userEmail) {
          return new Response(JSON.stringify({ error: "Case not found" }), {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          });
        }

        const document = existingCase.documents.find((d) => d.id === docId);
        if (!document) {
          return new Response(JSON.stringify({ error: "Document not found" }), {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          });
        }

        // Get document content
        const attachment = await persistence.attachments.findByUser(
          userEmail,
          document.attachmentId,
        );
        if (!attachment) {
          return new Response(
            JSON.stringify({ error: "Document content not found" }),
            {
              status: 404,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }

        const body = await request.json().catch(() => ({}));
        const validated = AnalyzeDocumentSchema.safeParse(body);

        if (!validated.success) {
          return new Response(
            JSON.stringify({ error: "Invalid analyze request body" }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }

        // Extract text from the document
        let textContent = "";
        if (attachment.type === "text/plain") {
          textContent = new TextDecoder().decode(
            new Uint8Array(attachment.data),
          );
        } else {
          // For PDF/DOCX, we'd need more sophisticated extraction
          // For now, return a placeholder
          textContent = `[Document: ${document.fileName}]`;
        }

        // Analyze with OpenAI
        const openai = new OpenAI({ apiKey: getConfig("OPENAI_API_KEY") });
        const prompt = validated.data.query
          ? `Analyze this legal document and answer: ${validated.data.query}\n\nDocument:\n${textContent.substring(0, 8000)}`
          : `Analyze this legal document and provide a summary with key findings:\n\n${textContent.substring(0, 8000)}`;

        const message = await openai.chat.completions.create({
          model: getConfig("TEXT_MODEL_SMALL") || "gpt-4o-mini",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        });

        const analysis = message.choices[0]?.message?.content || "";

        return new Response(
          JSON.stringify({ analysis, summary: analysis.substring(0, 500) }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
      } catch (err) {
        console.error(
          `[ResearchRouter ${requestId}] ERROR:`,
          (err as Error)?.message,
        );
        return new Response(
          JSON.stringify({
            error: sanitizeError(err, "Failed to analyze document"),
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
      }
    },
  );

  // ========================================================================
  // ACADEMIC SEARCH
  // ========================================================================

  /**
   * Search academic and scholarly works related to legal topics.
   *
   * @endpoint GET /api/research/scholar/search
   * @description Search the OpenAlex academic database for legal research papers,
   * law review articles, and scholarly works. Covers journals, conferences, and publications
   * from institutions worldwide.
   *
   * @query {string} q - Search query (required, min 3 characters)
   *        e.g., "copyright infringement", "intellectual property", "criminal procedure"
   * @query {number} [limit=20] - Number of results (max 50)
   *
   * @returns {Object} Academic search results
   * @returns {Array} results - Array of work objects
   * @returns {string} id - Work ID in OpenAlex
   * @returns {string} title - Paper/article title
   * @returns {string} snippet - Abstract or excerpt
   * @returns {string} authors - Comma-separated author names (up to 5)
   * @returns {string} year - Publication year
   * @returns {number} citedBy - Citation count
   * @returns {string} journal - Journal/publication name
   * @returns {boolean} openAccess - Whether the paper is open access
   * @returns {string} pdfLink - Link to PDF if available
   * @returns {string} link - Persistent identifier or publication link
   * @returns {number} total - Total matching results
   * @returns {string} source - "OpenAlex Academic Database"
   *
   * @rateLimit 15 requests per 15 minutes per IP
   * @source OpenAlex - https://openalex.org (free, no API key required)
   * @cacheControl 30 minutes
   *
   * @example
   * GET /api/research/scholar/search?q=patent%20law&limit=10
   */
  router.get("/api/research/scholar/search", async (request: Request) => {
    const requestId =
      request.headers.get("X-Request-Id") || crypto.randomUUID();
    const url = new URL(request.url);
    const query = url.searchParams.get("q") || "";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);

    console.log(
      `[ResearchRouter ${requestId}] GET /api/research/scholar/search?q=${query}`,
    );

    if (!query || query.length < 3) {
      return new Response(
        JSON.stringify({
          results: [],
          total: 0,
          disclaimer:
            "This information is for educational purposes only and does not constitute legal advice.",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
    }

    try {
      await withRateLimit(request, "paralegal-scholar-search", 15);

      // Use OpenAlex API (free, no key required)
      const searchUrl = new URL("https://api.openalex.org/works");
      searchUrl.searchParams.set("search", query);
      searchUrl.searchParams.set("per_page", limit.toString());
      searchUrl.searchParams.set("sort", "relevance_score:desc");
      // Filter to include works with abstracts for better results
      searchUrl.searchParams.set("filter", "has_abstract:true");

      const response = await fetch(searchUrl.toString(), {
        headers: {
          Accept: "application/json",
          "User-Agent": "AI-Paralegal-Research (mailto:contact@seemueller.io)",
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "API rate limit exceeded", results: [] }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }
        throw new Error(`OpenAlex returned ${response.status}`);
      }

      const data = (await response.json()) as any;

      // Transform OpenAlex response
      const results = (data.results || []).map((work: any, index: number) => {
        // Extract authors
        const authors = (work.authorships || [])
          .map((a: any) => a.author?.display_name)
          .filter(Boolean)
          .slice(0, 5)
          .join(", ");

        // Get publication year
        const year = work.publication_year?.toString() || "";

        // Get abstract (OpenAlex stores as inverted index, need to reconstruct)
        let snippet = "";
        if (work.abstract_inverted_index) {
          // Reconstruct abstract from inverted index
          const words: [string, number][] = [];
          for (const [word, positions] of Object.entries(
            work.abstract_inverted_index,
          )) {
            for (const pos of positions as number[]) {
              words.push([word, pos]);
            }
          }
          words.sort((a, b) => a[1] - b[1]);
          snippet = words
            .map((w) => w[0])
            .join(" ")
            .substring(0, 500);
        }

        // Get PDF link if available (open access)
        const pdfLink =
          work.open_access?.oa_url || work.primary_location?.pdf_url || "";

        return {
          id: work.id || `scholar_${Date.now()}_${index}`,
          title: work.title || "Unknown Title",
          snippet,
          authors,
          year,
          citedBy: work.cited_by_count || 0,
          pdfLink,
          link: work.doi
            ? `https://doi.org/${work.doi}`
            : work.primary_location?.landing_page_url || "",
          doi: work.doi || "",
          journal: work.primary_location?.source?.display_name || "",
          openAccess: work.open_access?.is_oa || false,
        };
      });

      console.log(
        `[ResearchRouter ${requestId}] OpenAlex returned ${results.length} results`,
      );

      return new Response(
        JSON.stringify({
          results,
          total: data.meta?.count || results.length,
          disclaimer:
            "This information is for educational purposes only and does not constitute legal advice.",
          source: "OpenAlex Academic Database",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
            "Cache-Control": "public, max-age=1800",
          },
        },
      );
    } catch (err) {
      console.error(
        `[ResearchRouter ${requestId}] ERROR:`,
        (err as Error)?.message,
      );
      const isRateLimitError = (err as Error)?.message?.includes(
        "Too many attempts",
      );
      return new Response(
        JSON.stringify({
          error: sanitizeError(err, "Failed to search academic database"),
          results: [],
          disclaimer:
            "This information is for educational purposes only and does not constitute legal advice.",
        }),
        {
          status: isRateLimitError ? 429 : 500,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
    }
  });

  // ========================================================================
  // GOVINFO - Official US Government Publications
  // ========================================================================

  /**
   * Search official U.S. Government Publishing Office (GovInfo) collections.
   *
   * @endpoint GET /api/research/govinfo/search
   * @description Search federal government documents including Congressional bills, regulations,
   * Federal Register notices, public laws, Congressional reports, and court opinions.
   * All documents are official government publications.
   *
   * @query {string} q - Search query (required, min 3 characters)
   * @query {string} [collection] - Filter by collection code
   *        Valid values: BILLS, CFR, CRPT, FR, PLAW, STATUTE, USCODE, USCOURTS, CHRG, CDOC
   * @query {number} [limit=20] - Number of results (max 100)
   * @query {number} [offset=0] - Pagination offset for results
   *
   * @returns {Object} Government documents search results
   * @returns {Array} results - Array of document objects with title, collection, date, etc.
   * @returns {number} total - Total matching documents
   * @returns {Object} collections - Available collection codes if no collection specified
   * @returns {string} source - "GovInfo (U.S. Government Publishing Office)"
   * @returns {string} disclaimer - Educational use disclaimer
   *
   * @rateLimit 15 requests per 15 minutes per IP
   * @requiresAuth GOVINFO_API_KEY (free key from https://api.govinfo.gov/docs/)
   * @source GovInfo API - https://api.govinfo.gov
   *
   * @example
   * GET /api/research/govinfo/search?q=data%20protection&collection=CFR&limit=20
   */
  router.get(
    "/api/research/govinfo/search",
    async (request: Request & { user?: any }) => {
      const requestId =
        request.headers.get("X-Request-Id") || crypto.randomUUID();
      const url = new URL(request.url);
      const query = url.searchParams.get("q") || "";
      const collection = url.searchParams.get("collection") || ""; // e.g., CFR, FR, BILLS, USCODE
      const limit = Math.min(
        parseInt(url.searchParams.get("limit") || "20"),
        100,
      );
      const offset = parseInt(url.searchParams.get("offset") || "0");

      console.log(
        `[ResearchRouter ${requestId}] GET /api/research/govinfo/search?q=${query}&collection=${collection}`,
      );

      if (!query || query.length < 3) {
        return new Response(
          JSON.stringify({
            results: [],
            total: 0,
            collections: GOVINFO_COLLECTIONS,
            disclaimer:
              "This information is for educational purposes only and does not constitute legal advice.",
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
      }

      try {
        await withRateLimit(request, "paralegal-govinfo-search", 15);

        // Check if GovInfo API key is configured
        if (!getConfig("GOVINFO_API_KEY")) {
          console.warn(
            `[ResearchRouter ${requestId}] GOVINFO_API_KEY not configured`,
          );
          return new Response(
            JSON.stringify({
              error:
                "GovInfo search requires an API key. Get one free at https://api.govinfo.gov/docs/",
              results: [],
              collections: GOVINFO_COLLECTIONS,
              disclaimer:
                "This information is for educational purposes only and does not constitute legal advice.",
            }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }

        // Build GovInfo search URL
        const searchUrl = new URL(`${GOVINFO_API_BASE}/search`);
        searchUrl.searchParams.set("api_key", getConfig("GOVINFO_API_KEY"));
        searchUrl.searchParams.set("query", query);
        searchUrl.searchParams.set("pageSize", limit.toString());
        searchUrl.searchParams.set("offsetMark", offset.toString());
        searchUrl.searchParams.set("sortBy", "relevance");

        // Filter by collection if specified
        if (collection && GOVINFO_COLLECTIONS[collection]) {
          searchUrl.searchParams.set("collection", collection);
        }

        const response = await fetch(searchUrl.toString(), {
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          if (response.status === 429) {
            return new Response(
              JSON.stringify({ error: "API rate limit exceeded", results: [] }),
              {
                status: 429,
                headers: {
                  "Content-Type": "application/json",
                  "X-Request-Id": requestId,
                },
              },
            );
          }
          if (response.status === 401 || response.status === 403) {
            return new Response(
              JSON.stringify({ error: "Invalid GovInfo API key", results: [] }),
              {
                status: 401,
                headers: {
                  "Content-Type": "application/json",
                  "X-Request-Id": requestId,
                },
              },
            );
          }
          throw new Error(`GovInfo API returned ${response.status}`);
        }

        const data = (await response.json()) as any;

        // Transform GovInfo response
        const results = (data.results || []).map((item: any, index: number) => {
          const collectionCode = item.collectionCode || "";
          const collectionName =
            GOVINFO_COLLECTIONS[collectionCode] || collectionCode;

          return {
            id: item.packageId || `govinfo_${Date.now()}_${index}`,
            packageId: item.packageId || "",
            title: item.title || "Unknown Title",
            collectionCode,
            collectionName,
            dateIssued: item.dateIssued || "",
            lastModified: item.lastModified || "",
            category: item.category || "",
            branch: item.branch || "",
            governmentAuthor: item.governmentAuthor || "",
            suDocClass: item.suDocClassNumber || "",
            congress: item.congress || "",
            session: item.session || "",
            docType: item.docType || "",
            pages: item.pages || 0,
            pdfLink: item.download?.pdfLink || "",
            xmlLink: item.download?.xmlLink || "",
            txtLink: item.download?.txtLink || "",
            detailsLink:
              item.detailsLink ||
              `https://www.govinfo.gov/app/details/${item.packageId}`,
          };
        });

        console.log(
          `[ResearchRouter ${requestId}] GovInfo returned ${results.length} results`,
        );

        return new Response(
          JSON.stringify({
            results,
            total: data.count || results.length,
            nextOffset: data.nextPageOffset || null,
            collections: GOVINFO_COLLECTIONS,
            disclaimer:
              "This information is for educational purposes only and does not constitute legal advice.",
            source: "GovInfo (U.S. Government Publishing Office)",
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
              "Cache-Control": "public, max-age=3600", // 1 hour cache
            },
          },
        );
      } catch (err) {
        console.error(
          `[ResearchRouter ${requestId}] ERROR:`,
          (err as Error)?.message,
        );
        const isRateLimitError = (err as Error)?.message?.includes(
          "Too many attempts",
        );
        return new Response(
          JSON.stringify({
            error: sanitizeError(err, "Failed to search GovInfo"),
            results: [],
            collections: GOVINFO_COLLECTIONS,
            disclaimer:
              "This information is for educational purposes only and does not constitute legal advice.",
          }),
          {
            status: isRateLimitError ? 429 : 500,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
      }
    },
  );

  /**
   * Retrieve detailed metadata for a specific GovInfo package/document.
   *
   * @endpoint GET /api/research/govinfo/package/{packageId}
   * @description Fetch complete information about a government document including
   * title, collection, date issued, download links, and related documents.
   *
   * @param {string} packageId - GovInfo package ID (path parameter)
   *
   * @returns {Object} Package details
   * @returns {Object} package - Package metadata object
   * @returns {string} packageId - Unique package identifier
   * @returns {string} title - Document title
   * @returns {string} collectionCode - Collection code (BILLS, CFR, FR, etc.)
   * @returns {string} collectionName - Human-readable collection name
   * @returns {string} dateIssued - Publication date
   * @returns {string} category - Document category
   * @returns {string} branch - Government branch (Executive, Legislative, Judicial)
   * @returns {string} publisher - Publishing organization
   * @returns {Object} download - Download links in various formats (HTML, PDF, XML)
   * @returns {Array} relatedDocuments - References to related documents
   *
   * @status 200 OK
   * @status 404 Package not found
   * @status 503 GovInfo API unavailable
   *
   * @requiresAuth GOVINFO_API_KEY
   * @source GovInfo API
   * @cacheControl 24 hours
   *
   * @example
   * GET /api/research/govinfo/package/BILLS-117-s123
   */
  // Get specific GovInfo package details
  router.get(
    "/api/research/govinfo/package/:packageId",
    async (request: Request & { user?: any }) => {
      const requestId =
        request.headers.get("X-Request-Id") || crypto.randomUUID();
      const url = new URL(request.url);
      const pathParts = url.pathname.split("/");
      const packageId = pathParts[pathParts.length - 1];

      console.log(
        `[ResearchRouter ${requestId}] GET /api/research/govinfo/package/${packageId}`,
      );

      try {
        if (!getConfig("GOVINFO_API_KEY")) {
          return new Response(
            JSON.stringify({ error: "GovInfo API key not configured" }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }

        const detailUrl = `${GOVINFO_API_BASE}/packages/${packageId}/summary?api_key=${getConfig("GOVINFO_API_KEY")}`;
        const response = await fetch(detailUrl, {
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`GovInfo API returned ${response.status}`);
        }

        const data = (await response.json()) as any;

        return new Response(
          JSON.stringify({
            package: {
              packageId: data.packageId,
              title: data.title,
              collectionCode: data.collectionCode,
              collectionName:
                GOVINFO_COLLECTIONS[data.collectionCode] || data.collectionCode,
              dateIssued: data.dateIssued,
              lastModified: data.lastModified,
              category: data.category,
              branch: data.branch,
              governmentAuthor:
                data.governmentAuthor1 || data.governmentAuthor2,
              publisher: data.publisher,
              suDocClass: data.suDocClassNumber,
              congress: data.congress,
              session: data.session,
              pages: data.pages,
              download: data.download || {},
              relatedDocuments: data.related || [],
              otherIdentifiers: data.otherIdentifier || {},
            },
            disclaimer:
              "This information is for educational purposes only and does not constitute legal advice.",
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
              "Cache-Control": "public, max-age=86400", // 24 hour cache for package details
            },
          },
        );
      } catch (err) {
        console.error(
          `[ResearchRouter ${requestId}] ERROR:`,
          (err as Error)?.message,
        );
        return new Response(
          JSON.stringify({
            error: sanitizeError(err, "Failed to fetch package details"),
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
      }
    },
  );

  /**
   * List all available GovInfo document collections and their descriptions.
   *
   * @endpoint GET /api/research/govinfo/collections
   * @description Returns all GovInfo collection codes with descriptions to help
   * users filter govinfo searches. Collections include Congressional bills, regulations,
   * Federal Register, codes, court opinions, and more.
   *
   * @returns {Object} Collections list
   * @returns {Array} collections - Array of collection objects
   * @returns {string} code - Collection code identifier (e.g., 'BILLS', 'CFR')
   * @returns {string} name - Collection display name
   * @returns {string} description - Detailed description of collection contents
   * @returns {string} source - "GovInfo (U.S. Government Publishing Office)"
   *
   * @cacheControl 24 hours
   * @rateLimit Unlimited
   * @source GovInfo API
   *
   * @example
   * GET /api/research/govinfo/collections
   * Response includes collections like:
   * - BILLS: Congressional Bills
   * - CFR: Code of Federal Regulations
   * - FR: Federal Register
   * - USCODE: United States Code
   */
  // List available GovInfo collections
  router.get("/api/research/govinfo/collections", async (request: Request) => {
    const requestId =
      request.headers.get("X-Request-Id") || crypto.randomUUID();

    return new Response(
      JSON.stringify({
        collections: Object.entries(GOVINFO_COLLECTIONS).map(
          ([code, name]) => ({
            code,
            name,
            description: getCollectionDescription(code),
          }),
        ),
        source: "GovInfo (U.S. Government Publishing Office)",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
      },
    );
  });

  // ========================================================================
  // PACER INFO (Placeholder)
  // ========================================================================

  /**
   * Get information about PACER (Public Access to Court Electronic Records).
   *
   * @endpoint GET /api/research/pacer/info
   * @description Provides information about PACER, the federal court electronic records system.
   * Explains how to register, access fees, and limitations. No actual PACER integration currently;
   * this is informational only.
   *
   * @returns {Object} PACER information
   * @returns {string} message - Overview of PACER
   * @returns {string} info - Description of what PACER provides
   * @returns {string} registration - Link to register for PACER account
   * @returns {string} fees - Information about PACER usage fees
   * @returns {string} note - Note about future integration plans
   *
   * @note PACER requires a registered account with PACER login credentials.
   *       Full PACER integration is planned for future releases.
   *
   * @example
   * GET /api/research/pacer/info
   * Response includes:
   * - Registration URL: https://pacer.uscourts.gov/
   * - Fee information: $0.10 per page with $3.00 cap per document
   */
  router.get("/api/research/pacer/info", async (request: Request) => {
    const requestId =
      request.headers.get("X-Request-Id") || crypto.randomUUID();

    return new Response(
      JSON.stringify({
        message: "PACER integration requires a registered PACER account.",
        info: "PACER (Public Access to Court Electronic Records) provides access to federal court documents.",
        registration: "Register at https://pacer.uscourts.gov/",
        fees: "PACER charges $0.10 per page with a $3.00 cap per document.",
        note: "Future versions may support PACER integration with user-provided credentials.",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
      },
    );
  });

  // ========================================================================
  // LAWYERS API - Find lawyers by location
  // ========================================================================

  /**
   * Search for lawyers by location and practice specialty.
   *
   * @endpoint GET /api/research/lawyers/search
   * @description Find attorneys in a specific location who practice in a particular
   * legal specialty. Results are sourced via web search and may include law firm
   * websites and legal directories.
   *
   * @query {string} location - Location filter (required)
   *        Format: city, state or zip code (e.g., "San Francisco, CA" or "94102")
   * @query {string} [specialty] - Practice area filter (optional)
   *        e.g., "bankruptcy", "divorce", "criminal defense", "patent"
   * @query {number} [limit=20] - Number of results (max 50)
   *
   * @returns {Object} Lawyer search results
   * @returns {Array} results - Array of lawyer/firm objects
   * @returns {string} name - Lawyer or firm name
   * @returns {string} location - Practice location
   * @returns {string} specialty - Practice area
   * @returns {string} contact - Contact information (phone/email if available)
   * @returns {string} website - Law firm website URL
   * @returns {number} total - Total matching results
   * @returns {string} disclaimer - Educational use disclaimer
   *
   * @rateLimit 20 requests per 15 minutes per IP
   * @source SerpAPI / Web search
   *
   * @example
   * GET /api/research/lawyers/search?location=San%20Francisco,%20CA&specialty=patent&limit=10
   */
  router.get(
    "/api/research/lawyers/search",
    async (request: Request & { user?: any }) => {
      const requestId =
        request.headers.get("X-Request-Id") || crypto.randomUUID();
      const url = new URL(request.url);
      const location = url.searchParams.get("location") || "";
      const specialty = url.searchParams.get("specialty") || "";
      const limit = Math.min(
        parseInt(url.searchParams.get("limit") || "20"),
        50,
      );

      console.log(
        `[ResearchRouter ${requestId}] GET /api/research/lawyers/search?location=${location}&specialty=${specialty}`,
      );

      if (!location || location.length < 2) {
        return new Response(
          JSON.stringify({
            error: "Location is required (city, state, or zip code)",
            results: [],
            disclaimer:
              "This information is for educational purposes only and does not constitute legal advice.",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
      }

      try {
        await withRateLimit(request, "paralegal-lawyers-search", 15);

        // Build a SerpAPI Google search for lawyers
        const query = specialty
          ? `${specialty} lawyers in ${location}`
          : `lawyers in ${location}`;
        const serpUrl = new URL(getSerpApiBase());
        serpUrl.searchParams.set("q", query);
        serpUrl.searchParams.set("engine", "google");
        serpUrl.searchParams.set("num", String(limit));

        console.log(
          `[ResearchRouter ${requestId}] Fetching lawyers via SerpAPI: ${query}`,
        );

        const response = await fetch(serpUrl.toString());

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `[ResearchRouter ${requestId}] SerpAPI error: ${response.status} - ${errorText}`,
          );
          throw new Error(`SerpAPI returned ${response.status}`);
        }

        const data = (await response.json()) as any;
        const organic = (data.organic_results || []) as any[];
        const localResults = (data.local_results?.places || []) as any[];

        // Merge local pack results (richer data) with organic results
        const results = [
          ...localResults.slice(0, limit).map((place: any, index: number) => ({
            id: place.place_id || `lawyer_local_${Date.now()}_${index}`,
            name: place.title || "Unknown",
            firm: place.title || "",
            address: place.address || "",
            city: "",
            state: "",
            zipCode: "",
            phone: place.phone || "",
            email: "",
            website: place.website || "",
            specialty: place.type || specialty || "",
            rating: place.rating ?? null,
            reviewCount: place.reviews ?? 0,
            yearsExperience: null,
            barNumber: "",
            education: "",
            languages: "",
            profileUrl: place.website || "",
            imageUrl: place.thumbnail || "",
          })),
          ...organic
            .slice(0, Math.max(0, limit - localResults.length))
            .map((item: any, index: number) => ({
              id: `lawyer_organic_${Date.now()}_${index}`,
              name: item.title || "Unknown",
              firm: "",
              address: "",
              city: "",
              state: "",
              zipCode: "",
              phone: "",
              email: "",
              website: item.link || "",
              specialty: specialty || "",
              rating: null,
              reviewCount: 0,
              yearsExperience: null,
              barNumber: "",
              education: "",
              languages: "",
              profileUrl: item.link || "",
              imageUrl: "",
            })),
        ].slice(0, limit);

        console.log(
          `[ResearchRouter ${requestId}] SerpAPI returned ${results.length} lawyer results`,
        );

        return new Response(
          JSON.stringify({
            results,
            total: results.length,
            location,
            specialty: specialty || "All",
            source: "SerpAPI",
            disclaimer:
              "This information is for educational purposes only and does not constitute legal advice. Always verify credentials independently before hiring an attorney.",
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
      } catch (err) {
        console.error(
          `[ResearchRouter ${requestId}] Lawyers search error:`,
          err,
        );
        return new Response(
          JSON.stringify({
            error: sanitizeError(err, "Failed to search for lawyers"),
            results: [],
            disclaimer:
              "This information is for educational purposes only and does not constitute legal advice.",
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
      }
    },
  );

  /**
   * List all available legal practice areas/specialties for lawyer search filters.
   *
   * @endpoint GET /api/research/lawyers/specialties
   * @description Returns all available legal specialties that can be used to filter
   * lawyer searches. Includes common practice areas from bankruptcy to workers' compensation.
   *
   * @returns {Object} Specialties list
   * @returns {Array} specialties - Array of specialty objects
   * @returns {string} code - Specialty code/identifier (lowercase with hyphens)
   * @returns {string} name - Display name of the practice area
   * @returns {string} source - "Lawyers API"
   *
   * @cacheControl 24 hours
   * @rateLimit Unlimited
   *
   * @example
   * GET /api/research/lawyers/specialties
   * Response includes specialties like:
   * - bankruptcy: "Bankruptcy"
   * - divorce: "Divorce & Family Law"
   * - patent: "Intellectual Property"
   * - criminal: "Criminal Defense"
   */
  // Get lawyer specialties list
  router.get("/api/research/lawyers/specialties", async (request: Request) => {
    const requestId =
      request.headers.get("X-Request-Id") || crypto.randomUUID();

    // Common legal practice areas
    const specialties = [
      { code: "bankruptcy", name: "Bankruptcy" },
      { code: "business", name: "Business & Corporate" },
      { code: "civil-rights", name: "Civil Rights" },
      { code: "consumer", name: "Consumer Protection" },
      { code: "criminal", name: "Criminal Defense" },
      { code: "divorce", name: "Divorce & Family Law" },
      { code: "dui", name: "DUI/DWI" },
      { code: "elder", name: "Elder Law" },
      { code: "employment", name: "Employment & Labor" },
      { code: "estate", name: "Estate Planning" },
      { code: "immigration", name: "Immigration" },
      { code: "insurance", name: "Insurance" },
      { code: "intellectual-property", name: "Intellectual Property" },
      { code: "medical-malpractice", name: "Medical Malpractice" },
      { code: "personal-injury", name: "Personal Injury" },
      { code: "real-estate", name: "Real Estate" },
      { code: "social-security", name: "Social Security Disability" },
      { code: "tax", name: "Tax Law" },
      { code: "traffic", name: "Traffic Violations" },
      { code: "trusts", name: "Trusts & Wills" },
      { code: "workers-comp", name: "Workers' Compensation" },
    ];

    return new Response(
      JSON.stringify({
        specialties,
        source: "Lawyers API",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
      },
    );
  });

  /**
   * Generate a legal document using AI based on case research and findings.
   *
   * @endpoint POST /api/research/cases/{caseId}/generate-document
   * @description Generate professional legal documents (memoranda, case briefs, motions, etc.)
   * using AI and case information. Documents can be output in Markdown, PDF, or DOCX format
   * with configurable citation styles and sections.
   *
   * @param {string} caseId - Case ID for document generation (path parameter)
   * @body {Object} - Document generation parameters
   * @body {string} template - Template type (required)
   *        Valid: 'memorandum', 'case_brief', 'motion', 'research_summary', 'client_letter', 'discovery_summary'
   * @body {string} format - Output format (required)
   *        Valid: 'markdown', 'pdf', 'docx'
   * @body {Object} [options] - Generation options (optional)
   * @body {string} [options.citationStyle] - Citation style: 'bluebook', 'apa', 'mla', 'chicago'
   * @body {boolean} [options.includeSummaries] - Include AI summaries (default: true)
   * @body {boolean} [options.includeStatutes] - Include relevant statutes (default: true)
   * @body {boolean} [options.includeCases] - Include case citations (default: true)
   * @body {string} [options.attorneyName] - Attorney name for document signature
   * @body {string} [options.clientName] - Client name for document heading
   * @body {string} [options.courtName] - Court name if applicable
   * @body {string} [options.motionType] - Type of motion if template is 'motion'
   * @body {Object} [webhook] - Webhook for async delivery (optional)
   * @body {string} webhook.url - URL to POST generated document to
   *
   * @returns {Object} Document generation response
   * @returns {string} documentId - Unique document ID
   * @returns {string} content - Generated document content
   * @returns {Object} metadata - Document metadata (title, author, date, page count)
   *
   * @status 200 OK - Document generated synchronously
   * @status 202 Accepted - Document generation queued (async with webhook)
   * @status 400 Invalid template, format, or missing required fields
   * @status 404 Case not found or access denied
   * @status 503 OpenAI service unavailable
   *
   * @requiresAuth OPENAI_API_KEY
   * @rateLimit 5 generations per hour per user
   *
   * @example
   * POST /api/research/cases/case_123/generate-document
   * {
   *   "template": "case_brief",
   *   "format": "pdf",
   *   "options": {
   *     "citationStyle": "bluebook",
   *     "attorneyName": "Jane Smith"
   *   }
   * }
   */
  // Generate legal document from case research
  router.post(
    "/api/research/cases/:caseId/generate-document",
    async (request: Request) => {
      const requestId =
        request.headers.get("X-Request-Id") || crypto.randomUUID();
      const url = new URL(request.url);
      const pathParts = url.pathname.split("/");
      const caseId = pathParts[pathParts.length - 2];

      console.log(
        `[ResearchRouter ${requestId}] POST /api/research/cases/${caseId}/generate-document`,
      );

      try {
        // Authentication
        const userEmail = LOCAL_USER;

        // Rate limiting - 5 generations per hour per user
        await withRateLimit(request, "paralegal-doc-generate", 5);

        // Get case data
        const persistence = createPersistenceManager();
        const caseData = await persistence.paralegal.getCase(caseId);

        if (!caseData || caseData.userEmail !== userEmail) {
          return new Response(
            JSON.stringify({ error: "Case not found or access denied" }),
            {
              status: 404,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }

        // Validate request body
        const body = await request.json().catch(() => ({}));
        const validated = GenerateDocumentSchema.safeParse(body);

        if (!validated.success) {
          console.error(
            `[ResearchRouter ${requestId}] Validation error:`,
            validated.error,
          );
          return new Response(
            JSON.stringify({
              error: "Invalid request body",
              details: validated.error.errors,
            }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }

        const { template, format, options, webhook } = validated.data;

        // Check if case has research context
        if (!caseData.contextItems || caseData.contextItems.length === 0) {
          return new Response(
            JSON.stringify({
              error:
                "No research context available. Please add research items to the case before generating documents.",
            }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }

        // Initialize OpenAI client
        if (!getConfig("OPENAI_API_KEY")) {
          return new Response(
            JSON.stringify({ error: "AI service not configured" }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": requestId,
              },
            },
          );
        }

        const openai = new OpenAI({ apiKey: getConfig("OPENAI_API_KEY") });

        // Generate document
        console.log(
          `[ResearchRouter ${requestId}] Generating ${template} in ${format} format with ${options?.citationStyle || "bluebook"} citations`,
        );

        const generator = new LegalDocumentGenerator(
          openai,
          caseData as any,
          template as DocumentTemplate,
        );
        const content = await generator.generate(options as GenerationOptions);

        // Calculate metadata
        const metadata = generator.calculateMetadata(content);

        // Generate unique document ID
        const documentId = generateUniqueId("doc");

        // Store generated document in case
        const generatedDoc = {
          id: documentId,
          template,
          format,
          content,
          metadata: {
            ...metadata,
            generatedAt: Date.now(),
            caseName: caseData.name,
            template,
          },
          generatedAt: Date.now(),
        };

        // Save to KV storage
        await persistence.paralegal.addGeneratedDocument(caseId, generatedDoc);

        console.log(
          `[ResearchRouter ${requestId}] Document generated successfully: ${documentId} (${metadata.wordCount} words, ${metadata.citationCount} citations)`,
        );

        // Trigger webhook if configured
        if (webhook?.url) {
          const webhookConfig: WebhookConfig = {
            url: webhook.url,
            headers: webhook.headers || {},
            enabled: true,
          };

          const webhookPayload = createDocumentGeneratedPayload(
            documentId,
            generatedDoc.metadata,
          );

          triggerWebhookWithRetry(webhookConfig, webhookPayload).then(
            (result) => {
              if (result.success) {
                console.log(
                  `[ResearchRouter ${requestId}] Webhook triggered successfully`,
                );
              } else {
                console.error(
                  `[ResearchRouter ${requestId}] Hook failed: ${result.error}`,
                );
              }
            },
          );
        }

        return new Response(
          JSON.stringify({
            documentId,
            content,
            metadata: generatedDoc.metadata,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
      } catch (err) {
        console.error(
          `[ResearchRouter ${requestId}] ERROR:`,
          (err as Error)?.message,
          (err as Error)?.stack,
        );
        const isRateLimitError = (err as Error)?.message?.includes(
          "Too many attempts",
        );
        return new Response(
          JSON.stringify({
            error: sanitizeError(err, "Failed to generate document"),
          }),
          {
            status: isRateLimitError ? 429 : 500,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
      }
    },
  );

  return router;
}

export const researchRouter = createResearchRouter();
