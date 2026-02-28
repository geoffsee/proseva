import OpenAI from "openai";
import { getConfig } from "../config";
import { searchKnowledge, getEmbeddingDim } from "../mcp-knowledge-client";

type ChatRoleMessage = {
  role: string;
  content: string;
};

type EmitChatProcess = (
  stage:
    | "tool-context-start"
    | "tool-context-done"
    | "tool-context-failed"
    | "tool-loop-start"
    | "tool-iteration"
    | "tool-call-start"
    | "tool-call-done"
    | "tool-loop-complete"
    | "tool-summary-start"
    | "tool-summary-done"
    | "tool-summary-failed",
  message: string,
  data?: Record<string, unknown>,
) => void;

type PlannedGraphQlQuery = {
  query: string;
  variables?: Record<string, unknown>;
  purpose?: string;
};

type OrchestrationResult = {
  used: boolean;
  conversationMessages: OpenAI.ChatCompletionMessageParam[];
  summary: string;
};

type SourceRow = {
  source: string;
  source_id: string;
  node_type: string;
  source_text_preview?: string;
};

const previewText = (value: string, max = 160): string =>
  value.replace(/\s+/g, " ").trim().slice(0, max);

const extractJsonObject = (raw: string): Record<string, unknown> | null => {
  const trimmed = raw.trim();
  const direct = (() => {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
    return null;
  })();
  if (direct) return direct;

  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    try {
      const parsed = JSON.parse(fencedMatch[1]) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
};

const parsePlannedQueries = (raw: string): PlannedGraphQlQuery[] => {
  const parsed = extractJsonObject(raw);
  if (!parsed) return [];
  const queries = parsed.queries;
  if (!Array.isArray(queries)) return [];
  const mapped = queries.map((entry): PlannedGraphQlQuery | null => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const query = typeof row.query === "string" ? row.query.trim() : "";
      if (!query || !/\bquery\b/.test(query) || /\bmutation\b/i.test(query)) {
        return null;
      }
      const variables =
        row.variables && typeof row.variables === "object"
          ? (row.variables as Record<string, unknown>)
          : undefined;
      const purpose =
        typeof row.purpose === "string" ? row.purpose.trim() : undefined;
      const planned: PlannedGraphQlQuery = { query };
      if (variables) planned.variables = variables;
      if (purpose) planned.purpose = purpose;
      return planned;
    });
  return mapped
    .filter((entry): entry is PlannedGraphQlQuery => entry !== null)
    .slice(0, 4);
};

const collectSourceRows = (
  value: unknown,
  rows: SourceRow[] = [],
): SourceRow[] => {
  if (!value) return rows;
  if (Array.isArray(value)) {
    for (const item of value) collectSourceRows(item, rows);
    return rows;
  }
  if (typeof value === "object") {
    const row = value as Record<string, unknown>;
    if (
      typeof row.source === "string" &&
      typeof row.sourceId === "string" &&
      typeof row.nodeType === "string"
    ) {
      rows.push({
        source: row.source,
        source_id: row.sourceId,
        node_type: row.nodeType,
        source_text_preview:
          typeof row.sourceText === "string"
            ? previewText(row.sourceText, 140)
            : undefined,
      });
    }
    for (const nested of Object.values(row)) collectSourceRows(nested, rows);
  }
  return rows;
};

const GENERIC_NODE_TYPES = new Set([
  "title",
  "subtitle",
  "chapter",
  "subchapter",
  "part",
  "article",
]);

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "what",
  "when",
  "where",
  "which",
  "explain",
  "difference",
  "between",
  "under",
  "about",
  "your",
  "their",
  "into",
  "cite",
  "exact",
  "sections",
  "section",
]);

const buildQueryTerms = (query: string): string[] =>
  (query.toLowerCase().match(/[a-z0-9-]+/g) ?? [])
    .filter((term) => term.length >= 4 && !STOP_WORDS.has(term))
    .slice(0, 24);

const buildQuerySectionRefs = (query: string): string[] =>
  Array.from(
    new Set(
      Array.from(
        query.matchAll(/\b\d{1,3}(?:\.\d+)*(?:-\d+(?:\.\d+)*)?\b/g),
        (match) => match[0],
      ),
    ),
  );

const scoreSourceRow = (
  row: SourceRow,
  queryTerms: string[],
  sectionRefs: string[],
): number => {
  const haystack = [
    row.source,
    row.source_id,
    row.node_type,
    row.source_text_preview ?? "",
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  if (
    sectionRefs.length > 0 &&
    sectionRefs.some((sectionRef) => haystack.includes(sectionRef.toLowerCase()))
  ) {
    score += 4;
  }
  let keywordHits = 0;
  for (const term of queryTerms) {
    if (haystack.includes(term)) keywordHits += 1;
    if (keywordHits >= 3) break;
  }
  score += keywordHits;
  if (!GENERIC_NODE_TYPES.has(row.node_type.toLowerCase())) {
    score += 1;
  }
  return score;
};

const filterSourcesByQueryRelevance = (
  rows: SourceRow[],
  query: string,
): SourceRow[] => {
  if (rows.length === 0) return rows;

  const deduped = new Map<string, SourceRow>();
  for (const row of rows) {
    const key = `${row.source}:${row.source_id}:${row.node_type}`;
    if (!deduped.has(key)) {
      deduped.set(key, row);
      continue;
    }
    const existing = deduped.get(key);
    if (
      existing &&
      (row.source_text_preview?.length ?? 0) >
        (existing.source_text_preview?.length ?? 0)
    ) {
      deduped.set(key, row);
    }
  }

  const uniqueRows = Array.from(deduped.values());
  const queryTerms = buildQueryTerms(query);
  const sectionRefs = buildQuerySectionRefs(query);
  const scored = uniqueRows
    .map((row) => ({
      row,
      score: scoreSourceRow(row, queryTerms, sectionRefs),
      genericNodeType: GENERIC_NODE_TYPES.has(row.node_type.toLowerCase()),
    }))
    .sort((a, b) => b.score - a.score);

  const relevant = scored.filter(
    ({ score, genericNodeType }) => score >= 2 || (!genericNodeType && score >= 1),
  );
  if (relevant.length > 0) {
    return relevant.map(({ row }) => row);
  }

  // Fallback: prefer specific node types, then keep deterministic order.
  return scored
    .sort((a, b) => Number(a.genericNodeType) - Number(b.genericNodeType))
    .map(({ row }) => row);
};

const deterministicToolGuide = `Explorer GraphQL schema intent:
- nodes(type, search, limit, offset): substring search on source_id (section number) and source (corpus name). The search parameter matches the section number or corpus name — NOT the textual content of the node.
- node(id): full sourceText for one legal node.
- neighbors(id): legal graph relationships.
- similar(id, limit): embedding-nearest related nodes.

Planning policy:
- CRITICAL: nodes(search: ...) only matches source_id (e.g. "20-124.3") and source (e.g. "virginia_code"). It does NOT search node text or topics. Using topic words like "custody" or "best interests" as the search value will return zero results.
- To retrieve statutes by topic, use section number prefixes. Key Virginia custody section prefixes: "20-124" (custody/visitation orders), "20-146" (UCCJA jurisdiction), "20-108" (support/modification), "16.1-278" (juvenile court custody matters).
- When MCP semantic results list source_ids in context below, prefer retrieving those specific nodes with node(id) rather than re-running nodes(search:...).
- CRITICAL: Do NOT hardcode node(id: X) or similar(id: X) with arbitrary integer IDs you invent. You cannot predict which node IDs exist in the database. Only use node(id) or similar(id) with integer IDs that will be returned by a PRECEDING nodes() query within your plan.
- If you have no prior nodes() results to draw IDs from, use only nodes(search:...) queries with section number prefixes.
- Keep plan small (1-4 queries), deterministic, and citation-oriented.
- Never use mutations.
- CRITICAL: Every query MUST include selection sets for all object/connection return types.

Example queries:
query { nodes(search: "20-124", limit: 5) { nodes { id source sourceId nodeType sourceText } total } }
query { node(id: 42) { id source sourceId nodeType sourceText edges { relType toId toNode { id sourceId nodeType sourceText } } } }
query { neighbors(id: 42) { fromId toId relType fromNode { id sourceId sourceText } toNode { id sourceId sourceText } } }
query { similar(id: 42, limit: 3) { score node { id source sourceId nodeType sourceText } } }`;

const introspectionQuery = `query IntrospectQueryRoot {
  __schema {
    queryType {
      name
      fields {
        name
        args {
          name
          type {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }
        type {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
            }
          }
        }
      }
    }
    types {
      kind
      name
      fields {
        name
        type {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
            }
          }
        }
      }
    }
  }
}`;

type IntrospectionTypeRef = {
  kind?: string;
  name?: string | null;
  ofType?: IntrospectionTypeRef | null;
};

const renderTypeRef = (typeRef?: IntrospectionTypeRef | null): string => {
  if (!typeRef) return "Unknown";
  if (typeRef.kind === "NON_NULL") return `${renderTypeRef(typeRef.ofType)}!`;
  if (typeRef.kind === "LIST") return `[${renderTypeRef(typeRef.ofType)}]`;
  return typeRef.name || typeRef.kind || "Unknown";
};

const loadExplorerSchemaSnapshot = async (
  explorerUrl: string,
): Promise<{ queryType: string; fields: string[]; typeDefinitions: string[] }> => {
  const res = await fetch(`${explorerUrl}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: introspectionQuery }),
  });
  if (!res.ok) throw new Error(`introspection_http_${res.status}`);
  const payload = (await res.json()) as {
    data?: {
      __schema?: {
        queryType?: {
          name?: string;
          fields?: Array<{
            name?: string;
            args?: Array<{ name?: string; type?: IntrospectionTypeRef }>;
            type?: IntrospectionTypeRef;
          }>;
        };
        types?: Array<{
          kind?: string;
          name?: string;
          fields?: Array<{
            name?: string;
            type?: IntrospectionTypeRef;
          }> | null;
        }>;
      };
    };
    errors?: unknown[];
  };
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    throw new Error("introspection_graphql_error");
  }
  const queryType = payload.data?.__schema?.queryType?.name;
  const fieldsRaw = payload.data?.__schema?.queryType?.fields ?? [];
  if (!queryType || !Array.isArray(fieldsRaw) || fieldsRaw.length === 0) {
    throw new Error("introspection_empty_schema");
  }
  const fields = fieldsRaw
    .map((field) => {
      const fieldName = typeof field.name === "string" ? field.name : "";
      if (!fieldName) return null;
      const args = Array.isArray(field.args)
        ? field.args
            .map((arg) => {
              const argName = typeof arg.name === "string" ? arg.name : "";
              if (!argName) return null;
              return `${argName}: ${renderTypeRef(arg.type)}`;
            })
            .filter((arg): arg is string => arg !== null)
        : [];
      return `${fieldName}(${args.join(", ")}): ${renderTypeRef(field.type)}`;
    })
    .filter((field): field is string => field !== null);
  if (fields.length === 0) throw new Error("introspection_no_query_fields");

  const builtinTypes = new Set(["String", "Int", "Float", "Boolean", "ID", "Query"]);
  const typeDefinitions = (payload.data?.__schema?.types ?? [])
    .filter(
      (t) =>
        t.kind === "OBJECT" &&
        typeof t.name === "string" &&
        !t.name.startsWith("__") &&
        !builtinTypes.has(t.name) &&
        Array.isArray(t.fields) &&
        t.fields.length > 0,
    )
    .map((t) => {
      const typeFields = (t.fields ?? [])
        .map((f) => `  ${f.name}: ${renderTypeRef(f.type)}`)
        .join("\n");
      return `type ${t.name} {\n${typeFields}\n}`;
    });

  return { queryType, fields, typeDefinitions };
};

export const shouldUseDeterministicGraphFlow = (): boolean => {
  const raw = getConfig("CHAT_DETERMINISTIC_GRAPH");
  return raw === "1" || raw === "true";
};

export const runDeterministicGraphOrchestration = async ({
  openai,
  embeddingsClient,
  systemPrompt,
  messages,
  latestUserMessage,
  latestAssistantMessage,
  emitChatProcess,
}: {
  openai: OpenAI;
  embeddingsClient: OpenAI;
  systemPrompt: string;
  messages: ChatRoleMessage[];
  latestUserMessage: string;
  latestAssistantMessage: string;
  emitChatProcess: EmitChatProcess;
}): Promise<OrchestrationResult> => {
  let optimizedContext = latestUserMessage;
  if (latestUserMessage.trim() && latestAssistantMessage.trim()) {
    emitChatProcess(
      "tool-context-start",
      "Optimizing context for deterministic GraphQL planning.",
    );
    try {
      const optimization = await openai.chat.completions.create({
        model: getConfig("TEXT_MODEL_SMALL") || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Produce one concise retrieval context sentence for deterministic GraphQL query planning.",
          },
          {
            role: "user",
            content: `Merge the former assistant response and latest user message into a concise retrieval context.\n\nFormer assistant response:\n${latestAssistantMessage}\n\nLatest user message:\n${latestUserMessage}`,
          },
        ],
      });
      const optimized = optimization.choices[0]?.message?.content?.trim() || "";
      if (optimized) {
        optimizedContext = optimized;
      }
      emitChatProcess("tool-context-done", "Deterministic context optimized.", {
        optimized_preview: previewText(optimizedContext, 180),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emitChatProcess(
        "tool-context-failed",
        "Context optimization failed. Using latest user message.",
        { error: message },
      );
    }
  }

  // --- MCP semantic knowledge search (runs in parallel with schema load) ---
  type McpSearchResult = {
    answers: Array<{
      node_id: number;
      source: string;
      source_id: string;
      node_type: string;
      content: string;
      score: number;
      semantic_score: number;
      lexical_score: number;
      graph_coherence: number;
    }>;
    context: Array<{
      node_id: number;
      source: string;
      source_id: string;
      node_type: string;
      content: string;
      relation: string;
      anchor_node_id: number;
    }>;
  };

  const runMcpSearch = async (): Promise<McpSearchResult | null> => {
    emitChatProcess("tool-call-start", "Running semantic knowledge search.", {
      query_preview: previewText(optimizedContext, 160),
    });
    try {
      const embeddingsModel =
        getConfig("EMBEDDINGS_MODEL") || "octen-embedding-0.6b";
      const targetDim = await getEmbeddingDim();
      if (targetDim <= 0) {
        console.warn(
          "[chat][graph-flow] MCP semantic search skipped: could not determine embedding dim",
        );
        return null;
      }
      const embResponse = await embeddingsClient.embeddings.create({
        model: embeddingsModel,
        input: optimizedContext,
        encoding_format: "float",
      });
      const queryVec = embResponse.data[0].embedding;
      console.info(
        `[chat][graph-flow] MCP embedding generated model=${embeddingsModel} query_dim=${queryVec.length} target_dim=${targetDim}`,
      );
      const result = await searchKnowledge(queryVec, optimizedContext, 5);
      console.info(
        `[chat][graph-flow] MCP semantic search done answers=${result.answers.length} context=${result.context.length} raw=${JSON.stringify(result)}`,
      );
      emitChatProcess(
        "tool-call-done",
        "Semantic knowledge search complete.",
        {
          answers: result.answers.length,
          context_nodes: result.context.length,
          sources: result.answers.slice(0, 5).map((a) => ({
            source: a.source,
            source_id: a.source_id,
            node_type: a.node_type,
            score: a.score,
            preview: previewText(a.content, 120),
          })),
          top_sources: result.answers
            .slice(0, 3)
            .map((a) => `${a.source}:${a.source_id} (${a.score.toFixed(3)})`),
        },
      );
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[chat][graph-flow] MCP semantic search failed: ${message}`);
      emitChatProcess("tool-context-failed", "Semantic knowledge search failed.", {
        error: message,
      });
      return null;
    }
  };

  // Run MCP search and GraphQL schema load in parallel
  emitChatProcess("tool-loop-start", "Planning deterministic retrieval.", {
    query_preview: previewText(optimizedContext, 180),
    max_queries: 4,
  });
  const explorerUrl = getConfig("EXPLORER_URL") || "http://localhost:3002";
  emitChatProcess(
    "tool-context-start",
    "Loading live GraphQL schema for deterministic planning.",
  );
  const [mcpSearchResult, schemaSnapshot] = await Promise.all([
    runMcpSearch(),
    loadExplorerSchemaSnapshot(explorerUrl),
  ]);
  emitChatProcess("tool-context-done", "Live GraphQL schema loaded.", {
    query_type: schemaSnapshot.queryType,
    query_fields: schemaSnapshot.fields.length,
    query_fields_preview: schemaSnapshot.fields.slice(0, 8),
  });

  // Format MCP results as context for the planner
  const mcpContextForPlanner = mcpSearchResult?.answers.length
    ? `\n\nSemantic search already found these relevant sources (use GraphQL to find additional or related nodes):\n${mcpSearchResult.answers
        .slice(0, 3)
        .map(
          (a) =>
            `- ${a.source}:${a.source_id} (${a.node_type}, score=${a.score.toFixed(3)}): ${previewText(a.content, 100)}`,
        )
        .join("\n")}`
    : "\n\nNote: Semantic vector search is unavailable. Compensate by issuing 2-3 nodes(search:...) queries using section number prefixes (e.g. \"20-124\" for custody statutes, \"20-146\" for UCCJA, \"16.1-278\" for juvenile court) — nodes(search:...) matches source_id, not content, so topic words will return zero results.";

  const planner = await openai.chat.completions.create({
    model: getConfig("TEXT_MODEL_SMALL") || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a query planner for legal knowledge retrieval. Return only JSON.",
      },
      {
        role: "user",
        content: `Build a deterministic GraphQL query plan for this legal context.\n${deterministicToolGuide}\n\nLive GraphQL query root from introspection:\nqueryType: ${schemaSnapshot.queryType}\nfields:\n${schemaSnapshot.fields.join("\n")}\n\nReturn types (use these to build selection sets):\n${schemaSnapshot.typeDefinitions.join("\n\n")}\n\nReturn JSON with shape: {"intent":"string","queries":[{"purpose":"string","query":"GraphQL query string","variables":{}}]}\n\nRules:
- Only use fields present in the introspected query root.
- Do not emit mutations.
- Keep to 1-4 queries.
- Every query MUST include full selection sets for object return types. Never omit the { ... } selection.
\nContext:\n${optimizedContext}${mcpContextForPlanner}`,
      },
    ],
  });
  const planRaw = planner.choices[0]?.message?.content?.trim() || "";
  const plannedQueries = parsePlannedQueries(planRaw);
  emitChatProcess("tool-iteration", "GraphQL query planning complete.", {
    planned_queries: plannedQueries.length,
    plan_preview: previewText(planRaw, 240),
  });

  const queryResults: Array<{
    order: number;
    purpose?: string;
    query: string;
    variables?: Record<string, unknown>;
    data: unknown;
  }> = [];

  for (let i = 0; i < plannedQueries.length; i++) {
    const planned = plannedQueries[i];
    emitChatProcess("tool-call-start", "Running GraphQL retrieval query.", {
      order: i + 1,
      purpose: planned.purpose,
      query_preview: previewText(planned.query, 160),
    });
    const res = await fetch(`${explorerUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: planned.query,
        variables: planned.variables ?? {},
      }),
    });
    const payload = (await res.json()) as { data?: unknown; errors?: unknown };
    const data = payload.errors ? payload : payload.data;
    queryResults.push({
      order: i + 1,
      purpose: planned.purpose,
      query: planned.query,
      variables: planned.variables,
      data,
    });
    const sources = filterSourcesByQueryRelevance(
      collectSourceRows(data),
      latestUserMessage,
    ).slice(0, 6);
    emitChatProcess("tool-call-done", "GraphQL retrieval query completed.", {
      order: i + 1,
      result_len: JSON.stringify(data).length,
      sources,
    });
  }
  emitChatProcess("tool-loop-complete", "Deterministic retrieval complete.", {
    executed_queries: queryResults.length,
    mcp_answers: mcpSearchResult?.answers.length ?? 0,
  });

  emitChatProcess("tool-summary-start", "Summarizing retrieval results.", {
    executed_queries: queryResults.length,
    mcp_answers: mcpSearchResult?.answers.length ?? 0,
  });
  let summaryText = "No retrieval results were obtained.";
  try {
    const summary = await openai.chat.completions.create({
      model: getConfig("TEXT_MODEL_SMALL") || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Summarize legal retrieval results as compact JSON with keys: intent, key_findings, legal_chunks, gaps, confidence. Only include legal_chunks that are DIRECTLY relevant to the user's query — discard statutes or provisions from unrelated areas of law even if they appear in the results. Each legal_chunk must have source, source_id, and a direct text excerpt. Combine results from both semantic search and GraphQL graph queries. Set confidence lower when retrieved chunks are tangentially related rather than on-point.",
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              user_query: latestUserMessage,
              optimized_context: optimizedContext,
              semantic_search_results: mcpSearchResult
                ? {
                    answers: mcpSearchResult.answers
                      .filter((a) => a.score >= 0.35)
                      .map((a) => ({
                        source: a.source,
                        source_id: a.source_id,
                        node_type: a.node_type,
                        score: a.score,
                        content: a.content,
                      })),
                    context: mcpSearchResult.context.map((c) => ({
                      source: c.source,
                      source_id: c.source_id,
                      node_type: c.node_type,
                      relation: c.relation,
                      content: c.content,
                    })),
                  }
                : null,
              graphql_plan: plannedQueries,
              graphql_results: queryResults,
            },
            null,
            2,
          ).slice(0, 18000),
        },
      ],
    });
    const content = summary.choices[0]?.message?.content?.trim() || "";
    if (content) summaryText = content;
    emitChatProcess("tool-summary-done", "Tool summary prepared.", {
      summary_len: summaryText.length,
      summary_preview: previewText(summaryText, 220),
      summary_text: summaryText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitChatProcess(
      "tool-summary-failed",
      "Deterministic summary failed. Proceeding with partial context.",
      { error: message },
    );
  }

  // Build deduplicated legal sources from MCP + GraphQL
  const legalSources: string[] = [];
  if (mcpSearchResult?.answers.length) {
    for (const a of mcpSearchResult.answers) {
      if (a.score < 0.45) continue;
      legalSources.push(
        `[${a.source}:${a.source_id}] (${a.node_type}, relevance=${a.score.toFixed(3)})\n${a.content}`,
      );
    }
  }
  // Extract source texts from GraphQL results (avoid duplicating MCP sources)
  const mcpSourceIds = new Set(
    mcpSearchResult?.answers.map((a) => `${a.source}:${a.source_id}`) ?? [],
  );
  for (const qr of queryResults) {
    const filteredRows = filterSourcesByQueryRelevance(
      collectSourceRows(qr.data),
      latestUserMessage,
    );
    for (const row of filteredRows) {
      const key = `${row.source}:${row.source_id}`;
      if (!mcpSourceIds.has(key) && row.source_text_preview) {
        mcpSourceIds.add(key);
        legalSources.push(
          `[${key}] (${row.node_type ?? "unknown"})\n${row.source_text_preview}`,
        );
      }
    }
  }

  const sourcesBlock = legalSources.length
    ? `\n\nRetrieved legal sources:\n\n${legalSources.join("\n\n")}`
    : "";

  const conversationMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    })),
    {
      role: "system",
      content: `Deterministic orchestration summary: ${summaryText}${sourcesBlock}`,
    },
  ];

  return {
    used: true,
    conversationMessages,
    summary: summaryText,
  };
};
