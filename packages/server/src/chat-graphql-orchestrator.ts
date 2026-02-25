import OpenAI from "openai";
import { getConfig } from "./config";

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
  rows: Array<Record<string, unknown>> = [],
): Array<Record<string, unknown>> => {
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

const deterministicToolGuide = `Explorer GraphQL schema intent:
- nodes(type, search, limit, offset): lexical discovery of candidate legal nodes.
- node(id): full sourceText for one legal node.
- neighbors(id): legal graph relationships.
- similar(id, limit): embedding-nearest related nodes.

Planning policy:
- Prefer nodes(...) first for legal discovery.
- Follow with node(id) only for the most relevant candidates.
- Keep plan small (1-4 queries), deterministic, and citation-oriented.
- Never use mutations.`;

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
): Promise<{ queryType: string; fields: string[] }> => {
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
  return { queryType, fields };
};

export const shouldUseDeterministicGraphFlow = (): boolean => {
  const raw = getConfig("CHAT_DETERMINISTIC_GRAPH");
  return raw === "1" || raw === "true";
};

export const runDeterministicGraphOrchestration = async ({
  openai,
  systemPrompt,
  messages,
  latestUserMessage,
  latestAssistantMessage,
  emitChatProcess,
}: {
  openai: OpenAI;
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

  emitChatProcess("tool-loop-start", "Planning deterministic GraphQL queries.", {
    query_preview: previewText(optimizedContext, 180),
    max_queries: 4,
  });
  const explorerUrl = getConfig("EXPLORER_URL") || "http://localhost:3002";
  emitChatProcess(
    "tool-context-start",
    "Loading live GraphQL schema for deterministic planning.",
  );
  const schemaSnapshot = await loadExplorerSchemaSnapshot(explorerUrl);
  emitChatProcess("tool-context-done", "Live GraphQL schema loaded.", {
    query_type: schemaSnapshot.queryType,
    query_fields: schemaSnapshot.fields.length,
    query_fields_preview: schemaSnapshot.fields.slice(0, 8),
  });
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
        content: `Build a deterministic GraphQL query plan for this legal context.\n${deterministicToolGuide}\n\nLive GraphQL query root from introspection:\nqueryType: ${schemaSnapshot.queryType}\nfields:\n${schemaSnapshot.fields.join("\n")}\n\nReturn JSON with shape: {"intent":"string","queries":[{"purpose":"string","query":"GraphQL query string","variables":{}}]}\n\nRules:
- Only use fields present in the introspected query root.
- Do not emit mutations.
- Keep to 1-4 queries.
\nContext:\n${optimizedContext}`,
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
    const sources = collectSourceRows(data).slice(0, 6);
    emitChatProcess("tool-call-done", "GraphQL retrieval query completed.", {
      order: i + 1,
      result_len: JSON.stringify(data).length,
      sources,
    });
  }
  emitChatProcess("tool-loop-complete", "Deterministic GraphQL retrieval complete.", {
    executed_queries: queryResults.length,
  });

  emitChatProcess("tool-summary-start", "Summarizing GraphQL retrieval results.", {
    executed_queries: queryResults.length,
  });
  let summaryText = "No GraphQL retrieval queries were executed.";
  try {
    const summary = await openai.chat.completions.create({
      model: getConfig("TEXT_MODEL_SMALL") || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Summarize legal retrieval results as compact JSON with keys: intent, key_findings, legal_chunks, gaps, confidence. legal_chunks should include source, source_id, and direct text excerpts where available.",
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              user_query: latestUserMessage,
              optimized_context: optimizedContext,
              plan: plannedQueries,
              query_results: queryResults,
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

  const conversationMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    })),
    {
      role: "system",
      content: `Deterministic GraphQL orchestration summary: ${summaryText}`,
    },
    {
      role: "system",
      content: `Deterministic GraphQL retrieval artifacts: ${JSON.stringify(
        queryResults,
      ).slice(0, 18000)}`,
    },
  ];

  return {
    used: true,
    conversationMessages,
    summary: summaryText,
  };
};
