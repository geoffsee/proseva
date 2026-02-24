import { AutoRouter } from "itty-router";
import { join } from "path";
import { readFile } from "fs/promises";
import OpenAI from "openai";
import { db } from "./db";
import { getConfig } from "./config";
import { broadcast } from "./broadcast";
import {
  cosine_similarity_dataspace,
} from "./wasm-similarity-init";
import { getChatSystemPrompt } from "./prompts";
import { analyzeCaseGraph, compressCaseGraphForPrompt } from "./chat-graph";
import {
  explorerTools,
  executeExplorerTool,
  isExplorerToolName,
} from "./explorer-tools";
import { asIttyRoute, openapiFormat } from "./openapi";

const __dir =
  import.meta.dir ??
  import.meta.dirname ??
  new URL(".", import.meta.url).pathname;

const appRoot = process.env.PROSEVA_DATA_DIR ?? join(__dir, "../..");

const router = AutoRouter({ base: "/api", format: openapiFormat });

router.post(
  "/chat",
  asIttyRoute("post", "/chat", async (req) => {
    const { messages } = (await req.json()) as {
      messages: { role: string; content: string }[];
    };
    const openai = new OpenAI({
      apiKey: getConfig("OPENAI_API_KEY"),
      baseURL: getConfig("OPENAI_ENDPOINT"),
    });

    const baseSystemPrompt = getChatSystemPrompt();

    const tools: OpenAI.ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "GetCases",
          description: "List all cases with their parties and filings",
          parameters: { type: "object", properties: {}, required: [] },
        },
      },
      {
        type: "function",
        function: {
          name: "GetDeadlines",
          description: "List all deadlines, optionally filtered by caseId",
          parameters: {
            type: "object",
            properties: {
              caseId: {
                type: "string",
                description: "Optional case ID to filter by",
              },
            },
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "GetContacts",
          description: "List all contacts, optionally filtered by caseId",
          parameters: {
            type: "object",
            properties: {
              caseId: {
                type: "string",
                description: "Optional case ID to filter by",
              },
            },
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "GetFinances",
          description: "List all financial entries",
          parameters: { type: "object", properties: {}, required: [] },
        },
      },
      {
        type: "function",
        function: {
          name: "GetDocuments",
          description: "List all ingested documents from the document index",
          parameters: { type: "object", properties: {}, required: [] },
        },
      },
      {
        type: "function",
        function: {
          name: "GetDocumentText",
          description:
            "Read the extracted text of a specific document by its ID",
          parameters: {
            type: "object",
            properties: {
              id: { type: "string", description: "The document ID" },
            },
            required: ["id"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "SearchTimeline",
          description:
            "Search timeline events by date, party, title, case number, or keyword. Returns chronological events from the case timeline.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description:
                  "Search query to match against event titles, details, or parties",
              },
              party: {
                type: "string",
                description: "Filter by party (Father, Mother, Court)",
              },
              caseNumber: {
                type: "string",
                description: "Filter by case number (e.g., JA018953-05-00)",
              },
              isCritical: {
                type: "boolean",
                description: "Filter to only critical events",
              },
              startDate: {
                type: "string",
                description: "Filter events after this date (MM-DD format)",
              },
              endDate: {
                type: "string",
                description: "Filter events before this date (MM-DD format)",
              },
            },
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "SearchKnowledge",
          description:
            "Search the legal knowledge base for Virginia-specific rules, legal concepts, case lifecycle information, document handling guidance, and API surface details. Use this when the user asks about Virginia law, court procedures, legal terminology, case statuses, or how the system works.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Natural language search query",
              },
              topK: {
                type: "number",
                description: "Number of results to return (default 3)",
              },
            },
            required: ["query"],
          },
        },
      },
      ...explorerTools,
    ];

    const parseStringArg = (value: unknown): string | undefined => {
      if (typeof value !== "string") return undefined;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };
    const parseNumberArg = (value: unknown): number | undefined => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
      }
      return undefined;
    };
    const parseBooleanArg = (value: unknown): boolean | undefined => {
      if (typeof value === "boolean") return value;
      if (value === "true") return true;
      if (value === "false") return false;
      return undefined;
    };
    const documentEntries = [...db.documents.values()];
    const graphSnapshotText = (() => {
      try {
        const graphAnalysis = analyzeCaseGraph(
          {
            cases: [...db.cases.values()],
            deadlines: [...db.deadlines.values()],
            contacts: [...db.contacts.values()],
            filings: [...db.filings.values()],
            evidences: [...db.evidences.values()],
            notes: [...db.notes.values()],
            documents: documentEntries,
          },
          { topK: 10 },
        );
        const compressedGraph = compressCaseGraphForPrompt(graphAnalysis, {
          maxCases: 4,
          maxNodes: 6,
        });
        return JSON.stringify(compressedGraph);
      } catch (error) {
        console.warn("[chat] Graph bootstrap failed", error);
        return JSON.stringify({ warning: "Graph context unavailable" });
      }
    })();
    const systemPrompt = `${baseSystemPrompt}

Graph context bootstrap (compressed JSON snapshot):
${graphSnapshotText}

Treat this snapshot as baseline context for case connectivity and bottlenecks. Use tools for exact record-level lookups when needed.

You also have access to a Virginia law knowledge graph via explorer tools (get_stats, search_nodes, get_node, get_neighbors, find_similar). Use these for Virginia Code lookups, graph traversal of legal provisions, and semantic similarity search. search_nodes returns truncated text — use get_node for full text of important sections.`;

    const executeTool = async (
      name: string,
      args: Record<string, unknown>,
    ): Promise<string> => {
      switch (name) {
        case "GetCases":
          return JSON.stringify([...db.cases.values()]);
        case "GetDeadlines": {
          const caseId = parseStringArg(args.caseId);
          let deadlines = [...db.deadlines.values()];
          if (caseId)
            deadlines = deadlines.filter((d) => d.caseId === caseId);
          return JSON.stringify(deadlines);
        }
        case "GetContacts": {
          const caseId = parseStringArg(args.caseId);
          let contacts = [...db.contacts.values()];
          if (caseId) contacts = contacts.filter((c) => c.caseId === caseId);
          return JSON.stringify(contacts);
        }
        case "GetFinances":
          return JSON.stringify([...db.finances.values()]);
        case "GetDocuments": {
          const docs = [...db.documents.values()];
          return JSON.stringify(
            docs.map(({ id, title, category, pageCount }) => ({
              id,
              title,
              category,
              pages: pageCount,
            })),
          );
        }
        case "GetDocumentText": {
          const documentId = parseStringArg(args.id);
          if (!documentId) {
            return JSON.stringify({ error: "Document ID is required" });
          }
          const doc = db.documents.get(documentId);
          if (!doc) return JSON.stringify({ error: "Document not found" });
          return JSON.stringify({
            id: doc.id,
            title: doc.title,
            text: doc.extractedText,
          });
        }
        case "SearchTimeline": {
          interface TimelineEvent {
            title?: string;
            details?: string;
            party?: string;
            date?: string;
            case?: { number?: string };
            isCritical?: boolean;
            source?: string;
          }

          try {
            const timelinePath = join(
              appRoot,
              "case-data/case-documents/timeline_data.json",
            );
            const timelineRaw = await readFile(timelinePath, "utf-8");
            const timelineData = JSON.parse(timelineRaw);
            let events: TimelineEvent[] = timelineData.events || [];
            const query = parseStringArg(args.query);
            const party = parseStringArg(args.party);
            const caseNumber = parseStringArg(args.caseNumber);
            const isCritical = parseBooleanArg(args.isCritical);
            const startDate = parseStringArg(args.startDate);
            const endDate = parseStringArg(args.endDate);

            // Apply filters
            if (query) {
              const q = query.toLowerCase();
              events = events.filter(
                (e: TimelineEvent) =>
                  e.title?.toLowerCase().includes(q) ||
                  e.details?.toLowerCase().includes(q) ||
                  e.party?.toLowerCase().includes(q),
              );
            }
            if (party) {
              events = events.filter((e: TimelineEvent) => e.party === party);
            }
            if (caseNumber) {
              events = events.filter(
                (e: TimelineEvent) => e.case?.number === caseNumber,
              );
            }
            if (isCritical !== undefined) {
              events = events.filter(
                (e: TimelineEvent) => e.isCritical === isCritical,
              );
            }
            if (startDate) {
              events = events.filter(
                (e: TimelineEvent) => e.date && e.date >= startDate,
              );
            }
            if (endDate) {
              events = events.filter(
                (e: TimelineEvent) => e.date && e.date <= endDate,
              );
            }

            return JSON.stringify({
              total: events.length,
              events: events.map((e: TimelineEvent) => ({
                date: e.date,
                party: e.party,
                title: e.title,
                caseNumber: e.case?.number,
                isCritical: e.isCritical,
                details: e.details,
                source: e.source,
              })),
            });
          } catch {
            return JSON.stringify({ error: "Could not search timeline" });
          }
        }
        case "SearchKnowledge": {
          try {
            const query = parseStringArg(args.query);
            if (!query) {
              return JSON.stringify({ error: "Query is required" });
            }
            const topK = parseNumberArg(args.topK) ?? 3;
            const embResponse = await openai.embeddings.create({
              model:
                getConfig("EMBEDDINGS_MODEL") || "text-embedding-3-small",
              input: query,
            });
            const queryVec = embResponse.data[0].embedding;
            const records = Array.from(db.embeddings.values());
            if (records.length === 0) return JSON.stringify([]);
            const dim = queryVec.length;
            const flat = new Float64Array(records.length * dim);
            for (let i = 0; i < records.length; i++) {
              flat.set(records[i].embedding, i * dim);
            }
            const ranked = cosine_similarity_dataspace(
              flat,
              records.length,
              dim,
              new Float64Array(queryVec),
            );
            const scored = [];
            for (
              let i = 0;
              i < ranked.length && scored.length < topK;
              i += 2
            ) {
              const idx = ranked[i + 1];
              scored.push({
                source: records[idx].source,
                content: records[idx].content,
                score: ranked[i],
              });
            }
            return JSON.stringify(scored);
          } catch {
            return JSON.stringify({ error: "Knowledge search failed" });
          }
        }
        default:
          if (isExplorerToolName(name)) {
            try {
              return await executeExplorerTool(name, args);
            } catch {
              return JSON.stringify({
                error: `Explorer tool '${name}' failed — explorer may be unavailable`,
              });
            }
          }
          return JSON.stringify({ error: "Unknown tool" });
      }
    };

    // === Phase 1: Tool-calling with TEXT_MODEL_SMALL ===
    const toolMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const collectedToolResults: { tool: string; result: string }[] = [];

    for (let i = 0; i < 10; i++) {
      const completion = await openai.chat.completions.create({
        model: getConfig("TEXT_MODEL_SMALL") || "gpt-4o-mini",
        messages: toolMessages,
        tools,
      });

      const choice = completion.choices[0];

      if (
        choice.finish_reason === "tool_calls" ||
        choice.message.tool_calls?.length
      ) {
        toolMessages.push(choice.message);
        for (const toolCall of choice.message.tool_calls ?? []) {
          if (toolCall.type !== "function") continue;
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(toolCall.function.arguments) as Record<
              string,
              unknown
            >;
          } catch {
            args = {};
          }
          broadcast("activity-status", { source: "chat", phase: "tool-start", tool: toolCall.function.name });
          const result = await executeTool(toolCall.function.name, args);
          broadcast("activity-status", { source: "chat", phase: "tool-done", tool: toolCall.function.name });
          collectedToolResults.push({ tool: toolCall.function.name, result });
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }
        continue;
      }
      break;
    }

    // === Phase 2: Conversational response with TEXT_MODEL_LARGE ===
    const conversationMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    if (collectedToolResults.length > 0) {
      const contextSummary = collectedToolResults
        .map((r) => `[${r.tool}]: ${r.result}`)
        .join("\n\n");
      conversationMessages.push({
        role: "assistant",
        content: `I retrieved the following data to help answer your question:\n\n${contextSummary}`,
      });
    }

    broadcast("activity-status", { source: "chat", phase: "generating" });
    const finalCompletion = await openai.chat.completions.create({
      model: getConfig("TEXT_MODEL_LARGE") || "gpt-4o",
      messages: conversationMessages,
    });
    broadcast("activity-status", { source: "chat", phase: "idle" });

    return {
      reply:
        finalCompletion.choices[0].message.content ??
        "Sorry, I was unable to complete the request.",
    };
  }),
);

export { router as chatRouter };
