import { AutoRouter, cors } from "itty-router";
import { join, basename, relative } from "path";
import { readFile, writeFile, mkdir, readdir, stat } from "fs/promises";
import OpenAI from "openai";
import {
  db,
  type Case,
  type Party,
  type Filing,
  type Contact,
  type Deadline,
  type FinancialEntry,
  type Evidence,
  type Note,
  type EstatePlan,
  type Beneficiary,
  type EstateAsset,
  type EstateDocument,
} from "./db";
import {
  ingestPdfBuffer,
  type DocumentEntry,
  deriveCategory,
  generateId,
} from "./ingest";
import { autoPopulateFromDocument } from "./ingestion-agent";
import { executeSearch, type EntityType } from "./search";
import {
  initScheduler,
  getSchedulerStatus,
  triggerEvaluation,
} from "./scheduler";
import {
  registerDeviceToken,
  getDeviceTokens,
  removeDeviceToken,
  registerSmsRecipient,
  getSmsRecipients,
  removeSmsRecipient,
  getChannelsStatus,
} from "./notifications";
import { configRouter } from "./config-api";
import { securityRouter } from "./security-api";
import { getConfig } from "./config";
import { researchRouter } from "./research";
import { handleResearchChat } from "./research-agent";
import { cosine_similarity_dataspace } from "wasm-similarity";
import {
  generateCaseSummary,
  generateEvidenceAnalysis,
  generateFinancialReport,
  generateChronologyReport,
} from "./reports.js";

const __dir =
  import.meta.dir ??
  import.meta.dirname ??
  new URL(".", import.meta.url).pathname;

// Configurable root for data files. In Electron production mode,
// PROSEVA_DATA_DIR points to the app's userData directory.
// Defaults to the project-relative layout used in development.
const appRoot = process.env.PROSEVA_DATA_DIR ?? join(__dir, "../..");

const { preflight, corsify } = cors();

const ALLOWED_WHEN_DB_LOCKED = new Set([
  "/api/security/status",
  "/api/security/recovery-key",
]);

const requireUnlockedDatabase = (request: Request) => {
  if (request.method === "OPTIONS") return;
  if (!db.isLocked()) return;

  const pathname = new URL(request.url).pathname;
  if (ALLOWED_WHEN_DB_LOCKED.has(pathname)) return;

  return new Response(
    JSON.stringify({
      error: "Database is locked. Provide a valid recovery key to continue.",
      code: "DB_LOCKED",
      lockReason: db.securityStatus().lockReason,
    }),
    {
      status: 423,
      headers: { "content-type": "application/json" },
    },
  );
};

const persistAfterMutation = (response: Response, request: Request) => {
  if (request.method !== "GET") db.persist();
  return response;
};

type IngestionStatus = {
  active: boolean;
  directory: string;
  running: boolean;
  lastRunStarted: string | null;
  lastRunFinished: string | null;
  added: number;
  skipped: number;
  errors: number;
};

const ingestionStatus: IngestionStatus = {
  active: Boolean(getConfig("AUTO_INGEST_DIR")),
  directory: getConfig("AUTO_INGEST_DIR") ?? "",
  running: false,
  lastRunStarted: null,
  lastRunFinished: null,
  added: 0,
  skipped: 0,
  errors: 0,
};

export const router = AutoRouter({
  before: [preflight, requireUnlockedDatabase],
  after: [persistAfterMutation, corsify],
  base: "/api",
});

// Kick off optional bulk ingestion when AUTO_INGEST_DIR is set.
void maybeAutoIngestFromEnv().catch((err) =>
  console.error("[auto-ingest] Failed to start", err),
);

async function listPdfFilesRecursive(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listPdfFilesRecursive(full)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
      files.push(full);
    }
  }
  return files;
}

async function maybeAutoIngestFromEnv(): Promise<void> {
  const sourceDir = getConfig("AUTO_INGEST_DIR");
  if (!sourceDir) return;

  ingestionStatus.active = true;
  ingestionStatus.directory = sourceDir;
  ingestionStatus.running = true;
  ingestionStatus.added = 0;
  ingestionStatus.skipped = 0;
  ingestionStatus.errors = 0;
  ingestionStatus.lastRunStarted = new Date().toISOString();

  const baseDir = join(appRoot, "server/app-data");
  await mkdir(baseDir, { recursive: true });
  const indexPath = join(baseDir, "index.json");

  let existingEntries: DocumentEntry[] = [];
  try {
    const raw = await readFile(indexPath, "utf-8");
    existingEntries = JSON.parse(raw);
  } catch {
    existingEntries = [];
  }

  const existingSignatures = new Set(
    existingEntries.map((e) => `${e.filename}|${e.fileSize}`),
  );

  let openai: OpenAI;
  try {
    openai = new OpenAI();
  } catch (err) {
    console.error("[auto-ingest] OpenAI client init failed:", err);
    ingestionStatus.running = false;
    ingestionStatus.lastRunFinished = new Date().toISOString();
    return;
  }
  let pdfFiles: string[];
  try {
    pdfFiles = await listPdfFilesRecursive(sourceDir);
  } catch (err) {
    console.error(`[auto-ingest] Failed to read directory ${sourceDir}:`, err);
    ingestionStatus.running = false;
    ingestionStatus.lastRunFinished = new Date().toISOString();
    return;
  }

  const newEntries: DocumentEntry[] = [];

  for (const filePath of pdfFiles) {
    const fileStats = await stat(filePath);
    const filename = basename(filePath);
    const signature = `${filename}|${fileStats.size}`;
    if (existingSignatures.has(signature)) {
      ingestionStatus.skipped += 1;
      continue;
    }

    const derivedCategory = deriveCategory(filePath, sourceDir);
    const category =
      derivedCategory && derivedCategory !== filename
        ? derivedCategory
        : "_bulk_import";

    // Skip if destination file already exists to avoid overwriting prior imports.
    const categoryDir = join(baseDir, category);
    try {
      await stat(join(categoryDir, filename));
      ingestionStatus.skipped += 1;
      continue;
    } catch { /* file doesn't exist yet, proceed with ingestion */ }

    const buffer = await readFile(filePath);
    const { entry, text } = await ingestPdfBuffer(
      buffer,
      filename,
      category,
      baseDir,
      openai,
    );

    let finalEntry = entry;
    try {
      const { caseId } = await autoPopulateFromDocument({
        openai,
        entry,
        text,
      });
      if (caseId) finalEntry = { ...entry, caseId };
    } catch (err) {
      console.error("Structured auto-ingest failed (auto ingester)", err);
      ingestionStatus.errors += 1;
    }

    existingSignatures.add(signature);
    newEntries.push(finalEntry);
    ingestionStatus.added += 1;
  }

  if (newEntries.length > 0) {
    const all = [...existingEntries, ...newEntries];
    await writeFile(indexPath, JSON.stringify(all, null, 2));
    console.log(
      `[auto-ingest] Added ${newEntries.length} documents from ${sourceDir}`,
    );
  } else {
    console.log("[auto-ingest] No new documents found in source directory");
  }

  ingestionStatus.running = false;
  ingestionStatus.lastRunFinished = new Date().toISOString();
}

process.on("beforeExit", () => db.flush());
process.on("SIGINT", () => {
  db.flush();
  process.exit(0);
});
process.on("SIGTERM", () => {
  db.flush();
  process.exit(0);
});

const json201 = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
const notFound = () => new Response("Not found", { status: 404 });
const noContent = () => new Response(null, { status: 204 });

// --- Search ---
router.get("/search", async (req) => {
  const url = new URL(req.url);
  const query = url.searchParams.get("q") ?? "";

  if (!query.trim()) {
    return new Response(
      JSON.stringify({ error: "Query parameter 'q' is required" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const typesParam = url.searchParams.get("types");
  const types = typesParam
    ? (typesParam.split(",").filter(Boolean) as EntityType[])
    : undefined;

  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  const offsetParam = url.searchParams.get("offset");
  const offset = offsetParam ? parseInt(offsetParam, 10) : undefined;

  const caseId = url.searchParams.get("caseId") ?? undefined;

  const params = {
    query: query.trim(),
    types,
    limit,
    offset,
    caseId,
  };

  const result = await executeSearch(params);
  return new Response(JSON.stringify(result), {
    headers: { "content-type": "application/json" },
  });
});

// --- Cases ---
router
  .get("/cases", () => [...db.cases.values()])
  .post("/cases", async (req) => {
    const body = await req.json();
    const now = new Date().toISOString();
    const c: Case = {
      id: crypto.randomUUID(),
      name: body.name,
      caseNumber: body.caseNumber ?? "",
      court: body.court ?? "",
      caseType: body.caseType ?? "",
      status: body.status ?? "active",
      parties: [],
      filings: [],
      notes: body.notes ?? "",
      createdAt: now,
      updatedAt: now,
    };
    db.cases.set(c.id, c);
    return json201(c);
  })
  .get("/cases/:caseId", ({ params }) => {
    const c = db.cases.get(params.caseId);
    return c ?? notFound();
  })
  .patch("/cases/:caseId", async (req) => {
    const c = db.cases.get(req.params.caseId);
    if (!c) return notFound();
    const body = await req.json();
    for (const key of [
      "name",
      "caseNumber",
      "court",
      "caseType",
      "status",
      "notes",
    ] as const) {
      if (body[key] !== undefined) (c as Record<string, unknown>)[key] = body[key];
    }
    c.updatedAt = new Date().toISOString();
    return c;
  })
  .delete("/cases/:caseId", ({ params }) => {
    if (!db.cases.has(params.caseId)) return notFound();
    db.cases.delete(params.caseId);
    return noContent();
  })
  .post("/cases/:caseId/parties", async (req) => {
    const c = db.cases.get(req.params.caseId);
    if (!c) return notFound();
    const body = await req.json();
    const party: Party = {
      id: crypto.randomUUID(),
      name: body.name,
      role: body.role,
      contact: body.contact ?? "",
    };
    c.parties.push(party);
    c.updatedAt = new Date().toISOString();
    return json201(party);
  })
  .delete("/cases/:caseId/parties/:partyId", ({ params }) => {
    const c = db.cases.get(params.caseId);
    if (!c) return notFound();
    const idx = c.parties.findIndex((p) => p.id === params.partyId);
    if (idx === -1) return notFound();
    c.parties.splice(idx, 1);
    c.updatedAt = new Date().toISOString();
    return noContent();
  })
  .post("/cases/:caseId/filings", async (req) => {
    const c = db.cases.get(req.params.caseId);
    if (!c) return notFound();
    const body = await req.json();
    const filing: Filing = {
      id: crypto.randomUUID(),
      title: body.title,
      date: body.date,
      type: body.type ?? "",
      notes: body.notes ?? "",
    };
    c.filings.push(filing);
    c.updatedAt = new Date().toISOString();
    return json201(filing);
  })
  .delete("/cases/:caseId/filings/:filingId", ({ params }) => {
    const c = db.cases.get(params.caseId);
    if (!c) return notFound();
    const idx = c.filings.findIndex((f) => f.id === params.filingId);
    if (idx === -1) return notFound();
    c.filings.splice(idx, 1);
    c.updatedAt = new Date().toISOString();
    return noContent();
  })

  // --- Contacts ---
  .get("/contacts", () => [...db.contacts.values()])
  .post("/contacts", async (req) => {
    const body = await req.json();
    const c: Contact = {
      id: crypto.randomUUID(),
      name: body.name,
      role: body.role,
      organization: body.organization ?? "",
      phone: body.phone ?? "",
      email: body.email ?? "",
      address: body.address ?? "",
      notes: body.notes ?? "",
      caseId: body.caseId ?? "",
    };
    db.contacts.set(c.id, c);
    return json201(c);
  })
  .get("/contacts/:contactId", ({ params }) => {
    const c = db.contacts.get(params.contactId);
    return c ?? notFound();
  })
  .patch("/contacts/:contactId", async (req) => {
    const c = db.contacts.get(req.params.contactId);
    if (!c) return notFound();
    const body = await req.json();
    for (const key of [
      "name",
      "role",
      "organization",
      "phone",
      "email",
      "address",
      "notes",
      "caseId",
    ] as const) {
      if (body[key] !== undefined) (c as Record<string, unknown>)[key] = body[key];
    }
    return c;
  })
  .delete("/contacts/:contactId", ({ params }) => {
    if (!db.contacts.has(params.contactId)) return notFound();
    db.contacts.delete(params.contactId);
    return noContent();
  })

  // --- Deadlines ---
  .get("/deadlines", () => [...db.deadlines.values()])
  .post("/deadlines", async (req) => {
    const body = await req.json();
    const d: Deadline = {
      id: crypto.randomUUID(),
      caseId: body.caseId ?? "",
      title: body.title,
      date: body.date,
      type: body.type ?? "other",
      completed: body.completed ?? false,
    };
    db.deadlines.set(d.id, d);
    return json201(d);
  })
  .get("/deadlines/:deadlineId", ({ params }) => {
    const d = db.deadlines.get(params.deadlineId);
    return d ?? notFound();
  })
  .patch("/deadlines/:deadlineId", async (req) => {
    const d = db.deadlines.get(req.params.deadlineId);
    if (!d) return notFound();
    const body = await req.json();
    for (const key of [
      "title",
      "date",
      "type",
      "completed",
      "caseId",
    ] as const) {
      if (body[key] !== undefined) (d as Record<string, unknown>)[key] = body[key];
    }
    return d;
  })
  .delete("/deadlines/:deadlineId", ({ params }) => {
    if (!db.deadlines.has(params.deadlineId)) return notFound();
    db.deadlines.delete(params.deadlineId);
    return noContent();
  })
  .post("/deadlines/:deadlineId/toggle-complete", ({ params }) => {
    const d = db.deadlines.get(params.deadlineId);
    if (!d) return notFound();
    d.completed = !d.completed;
    return d;
  })

  // --- Finances ---
  .get("/finances", () => [...db.finances.values()])
  .post("/finances", async (req) => {
    const body = await req.json();
    const e: FinancialEntry = {
      id: crypto.randomUUID(),
      category: body.category,
      subcategory: body.subcategory,
      amount: body.amount,
      frequency: body.frequency ?? "one-time",
      date: body.date,
      description: body.description ?? "",
    };
    db.finances.set(e.id, e);
    return json201(e);
  })
  .get("/finances/:entryId", ({ params }) => {
    const e = db.finances.get(params.entryId);
    return e ?? notFound();
  })
  .patch("/finances/:entryId", async (req) => {
    const e = db.finances.get(req.params.entryId);
    if (!e) return notFound();
    const body = await req.json();
    for (const key of [
      "category",
      "subcategory",
      "amount",
      "frequency",
      "date",
      "description",
    ] as const) {
      if (body[key] !== undefined) (e as Record<string, unknown>)[key] = body[key];
    }
    return e;
  })
  .delete("/finances/:entryId", ({ params }) => {
    if (!db.finances.has(params.entryId)) return notFound();
    db.finances.delete(params.entryId);
    return noContent();
  })

  // --- Evidences ---
  .get("/evidences", () => [...db.evidences.values()])
  .post("/evidences", async (req) => {
    const body = await req.json();
    const now = new Date().toISOString();
    const e: Evidence = {
      id: crypto.randomUUID(),
      caseId: body.caseId ?? "",
      exhibitNumber: body.exhibitNumber ?? "",
      title: body.title,
      description: body.description ?? "",
      type: body.type ?? "other",
      fileUrl: body.fileUrl ?? "",
      dateCollected: body.dateCollected ?? "",
      location: body.location ?? "",
      tags: body.tags ?? [],
      relevance: body.relevance ?? "medium",
      admissible: body.admissible ?? false,
      chain: body.chain ?? [],
      notes: body.notes ?? "",
      createdAt: now,
      updatedAt: now,
    };
    db.evidences.set(e.id, e);
    return json201(e);
  })
  .get("/evidences/:evidenceId", ({ params }) => {
    const e = db.evidences.get(params.evidenceId);
    return e ?? notFound();
  })
  .patch("/evidences/:evidenceId", async (req) => {
    const e = db.evidences.get(req.params.evidenceId);
    if (!e) return notFound();
    const body = await req.json();
    for (const key of [
      "caseId",
      "exhibitNumber",
      "title",
      "description",
      "type",
      "fileUrl",
      "dateCollected",
      "location",
      "tags",
      "relevance",
      "admissible",
      "chain",
      "notes",
      "updatedAt",
    ] as const) {
      if (body[key] !== undefined) (e as Record<string, unknown>)[key] = body[key];
    }
    return e;
  })
  .delete("/evidences/:evidenceId", ({ params }) => {
    if (!db.evidences.has(params.evidenceId)) return notFound();
    db.evidences.delete(params.evidenceId);
    return noContent();
  })

  // --- Filings ---
  .get("/filings", () => [...db.filings.values()])
  .post("/filings", async (req) => {
    const body = await req.json();
    const f: Filing = {
      id: crypto.randomUUID(),
      title: body.title,
      date: body.date,
      type: body.type ?? "",
      notes: body.notes ?? "",
      caseId: body.caseId ?? "",
    };
    db.filings.set(f.id, f);
    return json201(f);
  })
  .get("/filings/:filingId", ({ params }) => {
    const f = db.filings.get(params.filingId);
    return f ?? notFound();
  })
  .patch("/filings/:filingId", async (req) => {
    const f = db.filings.get(req.params.filingId);
    if (!f) return notFound();
    const body = await req.json();
    for (const key of ["title", "date", "type", "notes", "caseId"] as const) {
      if (body[key] !== undefined) (f as Record<string, unknown>)[key] = body[key];
    }
    return f;
  })
  .delete("/filings/:filingId", ({ params }) => {
    if (!db.filings.has(params.filingId)) return notFound();
    db.filings.delete(params.filingId);
    return noContent();
  })

  // --- Notes ---
  .get("/notes", () => [...db.notes.values()])
  .post("/notes", async (req) => {
    const body = await req.json();
    const now = new Date().toISOString();
    const n: Note = {
      id: crypto.randomUUID(),
      title: body.title,
      content: body.content,
      category: body.category,
      tags: body.tags ?? [],
      caseId: body.caseId ?? "",
      isPinned: body.isPinned ?? false,
      createdAt: now,
      updatedAt: now,
    };
    db.notes.set(n.id, n);
    return json201(n);
  })
  .get("/notes/:noteId", ({ params }) => {
    const n = db.notes.get(params.noteId);
    return n ?? notFound();
  })
  .patch("/notes/:noteId", async (req) => {
    const n = db.notes.get(req.params.noteId);
    if (!n) return notFound();
    const body = await req.json();
    for (const key of [
      "title",
      "content",
      "category",
      "tags",
      "caseId",
      "isPinned",
    ] as const) {
      if (body[key] !== undefined) (n as Record<string, unknown>)[key] = body[key];
    }
    n.updatedAt = new Date().toISOString();
    return n;
  })
  .delete("/notes/:noteId", ({ params }) => {
    if (!db.notes.has(params.noteId)) return notFound();
    db.notes.delete(params.noteId);
    return noContent();
  })

  // --- Chat ---
  .post("/chat", async (req) => {
    const { messages } = (await req.json()) as {
      messages: { role: string; content: string }[];
    };
    const openai = new OpenAI();

    const systemPrompt = `You are a knowledgeable legal assistant for pro se (self-represented) litigants in Virginia, writing in the style of Alan Dershowitz — vigorous, direct, and intellectually fearless. Frame legal issues as arguments, not summaries. Take positions on strategy, challenge weak reasoning, and use vivid analogies to make complex procedural points accessible. Be assertive and occasionally provocative, but always grounded in the law. Write with the confidence of someone who has argued before the Supreme Court and the clarity of someone who teaches first-year law students.

You do NOT provide legal advice — you provide legal information and guidance. Always remind users to verify information with their local court clerk when appropriate.

You have access to tools that let you look up the user's cases, deadlines, contacts, finances, and documents. Use them to give contextual, data-driven answers whenever relevant.`;

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
    ];

    const baseDir = join(appRoot, "case-data/case-documents-app");
    const indexPath = join(baseDir, "index.json");

    const executeTool = async (
      name: string,
      args: Record<string, string>,
    ): Promise<string> => {
      switch (name) {
        case "GetCases":
          return JSON.stringify([...db.cases.values()]);
        case "GetDeadlines": {
          let deadlines = [...db.deadlines.values()];
          if (args.caseId)
            deadlines = deadlines.filter((d) => d.caseId === args.caseId);
          return JSON.stringify(deadlines);
        }
        case "GetContacts": {
          let contacts = [...db.contacts.values()];
          if (args.caseId)
            contacts = contacts.filter((c) => c.caseId === args.caseId);
          return JSON.stringify(contacts);
        }
        case "GetFinances":
          return JSON.stringify([...db.finances.values()]);
        case "GetDocuments": {
          try {
            const raw = await readFile(indexPath, "utf-8");
            const entries: DocumentEntry[] = JSON.parse(raw);
            return JSON.stringify(
              entries.map(({ id, title, category, pages }) => ({
                id,
                title,
                category,
                pages,
              })),
            );
          } catch {
            return JSON.stringify([]);
          }
        }
        case "GetDocumentText": {
          try {
            const raw = await readFile(indexPath, "utf-8");
            const entries: DocumentEntry[] = JSON.parse(raw);
            const doc = entries.find((e) => e.id === args.id);
            if (!doc) return JSON.stringify({ error: "Document not found" });
            const textPath = join(baseDir, doc.textFile);
            const text = await readFile(textPath, "utf-8");
            return JSON.stringify({ id: doc.id, title: doc.title, text });
          } catch {
            return JSON.stringify({ error: "Could not read document" });
          }
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

            // Apply filters
            if (args.query) {
              const q = args.query.toLowerCase();
              events = events.filter(
                (e: TimelineEvent) =>
                  e.title?.toLowerCase().includes(q) ||
                  e.details?.toLowerCase().includes(q) ||
                  e.party?.toLowerCase().includes(q),
              );
            }
            if (args.party) {
              events = events.filter((e: TimelineEvent) => e.party === args.party);
            }
            if (args.caseNumber) {
              events = events.filter(
                (e: TimelineEvent) => e.case?.number === args.caseNumber,
              );
            }
            if (args.isCritical !== undefined) {
              events = events.filter(
                (e: TimelineEvent) => e.isCritical === args.isCritical,
              );
            }
            if (args.startDate) {
              events = events.filter((e: TimelineEvent) => e.date && e.date >= args.startDate);
            }
            if (args.endDate) {
              events = events.filter((e: TimelineEvent) => e.date && e.date <= args.endDate);
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
            const topK = Number(args.topK) || 3;
            const embResponse = await openai.embeddings.create({
              model: getConfig("EMBEDDINGS_MODEL") || "text-embedding-3-small",
              input: args.query,
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
            for (let i = 0; i < ranked.length && scored.length < topK; i += 2) {
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
          return JSON.stringify({ error: "Unknown tool" });
      }
    };

    const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    // Tool-calling loop
    for (let i = 0; i < 10; i++) {
      const completion = await openai.chat.completions.create({
        model: getConfig("TEXT_MODEL_SMALL") || "gpt-4o-mini",
        messages: chatMessages,
        tools,
      });

      const choice = completion.choices[0];

      if (
        choice.finish_reason === "tool_calls" ||
        choice.message.tool_calls?.length
      ) {
        chatMessages.push(choice.message);
        for (const toolCall of choice.message.tool_calls!) {
          const result = await executeTool(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments),
          );
          chatMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }
        continue;
      }

      return { reply: choice.message.content };
    }

    return { reply: "Sorry, I was unable to complete the request." };
  })

  // --- Reports ---
  .post("/reports", async (req) => {
    const config = await req.json();

    // Route to appropriate generator
    switch (config.type) {
      case "case-summary":
        return generateCaseSummary(config);
      case "evidence-analysis":
        return generateEvidenceAnalysis(config);
      case "financial":
        return generateFinancialReport(config);
      case "chronology":
        return generateChronologyReport(config);
      default:
        return new Response("Invalid report type", { status: 400 });
    }
  })

  // --- Documents ---
  .get("/documents", async () => {
    const indexPath = join(
      appRoot,
      "case-data/case-documents-app/index.json",
    );
    try {
      const raw = await readFile(indexPath, "utf-8");
      return new Response(raw, {
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      return new Response("[]", {
        headers: { "Content-Type": "application/json" },
      });
    }
  })
  .post("/documents/upload", async (req) => {
    const formData = await req.formData();
    const category = (formData.get("category") as string) || "_new_filings";
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return new Response("No files provided", { status: 400 });
    }

    const baseDir = join(appRoot, "case-data/case-documents-app");
    await mkdir(baseDir, { recursive: true });

    const openai = new OpenAI();
    const indexPath = join(baseDir, "index.json");

    let existingEntries: DocumentEntry[] = [];
    try {
      const raw = await readFile(indexPath, "utf-8");
      existingEntries = JSON.parse(raw);
    } catch { /* index file doesn't exist yet */ }

    const newEntries: DocumentEntry[] = [];

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".pdf")) continue;
      const buffer = Buffer.from(await file.arrayBuffer());
      const { entry, text } = await ingestPdfBuffer(
        buffer,
        file.name,
        category,
        baseDir,
        openai,
      );

      let finalEntry = entry;
      try {
        const { caseId } = await autoPopulateFromDocument({
          openai,
          entry,
          text,
        });
        if (caseId) finalEntry = { ...entry, caseId };
      } catch (err) {
        console.error("Structured auto-ingest failed", err);
      }

      newEntries.push(finalEntry);
    }

    const allEntries = [...existingEntries, ...newEntries];
    await writeFile(indexPath, JSON.stringify(allEntries, null, 2));

    return json201(newEntries);
  })

  // --- Ingestion status ---
  .get("/ingest/status", () => {
    return new Response(JSON.stringify(ingestionStatus), {
      headers: { "Content-Type": "application/json" },
    });
  })

  // --- Scan directory for documents ---
  .post("/ingest/scan", async (req) => {
    try {
      const body = await req.json();
      const { directory } = body;

      if (!directory) {
        return new Response(
          JSON.stringify({ error: "directory is required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Verify OpenAI is configured
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        return new Response(
          JSON.stringify({ error: "OpenAI API key not configured" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Verify directory exists and is accessible
      try {
        const dirStat = await stat(directory);
        if (!dirStat.isDirectory()) {
          return new Response(
            JSON.stringify({ error: "Path is not a directory" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      } catch {
        return new Response(
          JSON.stringify({ error: "Directory not found or not accessible" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const startedAt = new Date().toISOString();
      const openai = new OpenAI({ apiKey: openaiApiKey });
      const baseDir = join(appRoot, "case-data/case-documents-app");
      const indexPath = join(baseDir, "index.json");

      // Load existing entries
      let existingEntries: DocumentEntry[] = [];
      try {
        const raw = await readFile(indexPath, "utf-8");
        existingEntries = JSON.parse(raw);
      } catch { /* index file doesn't exist yet */ }

      // Find all PDFs in directory recursively
      const { readdirSync, statSync } = await import("fs");
      const { resolve } = await import("path");

      function* walkSync(dir: string): Generator<string> {
        const files = readdirSync(dir);
        for (const file of files) {
          const pathToFile = resolve(dir, file);
          const isDirectory = statSync(pathToFile).isDirectory();
          if (isDirectory) {
            yield* walkSync(pathToFile);
          } else if (file.toLowerCase().endsWith(".pdf")) {
            yield pathToFile;
          }
        }
      }

      const pdfFiles = [...walkSync(directory)];
      let added = 0;
      let skipped = 0;
      let errors = 0;

      for (const pdfPath of pdfFiles) {
        try {
          const buffer = await readFile(pdfPath);
          const filename = basename(pdfPath);
          const category = deriveCategory(pdfPath, directory);

          // Check if already indexed
          const existingId = generateId(
            relative(baseDir, join(baseDir, category, filename)),
          );
          if (existingEntries.some((e) => e.id === existingId)) {
            skipped++;
            continue;
          }

          const { entry, text } = await ingestPdfBuffer(
            buffer,
            filename,
            category,
            baseDir,
            openai,
          );

          // Try auto-populate
          let finalEntry = entry;
          try {
            const { caseId } = await autoPopulateFromDocument({
              openai,
              entry,
              text,
            });
            if (caseId) finalEntry = { ...entry, caseId };
          } catch (err) {
            console.error("Auto-populate failed for", filename, err);
          }

          existingEntries.push(finalEntry);
          added++;
        } catch (err) {
          console.error("Failed to ingest", pdfPath, err);
          errors++;
        }
      }

      // Save updated index
      await writeFile(indexPath, JSON.stringify(existingEntries, null, 2));

      const finishedAt = new Date().toISOString();

      return new Response(
        JSON.stringify({
          status: "completed",
          added,
          skipped,
          errors,
          directory,
          startedAt,
          finishedAt,
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Scan failed",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  })

  // --- Device Tokens (FCM) ---
  .get("/device-tokens", () => {
    return new Response(JSON.stringify(getDeviceTokens()), {
      headers: { "Content-Type": "application/json" },
    });
  })
  .post("/device-tokens", async (req) => {
    const body = await req.json();
    if (!body.token || !body.platform) {
      return new Response(
        JSON.stringify({ error: "token and platform are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    const token = registerDeviceToken(body.token, body.platform);
    return json201(token);
  })
  .delete("/device-tokens/:tokenId", ({ params }) => {
    const removed = removeDeviceToken(params.tokenId);
    if (!removed) return notFound();
    return noContent();
  })

  // --- SMS Recipients ---
  .get("/sms-recipients", () => {
    return new Response(JSON.stringify(getSmsRecipients()), {
      headers: { "Content-Type": "application/json" },
    });
  })
  .post("/sms-recipients", async (req) => {
    const body = await req.json();
    if (!body.phone) {
      return new Response(JSON.stringify({ error: "phone is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const recipient = registerSmsRecipient(body.phone, body.name);
    return json201(recipient);
  })
  .delete("/sms-recipients/:recipientId", ({ params }) => {
    const removed = removeSmsRecipient(params.recipientId);
    if (!removed) return notFound();
    return noContent();
  })

  // --- Evaluations ---
  .get("/evaluations", () => {
    const evaluations = [...db.evaluations.values()].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return new Response(JSON.stringify(evaluations), {
      headers: { "Content-Type": "application/json" },
    });
  })
  .get("/evaluations/:evaluationId", ({ params }) => {
    const evaluation = db.evaluations.get(params.evaluationId);
    return evaluation ?? notFound();
  })
  .post("/evaluations/trigger", async () => {
    try {
      const result = await triggerEvaluation();
      return json201(result);
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Evaluation failed",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  })

  // --- Scheduler ---
  .get("/scheduler/status", () => {
    const status = getSchedulerStatus();
    const channels = getChannelsStatus();
    return new Response(JSON.stringify({ ...status, channels }), {
      headers: { "Content-Type": "application/json" },
    });
  });

// --- Estate Plans ---
router
  .get("/estate-plans", () => [...db.estatePlans.values()])
  .post("/estate-plans", async (req) => {
    const body = await req.json();
    const now = new Date().toISOString();
    const plan: EstatePlan = {
      id: crypto.randomUUID(),
      title: body.title ?? "Untitled Plan",
      status: body.status ?? "planning",
      testatorName: body.testatorName ?? "",
      testatorDateOfBirth: body.testatorDateOfBirth ?? "",
      testatorAddress: body.testatorAddress ?? "",
      executorName: body.executorName ?? "",
      executorPhone: body.executorPhone ?? "",
      executorEmail: body.executorEmail ?? "",
      guardianName: body.guardianName ?? "",
      guardianPhone: body.guardianPhone ?? "",
      beneficiaries: [],
      assets: [],
      documents: [],
      notes: body.notes ?? "",
      createdAt: now,
      updatedAt: now,
    };
    db.estatePlans.set(plan.id, plan);
    return json201(plan);
  })
  .get("/estate-plans/:planId", ({ params }) => {
    return db.estatePlans.get(params.planId) ?? notFound();
  })
  .patch("/estate-plans/:planId", async (req) => {
    const plan = db.estatePlans.get(req.params.planId);
    if (!plan) return notFound();
    const body = await req.json();
    for (const key of [
      "title",
      "status",
      "testatorName",
      "testatorDateOfBirth",
      "testatorAddress",
      "executorName",
      "executorPhone",
      "executorEmail",
      "guardianName",
      "guardianPhone",
      "notes",
    ] as const) {
      if (body[key] !== undefined) (plan as Record<string, unknown>)[key] = body[key];
    }
    plan.updatedAt = new Date().toISOString();
    return plan;
  })
  .delete("/estate-plans/:planId", ({ params }) => {
    if (!db.estatePlans.has(params.planId)) return notFound();
    db.estatePlans.delete(params.planId);
    return noContent();
  })
  // Beneficiaries
  .post("/estate-plans/:planId/beneficiaries", async (req) => {
    const plan = db.estatePlans.get(req.params.planId);
    if (!plan) return notFound();
    const body = await req.json();
    const b: Beneficiary = {
      id: crypto.randomUUID(),
      name: body.name ?? "",
      relationship: body.relationship ?? "",
      dateOfBirth: body.dateOfBirth ?? "",
      phone: body.phone ?? "",
      email: body.email ?? "",
      address: body.address ?? "",
      notes: body.notes ?? "",
    };
    plan.beneficiaries.push(b);
    plan.updatedAt = new Date().toISOString();
    return json201(b);
  })
  .delete("/estate-plans/:planId/beneficiaries/:id", ({ params }) => {
    const plan = db.estatePlans.get(params.planId);
    if (!plan) return notFound();
    const idx = plan.beneficiaries.findIndex((b) => b.id === params.id);
    if (idx === -1) return notFound();
    plan.beneficiaries.splice(idx, 1);
    plan.updatedAt = new Date().toISOString();
    return noContent();
  })
  // Assets
  .post("/estate-plans/:planId/assets", async (req) => {
    const plan = db.estatePlans.get(req.params.planId);
    if (!plan) return notFound();
    const body = await req.json();
    const a: EstateAsset = {
      id: crypto.randomUUID(),
      name: body.name ?? "",
      category: body.category ?? "other",
      estimatedValue: body.estimatedValue ?? 0,
      ownershipType: body.ownershipType ?? "",
      accountNumber: body.accountNumber ?? "",
      institution: body.institution ?? "",
      beneficiaryIds: body.beneficiaryIds ?? [],
      notes: body.notes ?? "",
    };
    plan.assets.push(a);
    plan.updatedAt = new Date().toISOString();
    return json201(a);
  })
  .delete("/estate-plans/:planId/assets/:id", ({ params }) => {
    const plan = db.estatePlans.get(params.planId);
    if (!plan) return notFound();
    const idx = plan.assets.findIndex((a) => a.id === params.id);
    if (idx === -1) return notFound();
    plan.assets.splice(idx, 1);
    plan.updatedAt = new Date().toISOString();
    return noContent();
  })
  // Documents
  .post("/estate-plans/:planId/documents", async (req) => {
    const plan = db.estatePlans.get(req.params.planId);
    if (!plan) return notFound();
    const body = await req.json();
    const now = new Date().toISOString();
    const d: EstateDocument = {
      id: crypto.randomUUID(),
      type: body.type ?? "other",
      title: body.title ?? "",
      status: body.status ?? "not-started",
      content: body.content ?? "",
      fieldValues: body.fieldValues ?? {},
      templateId: body.templateId ?? "",
      reviewDate: body.reviewDate ?? "",
      signedDate: body.signedDate ?? "",
      notes: body.notes ?? "",
      createdAt: now,
      updatedAt: now,
    };
    plan.documents.push(d);
    plan.updatedAt = new Date().toISOString();
    return json201(d);
  })
  .patch("/estate-plans/:planId/documents/:id", async (req) => {
    const plan = db.estatePlans.get(req.params.planId);
    if (!plan) return notFound();
    const doc = plan.documents.find((d) => d.id === req.params.id);
    if (!doc) return notFound();
    const body = await req.json();
    for (const key of [
      "type",
      "title",
      "status",
      "content",
      "fieldValues",
      "templateId",
      "reviewDate",
      "signedDate",
      "notes",
    ] as const) {
      if (body[key] !== undefined) (doc as Record<string, unknown>)[key] = body[key];
    }
    doc.updatedAt = new Date().toISOString();
    plan.updatedAt = new Date().toISOString();
    return doc;
  })
  .delete("/estate-plans/:planId/documents/:id", ({ params }) => {
    const plan = db.estatePlans.get(params.planId);
    if (!plan) return notFound();
    const idx = plan.documents.findIndex((d) => d.id === params.id);
    if (idx === -1) return notFound();
    plan.documents.splice(idx, 1);
    plan.updatedAt = new Date().toISOString();
    return noContent();
  });

// Mount config router
router.all("/config/*", configRouter.fetch);
router.all("/security/*", securityRouter.fetch);

// Research agent chat endpoint
router.post("/research/agent/chat", async (request: Request) => {
  try {
    const body = (await request.json()) as { messages?: Array<{ role: string; content: string }> };
    if (!body.messages || !Array.isArray(body.messages)) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const result = await handleResearchChat(
      body.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    );
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ResearchAgent] Error:", (err as Error)?.message);
    return new Response(
      JSON.stringify({
        reply: "An error occurred while processing your research request.",
        toolResults: [],
        error: (err as Error)?.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});

// Mount research router
router.all("/research/*", researchRouter.fetch);

// Initialize the scheduler on server startup
initScheduler();

// --- Static file serving for production Electron builds ---
const staticDir = process.env.PROSEVA_STATIC_DIR;
if (staticDir) {
  // Serve built frontend assets as a catch-all after API routes
  router.all("*", async (req) => {
    const url = new URL(req.url);
    const filePath = join(staticDir, url.pathname);

    // Try exact file first
    try {
      const fileStat = await stat(filePath);
      if (fileStat.isFile()) {
        const content = await readFile(filePath);
        const ext = filePath.split(".").pop() ?? "";
        const mimeTypes: Record<string, string> = {
          html: "text/html",
          js: "application/javascript",
          css: "text/css",
          json: "application/json",
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          svg: "image/svg+xml",
          ico: "image/x-icon",
          woff: "font/woff",
          woff2: "font/woff2",
          ttf: "font/ttf",
        };
        return new Response(content, {
          headers: {
            "content-type": mimeTypes[ext] ?? "application/octet-stream",
          },
        });
      }
    } catch {
      // File not found, fall through to index.html
    }

    // SPA fallback: serve index.html for non-file routes
    try {
      const indexHtml = await readFile(join(staticDir, "index.html"));
      return new Response(indexHtml, {
        headers: { "content-type": "text/html" },
      });
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  });
}

const port = parseInt(process.env.PORT || "3001", 10);

if (import.meta.main) {
  console.log(`ProSeVA server running on http://localhost:${port}`);
}

export default {
  port,
  fetch: router.fetch,
};
