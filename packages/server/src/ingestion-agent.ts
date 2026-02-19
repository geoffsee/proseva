import OpenAI from "openai";
import { randomUUID } from "crypto";
import {
  db,
  type Case,
  type Contact,
  type Deadline,
  type Evidence,
  type Filing,
  type Note,
  type Party,
} from "./db";
import type { DocumentEntry } from "./ingest";
import { getConfig } from "./config";

type AutoPopulateParams = {
  openai: OpenAI;
  entry: DocumentEntry;
  text: string;
};

type ToolExecutionResult = {
  message: string;
  selectedCaseId?: string;
};

const MAX_TEXT_CHARS = 6000;

const ingestionTools: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "use_existing_case",
      description:
        "Select an existing case for this document so subsequent records are linked correctly.",
      parameters: {
        type: "object",
        properties: {
          caseId: {
            type: "string",
            description: "Existing case ID to link to",
          },
          reason: {
            type: "string",
            description: "Why this case matches the document",
          },
        },
        required: ["caseId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_case",
      description:
        "Create a new case when the document starts a new matter or no existing case matches.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Case caption or descriptive name",
          },
          caseNumber: {
            type: "string",
            description: "Court case number if present",
          },
          court: { type: "string", description: "Court name" },
          caseType: {
            type: "string",
            description: "Type of case (e.g. contempt, custody, civil)",
          },
          status: {
            type: "string",
            enum: ["active", "closed", "pending"],
            description: "Lifecycle state",
          },
          notes: {
            type: "string",
            description: "Any helpful context from the document",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_party",
      description:
        "Add a party mentioned in the document to the selected case.",
      parameters: {
        type: "object",
        properties: {
          caseId: {
            type: "string",
            description:
              "Case to attach the party to (optional if already selected)",
          },
          name: { type: "string" },
          role: {
            type: "string",
            description:
              "Role such as plaintiff, defendant, petitioner, respondent",
          },
          contact: { type: "string", description: "Contact info or reference" },
        },
        required: ["name", "role"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_filing",
      description:
        "Create a filing record described in the document (motions, orders, petitions, receipts).",
      parameters: {
        type: "object",
        properties: {
          caseId: {
            type: "string",
            description:
              "Case the filing belongs to (optional if already selected)",
          },
          title: { type: "string" },
          date: {
            type: "string",
            description: "Filing or signature date in ISO or source format",
          },
          type: {
            type: "string",
            description: "e.g., motion, order, petition, receipt",
          },
          notes: { type: "string", description: "Key details or outcomes" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_deadline",
      description:
        "Create a deadline derived from the document (hearing dates, response deadlines, service dates).",
      parameters: {
        type: "object",
        properties: {
          caseId: {
            type: "string",
            description: "Case to attach to (optional if already selected)",
          },
          title: { type: "string" },
          date: { type: "string", description: "Due or hearing date" },
          type: {
            type: "string",
            enum: ["filing", "hearing", "discovery", "other"],
          },
          completed: {
            type: "boolean",
            description: "Mark complete if the document shows it was done",
          },
        },
        required: ["title", "date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_contact",
      description:
        "Add a contact (attorney, clerk, officer) referenced in the document.",
      parameters: {
        type: "object",
        properties: {
          caseId: {
            type: "string",
            description: "Case to attach to (optional if already selected)",
          },
          name: { type: "string" },
          role: { type: "string", description: "Role or title" },
          organization: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          address: { type: "string" },
          notes: { type: "string" },
        },
        required: ["name", "role"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_evidence",
      description:
        "Create an evidence record when the document is an exhibit or contains referenced exhibits.",
      parameters: {
        type: "object",
        properties: {
          caseId: {
            type: "string",
            description: "Case to attach to (optional if already selected)",
          },
          title: { type: "string" },
          description: { type: "string" },
          type: {
            type: "string",
            enum: [
              "document",
              "photo",
              "video",
              "audio",
              "physical",
              "testimony",
              "digital",
              "other",
            ],
          },
          fileUrl: {
            type: "string",
            description: "Optional link to the ingested file",
          },
          dateCollected: { type: "string" },
          location: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          relevance: { type: "string", enum: ["high", "medium", "low"] },
          admissible: { type: "boolean" },
          notes: { type: "string" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_note",
      description:
        "Create a concise note summarizing the document or action items.",
      parameters: {
        type: "object",
        properties: {
          caseId: {
            type: "string",
            description: "Case to attach to (optional if already selected)",
          },
          title: { type: "string" },
          content: { type: "string" },
          category: {
            type: "string",
            enum: ["case-notes", "research", "todo", "general", "other"],
          },
          tags: { type: "array", items: { type: "string" } },
          isPinned: { type: "boolean" },
        },
        required: ["title", "content"],
      },
    },
  },
];

export function truncateText(text: string): string {
  return text.length > MAX_TEXT_CHARS
    ? `${text.slice(0, MAX_TEXT_CHARS)}\n...[truncated]`
    : text;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function snapshotExistingData() {
  return {
    cases: [...db.cases.values()].map((c) => ({
      id: c.id,
      name: c.name,
      caseNumber: c.caseNumber,
      status: c.status,
      court: c.court,
      parties: c.parties,
    })),
    deadlines: [...db.deadlines.values()].slice(0, 50),
    contacts: [...db.contacts.values()].slice(0, 50),
  };
}

export function executeTool(
  name: string,
  args: Record<string, unknown>,
  state: { selectedCaseId?: string },
): ToolExecutionResult {
  const pickCaseId = (explicit?: string): string | undefined =>
    explicit || state.selectedCaseId;

  switch (name) {
    case "use_existing_case": {
      const caseId = args.caseId as string;
      if (!db.cases.has(caseId)) {
        return { message: `Case ${caseId} not found` };
      }
      state.selectedCaseId = caseId;
      return {
        message: `Linked to existing case ${caseId}`,
        selectedCaseId: caseId,
      };
    }
    case "create_case": {
      const caseNumber = args.caseNumber as string | undefined;
      const existing = [...db.cases.values()].find(
        (c) => c.caseNumber && caseNumber && c.caseNumber === caseNumber,
      );
      if (existing) {
        state.selectedCaseId = existing.id;
        return {
          message: `Reused existing case ${existing.id} by case number`,
          selectedCaseId: existing.id,
        };
      }
      const now = nowIso();
      const c: Case = {
        id: randomUUID(),
        name: (args.name as string) ?? "New Case",
        caseNumber: (args.caseNumber as string) ?? "",
        court: (args.court as string) ?? "",
        caseType: (args.caseType as string) ?? "",
        status: (args.status as Case["status"]) ?? "active",
        parties: [],
        filings: [],
        notes: (args.notes as string) ?? "",
        createdAt: now,
        updatedAt: now,
      };
      db.cases.set(c.id, c);
      state.selectedCaseId = c.id;
      return { message: `Created case ${c.id}`, selectedCaseId: c.id };
    }
    case "add_party": {
      const caseId = pickCaseId(args.caseId as string | undefined);
      if (!caseId) return { message: "No case selected for party" };
      const c = db.cases.get(caseId);
      if (!c) return { message: `Case ${caseId} not found` };
      const name = args.name as string;
      const role = args.role as string;
      const exists = c.parties.find((p) => p.name === name && p.role === role);
      if (exists) return { message: `Party already exists on case ${caseId}` };
      const party: Party = {
        id: randomUUID(),
        name,
        role,
        contact: (args.contact as string) ?? "",
      };
      c.parties.push(party);
      c.updatedAt = nowIso();
      return {
        message: `Added party ${party.id} to case ${caseId}`,
        selectedCaseId: caseId,
      };
    }
    case "create_filing": {
      const caseId = pickCaseId(args.caseId as string | undefined) ?? "";
      const title = args.title as string;
      const date = args.date as string | undefined;
      const existing = [...db.filings.values()].find(
        (f) =>
          f.title === title &&
          (!date || f.date === date) &&
          f.caseId === caseId,
      );
      if (existing)
        return {
          message: `Filing already exists (${existing.id})`,
          selectedCaseId: caseId || undefined,
        };
      const filing: Filing = {
        id: randomUUID(),
        title,
        date: date ?? "",
        type: (args.type as string) ?? "",
        notes: (args.notes as string) ?? "",
        caseId,
      };
      db.filings.set(filing.id, filing);
      if (caseId && db.cases.has(caseId)) {
        const c = db.cases.get(caseId)!;
        c.filings.push({ ...filing });
        c.updatedAt = nowIso();
      }
      if (caseId) state.selectedCaseId = caseId;
      return {
        message: `Created filing ${filing.id}`,
        selectedCaseId: caseId || undefined,
      };
    }
    case "create_deadline": {
      const caseId = pickCaseId(args.caseId as string | undefined) ?? "";
      const title = args.title as string;
      const date = args.date as string;
      const existing = [...db.deadlines.values()].find(
        (d) => d.title === title && d.date === date && d.caseId === caseId,
      );
      if (existing)
        return {
          message: `Deadline already exists (${existing.id})`,
          selectedCaseId: caseId || undefined,
        };
      const deadline: Deadline = {
        id: randomUUID(),
        caseId,
        title,
        date,
        type: (args.type as Deadline["type"]) ?? "other",
        completed: (args.completed as boolean) ?? false,
      };
      db.deadlines.set(deadline.id, deadline);
      if (caseId) state.selectedCaseId = caseId;
      return {
        message: `Created deadline ${deadline.id}`,
        selectedCaseId: caseId || undefined,
      };
    }
    case "create_contact": {
      const caseId = pickCaseId(args.caseId as string | undefined) ?? "";
      const name = args.name as string;
      const rawRole = args.role;
      const role =
        typeof rawRole === "string" &&
        (
          [
            "attorney",
            "judge",
            "clerk",
            "witness",
            "expert",
            "opposing_party",
            "other",
          ] as const
        ).includes(rawRole as Contact["role"])
          ? (rawRole as Contact["role"])
          : "other";
      const existing = [...db.contacts.values()].find(
        (c) => c.name === name && c.role === role && c.caseId === caseId,
      );
      if (existing)
        return {
          message: `Contact already exists (${existing.id})`,
          selectedCaseId: caseId || undefined,
        };
      const contact: Contact = {
        id: randomUUID(),
        name,
        role,
        organization: (args.organization as string) ?? "",
        phone: (args.phone as string) ?? "",
        fax: (args.fax as string) ?? "",
        email: (args.email as string) ?? "",
        address: (args.address as string) ?? "",
        notes: (args.notes as string) ?? "",
        caseId,
      };
      db.contacts.set(contact.id, contact);
      if (caseId) state.selectedCaseId = caseId;
      return {
        message: `Created contact ${contact.id}`,
        selectedCaseId: caseId || undefined,
      };
    }
    case "create_evidence": {
      const caseId = pickCaseId(args.caseId as string | undefined) ?? "";
      const evidence: Evidence = {
        id: randomUUID(),
        caseId,
        exhibitNumber: "",
        title: args.title as string,
        description: (args.description as string) ?? "",
        type: (args.type as Evidence["type"]) ?? "document",
        fileUrl: (args.fileUrl as string) ?? "",
        dateCollected: (args.dateCollected as string) ?? "",
        location: (args.location as string) ?? "",
        tags: Array.isArray(args.tags) ? (args.tags as string[]) : [],
        relevance: (args.relevance as Evidence["relevance"]) ?? "medium",
        admissible: (args.admissible as boolean) ?? false,
        chain: [],
        notes: (args.notes as string) ?? "",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.evidences.set(evidence.id, evidence);
      if (caseId) state.selectedCaseId = caseId;
      return {
        message: `Created evidence ${evidence.id}`,
        selectedCaseId: caseId || undefined,
      };
    }
    case "create_note": {
      const caseId = pickCaseId(args.caseId as string | undefined) ?? "";
      const now = nowIso();
      const note: Note = {
        id: crypto.randomUUID(),
        title: args.title as string,
        content: args.content as string,
        category: (args.category as Note["category"]) ?? "case-notes",
        tags: Array.isArray(args.tags) ? (args.tags as string[]) : [],
        caseId,
        isPinned: (args.isPinned as boolean) ?? false,
        createdAt: now,
        updatedAt: now,
      };
      db.notes.set(note.id, note);
      if (caseId) state.selectedCaseId = caseId;
      return {
        message: `Created note ${note.id}`,
        selectedCaseId: caseId || undefined,
      };
    }
    default:
      return { message: `Unknown tool ${name}` };
  }
}

export async function autoPopulateFromDocument(
  params: AutoPopulateParams,
): Promise<{ caseId?: string; log: string[] }> {
  const { openai, entry, text } = params;
  const state: { selectedCaseId?: string } = {};
  const log: string[] = [];

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You are an ingestion orchestrator. Decide what this document represents (filing, order, hearing notice, correspondence, evidence, etc). " +
        "Call the provided tools to create structured records. Prefer linking to an existing case if a case number or party names match. " +
        "Be conservative: only create records when information is explicit. Extract dates directly from the document. Keep notes brief.",
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text:
            `File: ${entry.filename}\nCategory: ${entry.category}\nDetected dates: ${entry.dates.join(", ") || "none"}\n` +
            `Existing data snapshot:\n${JSON.stringify(snapshotExistingData(), null, 2)}\n\n` +
            `Document text (truncated):\n${truncateText(text)}`,
        },
      ],
    },
  ];

  for (let i = 0; i < 8; i++) {
    const completion = await openai.chat.completions.create({
      model: getConfig("VLM_MODEL") || "gpt-4o-mini",
      messages,
      tools: ingestionTools,
    });

    const choice = completion.choices[0];
    if (choice.message.tool_calls?.length) {
      messages.push(choice.message);
      for (const toolCall of choice.message.tool_calls) {
        if (toolCall.type !== "function") continue;
        try {
          const args = toolCall.function.arguments
            ? (JSON.parse(toolCall.function.arguments) as Record<
                string,
                unknown
              >)
            : {};
          const result = executeTool(toolCall.function.name, args, state);
          if (result.selectedCaseId)
            state.selectedCaseId = result.selectedCaseId;
          log.push(`${toolCall.function.name}: ${result.message}`);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          const errorMsg = `Tool ${toolCall.function.name} failed: ${message}`;
          log.push(errorMsg);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: errorMsg }),
          });
        }
      }
      continue;
    }

    // Model is done
    if (choice.message.content) log.push(choice.message.content);
    break;
  }

  return { caseId: state.selectedCaseId, log };
}
