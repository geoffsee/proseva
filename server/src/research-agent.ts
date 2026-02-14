import OpenAI from "openai";
import { getConfig } from "./config";

// --- Shared constants & helpers (same as research.ts) ---

const COURTLISTENER_API_BASE = "https://www.courtlistener.com/api/rest/v4";
const GOVINFO_API_BASE = "https://api.govinfo.gov";

function getCourtListenerHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getConfig("COURTLISTENER_API_TOKEN");
  if (token) headers["Authorization"] = `Token ${token}`;
  return headers;
}

function getSerpApiBase(): string {
  return getConfig("SERPAPI_BASE") || "https://serpapi.com/search.json";
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

const COURT_NAMES: Record<string, string> = {
  scotus: "Supreme Court of the United States",
  ca1: "First Circuit",
  ca2: "Second Circuit",
  ca3: "Third Circuit",
  ca4: "Fourth Circuit",
  ca5: "Fifth Circuit",
  ca6: "Sixth Circuit",
  ca7: "Seventh Circuit",
  ca8: "Eighth Circuit",
  ca9: "Ninth Circuit",
  ca10: "Tenth Circuit",
  ca11: "Eleventh Circuit",
  cadc: "D.C. Circuit",
  cafc: "Federal Circuit",
};

function resolveCourtName(code: string | undefined): string {
  return (code ? COURT_NAMES[code] : undefined) || code || "";
}

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

// --- API response interfaces ---

interface CourtListenerResult {
  id?: number;
  cluster_id?: number;
  caseName?: string;
  case_name?: string;
  citation?: string;
  neutral_cite?: string;
  lexis_cite?: string;
  west_cite?: string;
  court?: string;
  dateFiled?: string;
  date_filed?: string;
  docketNumber?: string;
  docket_number?: string;
  snippet?: string;
  absolute_url?: string;
  docket_id?: number;
  cause?: string;
}

interface CourtListenerResponse {
  results?: CourtListenerResult[];
  count?: number;
}

interface LegiscanBill {
  bill_id?: number;
  title?: string;
  bill_number?: string;
  state?: string;
  url?: string;
  last_action?: string;
  last_action_date?: string;
  relevance?: number;
}

interface LegiscanResponse {
  status?: string;
  alert?: { message?: string };
  searchresult?: Record<string, LegiscanBill | { count?: number }>;
}

interface GovInfoItem {
  packageId?: string;
  title?: string;
  collectionCode?: string;
  dateIssued?: string;
  category?: string;
  detailsLink?: string;
}

interface GovInfoResponse {
  results?: GovInfoItem[];
  count?: number;
}

interface OpenAlexAuthorship {
  author?: { display_name?: string };
}

interface OpenAlexWork {
  id?: string;
  title?: string;
  abstract_inverted_index?: Record<string, number[]>;
  authorships?: OpenAlexAuthorship[];
  publication_year?: number;
  cited_by_count?: number;
  doi?: string;
  primary_location?: {
    landing_page_url?: string;
    source?: { display_name?: string };
  };
  open_access?: { is_oa?: boolean };
}

interface OpenAlexResponse {
  results?: OpenAlexWork[];
  meta?: { count?: number };
}

interface SerpLocalPlace {
  place_id?: string;
  title?: string;
  address?: string;
  phone?: string;
  website?: string;
  type?: string;
  rating?: number;
  reviews?: number;
}

interface SerpOrganicResult {
  title?: string;
  link?: string;
}

interface SerpResponse {
  local_results?: { places?: SerpLocalPlace[] };
  organic_results?: SerpOrganicResult[];
}

interface StatuteResult {
  id: string;
  title: string;
  citation: string;
  jurisdiction: string;
  url: string;
  lastAction: string;
  lastActionDate: string;
  relevance: number;
}

// --- Tool definitions for OpenAI function calling ---

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_opinions",
      description:
        "Search court opinions from CourtListener. Returns case names, citations, courts, dates, and snippets.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for court opinions",
          },
          court: {
            type: "string",
            description: "Court code filter (e.g., 'scotus', 'ca4', 'cadc')",
          },
          date_after: {
            type: "string",
            description: "Filter opinions after this date (YYYY-MM-DD)",
          },
          date_before: {
            type: "string",
            description: "Filter opinions before this date (YYYY-MM-DD)",
          },
          limit: {
            type: "number",
            description: "Number of results (default 10, max 20)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_dockets",
      description:
        "Search federal court dockets from the RECAP Archive. Returns case names, docket numbers, courts, and filing details.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query for dockets" },
          court: { type: "string", description: "Court code filter" },
          limit: {
            type: "number",
            description: "Number of results (default 10, max 20)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_citation",
      description:
        "Look up a specific legal citation (e.g., '410 U.S. 113', '347 U.S. 483'). Returns matching court opinions.",
      parameters: {
        type: "object",
        properties: {
          citation: {
            type: "string",
            description: "Legal citation to look up (e.g., '410 U.S. 113')",
          },
        },
        required: ["citation"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_statutes",
      description:
        "Search bills and statutes from all 50 states and US Congress via LegiScan. Returns bill titles, numbers, status, and jurisdictions.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for statutes/bills",
          },
          state: {
            type: "string",
            description:
              "State code (e.g., 'CA', 'NY', 'VA', 'US' for federal)",
          },
          year: { type: "string", description: "Legislative year" },
          limit: {
            type: "number",
            description: "Number of results (default 10, max 20)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_govinfo",
      description:
        "Search official US government documents from GovInfo (CFR, Federal Register, US Code, Congressional Bills, etc).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          collection: {
            type: "string",
            description:
              "Collection filter: BILLS, CFR, FR, USCODE, PLAW, STATUTE, USCOURTS, CHRG, CDOC, CRPT",
          },
          limit: {
            type: "number",
            description: "Number of results (default 10, max 20)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_academic",
      description:
        "Search academic and scholarly papers via OpenAlex. Returns titles, authors, abstracts, citation counts, and DOI links.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for academic papers",
          },
          limit: {
            type: "number",
            description: "Number of results (default 10, max 20)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_lawyers",
      description:
        "Search for lawyers by location and optional specialty via web search.",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "Location (city, state or zip code)",
          },
          specialty: {
            type: "string",
            description:
              "Practice area (e.g., 'bankruptcy', 'patent', 'criminal defense')",
          },
          limit: {
            type: "number",
            description: "Number of results (default 10, max 20)",
          },
        },
        required: ["location"],
      },
    },
  },
];

// --- Tool execution functions ---

async function searchOpinions(params: {
  query: string;
  court?: string;
  date_after?: string;
  date_before?: string;
  limit?: number;
}) {
  if (!getConfig("COURTLISTENER_API_TOKEN")) {
    return { error: "CourtListener API token not configured", results: [] };
  }

  const limit = Math.min(params.limit || 10, 20);
  const searchUrl = new URL(`${COURTLISTENER_API_BASE}/search/`);
  searchUrl.searchParams.set("q", params.query);
  searchUrl.searchParams.set("type", "o");
  searchUrl.searchParams.set("order_by", "score desc");
  searchUrl.searchParams.set("page_size", limit.toString());
  if (params.court) searchUrl.searchParams.set("court", params.court);
  if (params.date_after)
    searchUrl.searchParams.set("filed_after", params.date_after);
  if (params.date_before)
    searchUrl.searchParams.set("filed_before", params.date_before);

  const response = await fetch(searchUrl.toString(), {
    headers: getCourtListenerHeaders(),
  });
  if (!response.ok)
    throw new Error(`CourtListener API returned ${response.status}`);

  const data = (await response.json()) as CourtListenerResponse;
  const results = (data.results || []).map((op: CourtListenerResult) => ({
    id: op.id?.toString() || op.cluster_id?.toString() || "",
    caseName: op.caseName || op.case_name || "Unknown Case",
    citation:
      op.citation ||
      [op.neutral_cite, op.lexis_cite, op.west_cite]
        .filter(Boolean)
        .join(", ") ||
      "",
    court: resolveCourtName(op.court),
    dateFiled: formatDate(op.dateFiled || op.date_filed),
    docketNumber: op.docketNumber || op.docket_number || "",
    snippet: op.snippet || "",
    absoluteUrl: op.absolute_url
      ? `https://www.courtlistener.com${op.absolute_url}`
      : "",
  }));

  return {
    results,
    total: data.count || results.length,
    source: "CourtListener",
  };
}

async function searchDockets(params: {
  query: string;
  court?: string;
  limit?: number;
}) {
  if (!getConfig("COURTLISTENER_API_TOKEN")) {
    return { error: "CourtListener API token not configured", results: [] };
  }

  const limit = Math.min(params.limit || 10, 20);
  const searchUrl = new URL(`${COURTLISTENER_API_BASE}/search/`);
  searchUrl.searchParams.set("q", params.query);
  searchUrl.searchParams.set("type", "r");
  searchUrl.searchParams.set("order_by", "score desc");
  searchUrl.searchParams.set("page_size", limit.toString());
  if (params.court) searchUrl.searchParams.set("court", params.court);

  const response = await fetch(searchUrl.toString(), {
    headers: getCourtListenerHeaders(),
  });
  if (!response.ok)
    throw new Error(`CourtListener API returned ${response.status}`);

  const data = (await response.json()) as CourtListenerResponse;
  const results = (data.results || []).map((d: CourtListenerResult) => ({
    id: d.docket_id?.toString() || d.id?.toString() || "",
    caseName: d.caseName || d.case_name || "Unknown Case",
    court: resolveCourtName(d.court),
    dateFiled: formatDate(d.dateFiled || d.date_filed),
    docketNumber: d.docketNumber || d.docket_number || "",
    cause: d.cause || "",
    snippet: d.snippet || "",
    absoluteUrl: d.absolute_url
      ? `https://www.courtlistener.com${d.absolute_url}`
      : "",
  }));

  return {
    results,
    total: data.count || results.length,
    source: "CourtListener RECAP",
  };
}

async function lookupCitation(params: { citation: string }) {
  if (!getConfig("COURTLISTENER_API_TOKEN")) {
    return { error: "CourtListener API token not configured", results: [] };
  }

  const searchUrl = new URL(`${COURTLISTENER_API_BASE}/search/`);
  searchUrl.searchParams.set("q", `citation:("${params.citation}")`);
  searchUrl.searchParams.set("type", "o");
  searchUrl.searchParams.set("page_size", "10");

  const response = await fetch(searchUrl.toString(), {
    headers: getCourtListenerHeaders(),
  });
  if (!response.ok)
    throw new Error(`CourtListener API returned ${response.status}`);

  const data = (await response.json()) as CourtListenerResponse;
  const results = (data.results || []).map((op: CourtListenerResult) => ({
    id: op.id?.toString() || "",
    caseName: op.caseName || op.case_name || "Unknown Case",
    citation: op.citation || params.citation,
    court: resolveCourtName(op.court),
    dateFiled: formatDate(op.dateFiled || op.date_filed),
    absoluteUrl: op.absolute_url
      ? `https://www.courtlistener.com${op.absolute_url}`
      : "",
  }));

  return {
    results,
    searchedCitation: params.citation,
    source: "CourtListener",
  };
}

async function searchStatutes(params: {
  query: string;
  state?: string;
  year?: string;
  limit?: number;
}) {
  if (!getConfig("LEGISCAN_API_KEY")) {
    return { error: "LegiScan API key not configured", results: [] };
  }

  const limit = Math.min(params.limit || 10, 20);
  const searchUrl = new URL("https://api.legiscan.com/");
  searchUrl.searchParams.set("key", getConfig("LEGISCAN_API_KEY")!);
  searchUrl.searchParams.set("op", "search");
  searchUrl.searchParams.set("query", params.query);
  searchUrl.searchParams.set("page_size", limit.toString());
  if (params.state && params.state !== "ALL") {
    searchUrl.searchParams.set("state", params.state);
  }
  if (params.year && params.year !== "ALL") {
    searchUrl.searchParams.set("year", params.year);
  }

  const response = await fetch(searchUrl.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`LegiScan API returned ${response.status}`);

  const data = (await response.json()) as LegiscanResponse;
  if (data.status === "ERROR")
    throw new Error(data.alert?.message || "LegiScan API error");

  const searchResults = data.searchresult || {};
  const results: StatuteResult[] = [];
  for (const key of Object.keys(searchResults)) {
    if (key === "summary") continue;
    const bill = searchResults[key] as LegiscanBill;
    if (!bill || typeof bill !== "object") continue;
    results.push({
      id: bill.bill_id?.toString() || `bill-${key}`,
      title: bill.title || "Untitled",
      citation: bill.bill_number || "",
      jurisdiction: bill.state || "US",
      url: bill.url || "",
      lastAction: bill.last_action || "",
      lastActionDate: bill.last_action_date || "",
      relevance: bill.relevance || 0,
    });
    if (results.length >= limit) break;
  }

  const summary = (searchResults.summary || {}) as { count?: number };
  return {
    results,
    total: typeof summary.count === "number" ? summary.count : results.length,
    source: "LegiScan",
  };
}

async function searchGovinfo(params: {
  query: string;
  collection?: string;
  limit?: number;
}) {
  if (!getConfig("GOVINFO_API_KEY")) {
    return { error: "GovInfo API key not configured", results: [] };
  }

  const limit = Math.min(params.limit || 10, 20);
  const searchUrl = new URL(`${GOVINFO_API_BASE}/search`);
  searchUrl.searchParams.set("api_key", getConfig("GOVINFO_API_KEY")!);
  searchUrl.searchParams.set("query", params.query);
  searchUrl.searchParams.set("pageSize", limit.toString());
  searchUrl.searchParams.set("sortBy", "relevance");
  if (params.collection && GOVINFO_COLLECTIONS[params.collection]) {
    searchUrl.searchParams.set("collection", params.collection);
  }

  const response = await fetch(searchUrl.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`GovInfo API returned ${response.status}`);

  const data = (await response.json()) as GovInfoResponse;
  const results = (data.results || []).map((item: GovInfoItem, i: number) => ({
    id: item.packageId || `govinfo_${i}`,
    title: item.title || "Unknown Title",
    collectionCode: item.collectionCode || "",
    collectionName:
      GOVINFO_COLLECTIONS[item.collectionCode || ""] ||
      item.collectionCode ||
      "",
    dateIssued: item.dateIssued || "",
    category: item.category || "",
    detailsLink:
      item.detailsLink ||
      `https://www.govinfo.gov/app/details/${item.packageId}`,
  }));

  return { results, total: data.count || results.length, source: "GovInfo" };
}

async function searchAcademic(params: { query: string; limit?: number }) {
  const limit = Math.min(params.limit || 10, 20);
  const searchUrl = new URL("https://api.openalex.org/works");
  searchUrl.searchParams.set("search", params.query);
  searchUrl.searchParams.set("per_page", limit.toString());
  searchUrl.searchParams.set("sort", "relevance_score:desc");
  searchUrl.searchParams.set("filter", "has_abstract:true");

  const response = await fetch(searchUrl.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "AI-Paralegal-Research (mailto:contact@seemueller.io)",
    },
  });
  if (!response.ok) throw new Error(`OpenAlex API returned ${response.status}`);

  const data = (await response.json()) as OpenAlexResponse;
  const results = (data.results || []).map((work: OpenAlexWork, i: number) => {
    const authors = (work.authorships || [])
      .map((a: OpenAlexAuthorship) => a.author?.display_name)
      .filter(Boolean)
      .slice(0, 5)
      .join(", ");

    let snippet = "";
    if (work.abstract_inverted_index) {
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
        .substring(0, 400);
    }

    return {
      id: work.id || `scholar_${i}`,
      title: work.title || "Unknown Title",
      snippet,
      authors,
      year: work.publication_year?.toString() || "",
      citedBy: work.cited_by_count || 0,
      link: work.doi
        ? `https://doi.org/${work.doi}`
        : work.primary_location?.landing_page_url || "",
      journal: work.primary_location?.source?.display_name || "",
      openAccess: work.open_access?.is_oa || false,
    };
  });

  return {
    results,
    total: data.meta?.count || results.length,
    source: "OpenAlex",
  };
}

async function searchLawyers(params: {
  location: string;
  specialty?: string;
  limit?: number;
}) {
  const limit = Math.min(params.limit || 10, 20);
  const query = params.specialty
    ? `${params.specialty} lawyers in ${params.location}`
    : `lawyers in ${params.location}`;

  const serpUrl = new URL(getSerpApiBase());
  serpUrl.searchParams.set("q", query);
  serpUrl.searchParams.set("engine", "google");
  serpUrl.searchParams.set("num", String(limit));

  const response = await fetch(serpUrl.toString());
  if (!response.ok) throw new Error(`SerpAPI returned ${response.status}`);

  const data = (await response.json()) as SerpResponse;
  const localResults = (data.local_results?.places || []) as SerpLocalPlace[];
  const organic = (data.organic_results || []) as SerpOrganicResult[];

  const results = [
    ...localResults.slice(0, limit).map((place: SerpLocalPlace, i: number) => ({
      id: place.place_id || `lawyer_local_${i}`,
      name: place.title || "Unknown",
      address: place.address || "",
      phone: place.phone || "",
      website: place.website || "",
      specialty: place.type || params.specialty || "",
      rating: place.rating ?? null,
      reviewCount: place.reviews ?? 0,
    })),
    ...organic
      .slice(0, Math.max(0, limit - localResults.length))
      .map((item: SerpOrganicResult, i: number) => ({
        id: `lawyer_organic_${i}`,
        name: item.title || "Unknown",
        address: "",
        phone: "",
        website: item.link || "",
        specialty: params.specialty || "",
        rating: null,
        reviewCount: 0,
      })),
  ].slice(0, limit);

  return {
    results,
    total: results.length,
    location: params.location,
    specialty: params.specialty || "All",
    source: "SerpAPI",
  };
}

// --- Tool dispatch ---

async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "search_opinions":
      return searchOpinions(
        args as unknown as Parameters<typeof searchOpinions>[0],
      );
    case "search_dockets":
      return searchDockets(
        args as unknown as Parameters<typeof searchDockets>[0],
      );
    case "lookup_citation":
      return lookupCitation(
        args as unknown as Parameters<typeof lookupCitation>[0],
      );
    case "search_statutes":
      return searchStatutes(
        args as unknown as Parameters<typeof searchStatutes>[0],
      );
    case "search_govinfo":
      return searchGovinfo(
        args as unknown as Parameters<typeof searchGovinfo>[0],
      );
    case "search_academic":
      return searchAcademic(
        args as unknown as Parameters<typeof searchAcademic>[0],
      );
    case "search_lawyers":
      return searchLawyers(
        args as unknown as Parameters<typeof searchLawyers>[0],
      );
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// --- Main agent chat handler ---

export interface ResearchChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ResearchChatResponse {
  reply: string;
  toolResults: Array<{ toolName: string; results: unknown }>;
}

export async function handleResearchChat(
  messages: ResearchChatMessage[],
): Promise<ResearchChatResponse> {
  const apiKey = getConfig("OPENAI_API_KEY");
  if (!apiKey) {
    return {
      reply:
        "OpenAI API key is not configured. Please add it in Settings to use the research agent.",
      toolResults: [],
    };
  }

  const endpoint = getConfig("OPENAI_ENDPOINT");
  const client = new OpenAI({
    apiKey,
    ...(endpoint ? { baseURL: endpoint } : {}),
  });

  const model = getConfig("TEXT_MODEL_SMALL") || "gpt-4o-mini";

  const systemMessage: OpenAI.Chat.Completions.ChatCompletionSystemMessageParam =
    {
      role: "system",
      content: `You are a legal research assistant specializing in U.S. law. You help users find court opinions, statutes, regulations, academic papers, government documents, and lawyers.

When a user asks a research question, use the available tools to search for relevant information. You can call multiple tools in sequence to provide comprehensive answers.

Guidelines:
- Always search before answering legal questions — do not rely on your training data alone for specific cases or statutes.
- Cite sources with case names, citations, and links when available.
- Summarize results clearly and highlight the most relevant findings.
- If a search returns no results, suggest alternative search terms or approaches.
- Always include a disclaimer that this is for educational purposes and does not constitute legal advice.
- When searching for court opinions, try specific legal terms and key phrases.
- For statute searches, specify the state when the user mentions a jurisdiction.
- Be proactive: if the user asks about a topic, search both opinions and statutes when relevant.`,
    };

  const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    systemMessage,
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const toolResults: Array<{ toolName: string; results: unknown }> = [];
  let iterations = 0;
  const maxIterations = 5;

  while (iterations < maxIterations) {
    iterations++;

    const response = await client.chat.completions.create({
      model,
      messages: chatMessages,
      tools,
    });

    const choice = response.choices[0];

    if (choice.message.tool_calls?.length) {
      chatMessages.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        if (toolCall.type !== "function") continue;
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(toolCall.function.arguments) as Record<
            string,
            unknown
          >;
        } catch {
          args = {};
        }

        let result: unknown;
        try {
          result = await executeTool(toolCall.function.name, args);
          toolResults.push({
            toolName: toolCall.function.name,
            results: result,
          });
        } catch (err) {
          result = { error: (err as Error).message };
          toolResults.push({
            toolName: toolCall.function.name,
            results: result,
          });
        }

        chatMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    } else {
      return {
        reply: choice.message.content || "I couldn't generate a response.",
        toolResults,
      };
    }
  }

  // If we exhausted iterations, get the final message content
  const lastAssistant = chatMessages
    .filter((m) => m.role === "assistant")
    .pop();
  const fallbackReply =
    (lastAssistant &&
    "content" in lastAssistant &&
    typeof lastAssistant.content === "string"
      ? lastAssistant.content
      : null) ||
    "I completed several research steps. Please review the results in the sidebar.";

  return { reply: fallbackReply, toolResults };
}
