import { AutoRouter, cors } from "itty-router";
import { join, basename, relative } from "path";
import { readFile, writeFile, mkdir, readdir, stat, unlink } from "fs/promises";
import OpenAI from "openai";
import {
  db,
  initDb,
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
  type FaxJob,
} from "./db";
import { sendFax, getFaxProvider } from "./fax";
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
import { authRouter, verifyToken } from "./auth-api";
import { getConfig } from "./config";
import { researchRouter } from "./research";
import { handleResearchChat } from "./research-agent";
import { cosine_similarity_dataspace, ensureWasmSimilarityInit } from "./wasm-similarity-init";
import { getChatSystemPrompt } from "./prompts";
import {
  generateCaseSummary,
  generateEvidenceAnalysis,
  generateFinancialReport,
  generateChronologyReport,
} from "./reports.js";
import { analyzeCaseGraph, compressCaseGraphForPrompt } from "./chat-graph";
import {
  asIttyRoute,
  created as openapiCreated,
  json,
  noContent as openapiNoContent,
  notFound as openapiNotFound,
  openapiFormat,
} from "./openapi";

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
  "/api/health",
  "/api/security/status",
  "/api/security/recovery-key",
  "/api/security/setup-passphrase",
  "/api/security/verify-passphrase",
  "/api/auth/login",
]);

const UNAUTHENTICATED_ROUTES = new Set([
  "/api/health",
  "/api/security/status",
  "/api/security/verify-passphrase",
  "/api/auth/login",
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

const requireAuthentication = async (request: Request) => {
  if (request.method === "OPTIONS") return;

  const pathname = new URL(request.url).pathname;

  // Skip authentication for always-public routes
  if (UNAUTHENTICATED_ROUTES.has(pathname)) return;

  // setup-passphrase is only unauthenticated during first-run (no passphrase yet)
  if (
    pathname === "/api/security/setup-passphrase" &&
    !db.serverConfig.has("passphrase_hash")
  )
    return;

  // recovery-key is only unauthenticated when the DB is locked (can't login)
  if (pathname === "/api/security/recovery-key" && db.isLocked()) return;

  // Get Authorization header
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return new Response(
      JSON.stringify({
        error: "Authentication required. Please provide a valid Bearer token.",
        code: "AUTH_REQUIRED",
      }),
      {
        status: 401,
        headers: { "content-type": "application/json" },
      },
    );
  }

  // Verify Bearer token format
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    return new Response(
      JSON.stringify({
        error: "Invalid Authorization header format. Use 'Bearer <token>'.",
        code: "INVALID_AUTH_HEADER",
      }),
      {
        status: 401,
        headers: { "content-type": "application/json" },
      },
    );
  }

  const token = match[1];

  // Verify token
  const valid = await verifyToken(token);
  if (!valid) {
    return new Response(
      JSON.stringify({
        error: "Invalid or expired token.",
        code: "INVALID_TOKEN",
      }),
      {
        status: 401,
        headers: { "content-type": "application/json" },
      },
    );
  }

  // Token is valid, continue
  return;
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
  format: openapiFormat,
  before: [preflight, requireAuthentication, requireUnlockedDatabase],
  finally: [persistAfterMutation, corsify],
  base: "/api",
});

router.get(
  "/health",
  asIttyRoute("get", "/health", () => ({ status: "ok" })),
);

// Initialize WASM modules and database before handling any requests.
ensureWasmSimilarityInit();
await initDb();

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
    openai = new OpenAI({
      apiKey: getConfig('OPENAI_API_KEY'),
      baseURL: getConfig('OPENAI_ENDPOINT'),
    });


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
    } catch {
      /* file doesn't exist yet, proceed with ingestion */
    }

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

process.on("beforeExit", () => void db.flush());
process.on("SIGINT", () => {
  void db.flush().then(() => process.exit(0));
});
process.on("SIGTERM", () => {
  void db.flush().then(() => process.exit(0));
});

const json201 = <T>(data: T) => openapiCreated(data);
const notFound = () => openapiNotFound();
const noContent = () => openapiNoContent();

// --- Search ---
router.get(
  "/search",
  asIttyRoute("get", "/search", async (req) => {
    const url = new URL(req.url);
    const query = url.searchParams.get("q") ?? "";

    if (!query.trim()) {
      return json(400, { error: "Query parameter 'q' is required" });
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
    return result;
  }),
);

// --- Cases ---
router
  .get(
    "/cases",
    asIttyRoute("get", "/cases", () => [...db.cases.values()]),
  )
  .post(
    "/cases",
    asIttyRoute("post", "/cases", async (req) => {
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
    }),
  )
  .get(
    "/cases/:caseId",
    asIttyRoute("get", "/cases/:caseId", ({ params }) => {
    const c = db.cases.get(params.caseId);
    return c ?? notFound();
    }),
  )
  .patch(
    "/cases/:caseId",
    asIttyRoute("patch", "/cases/:caseId", async (req) => {
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
      if (body[key] !== undefined)
        (c as Record<string, unknown>)[key] = body[key];
    }
    c.updatedAt = new Date().toISOString();
    return c;
    }),
  )
  .delete(
    "/cases/:caseId",
    asIttyRoute("delete", "/cases/:caseId", ({ params }) => {
    if (!db.cases.has(params.caseId)) return notFound();
    db.cases.delete(params.caseId);
    return noContent();
    }),
  )
  .post(
    "/cases/:caseId/parties",
    asIttyRoute("post", "/cases/:caseId/parties", async (req) => {
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
    }),
  )
  .delete(
    "/cases/:caseId/parties/:partyId",
    asIttyRoute("delete", "/cases/:caseId/parties/:partyId", ({ params }) => {
    const c = db.cases.get(params.caseId);
    if (!c) return notFound();
    const idx = c.parties.findIndex((p) => p.id === params.partyId);
    if (idx === -1) return notFound();
    c.parties.splice(idx, 1);
    c.updatedAt = new Date().toISOString();
    return noContent();
    }),
  )
  .post(
    "/cases/:caseId/filings",
    asIttyRoute("post", "/cases/:caseId/filings", async (req) => {
    const c = db.cases.get(req.params.caseId);
    if (!c) return notFound();
    const body = await req.json();
    const filing: Filing = {
      id: crypto.randomUUID(),
      title: body.title,
      date: body.date,
      type: body.type ?? "",
      notes: body.notes ?? "",
      caseId: req.params.caseId,
    };
    c.filings.push(filing);
    c.updatedAt = new Date().toISOString();
    return json201(filing);
    }),
  )
  .delete(
    "/cases/:caseId/filings/:filingId",
    asIttyRoute("delete", "/cases/:caseId/filings/:filingId", ({ params }) => {
    const c = db.cases.get(params.caseId);
    if (!c) return notFound();
    const idx = c.filings.findIndex((f) => f.id === params.filingId);
    if (idx === -1) return notFound();
    c.filings.splice(idx, 1);
    c.updatedAt = new Date().toISOString();
    return noContent();
    }),
  )

  // --- Contacts ---
  .get(
    "/contacts",
    asIttyRoute("get", "/contacts", () => [...db.contacts.values()]),
  )
  .post(
    "/contacts",
    asIttyRoute("post", "/contacts", async (req) => {
    const body = await req.json();
    const c: Contact = {
      id: crypto.randomUUID(),
      name: body.name,
      role: body.role,
      organization: body.organization ?? "",
      phone: body.phone ?? "",
      fax: body.fax ?? "",
      email: body.email ?? "",
      address: body.address ?? "",
      notes: body.notes ?? "",
      caseId: body.caseId ?? "",
    };
    db.contacts.set(c.id, c);
    return json201(c);
    }),
  )
  .get(
    "/contacts/:contactId",
    asIttyRoute("get", "/contacts/:contactId", ({ params }) => {
    const c = db.contacts.get(params.contactId);
    return c ?? notFound();
    }),
  )
  .patch(
    "/contacts/:contactId",
    asIttyRoute("patch", "/contacts/:contactId", async (req) => {
    const c = db.contacts.get(req.params.contactId);
    if (!c) return notFound();
    const body = await req.json();
    for (const key of [
      "name",
      "role",
      "organization",
      "phone",
      "fax",
      "email",
      "address",
      "notes",
      "caseId",
    ] as const) {
      if (body[key] !== undefined)
        (c as Record<string, unknown>)[key] = body[key];
    }
    return c;
    }),
  )
  .delete(
    "/contacts/:contactId",
    asIttyRoute("delete", "/contacts/:contactId", ({ params }) => {
    if (!db.contacts.has(params.contactId)) return notFound();
    db.contacts.delete(params.contactId);
    return noContent();
    }),
  )

  // --- Deadlines ---
  .get(
    "/deadlines",
    asIttyRoute("get", "/deadlines", () => [...db.deadlines.values()]),
  )
  .post(
    "/deadlines",
    asIttyRoute("post", "/deadlines", async (req) => {
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
    }),
  )
  .get(
    "/deadlines/:deadlineId",
    asIttyRoute("get", "/deadlines/:deadlineId", ({ params }) => {
    const d = db.deadlines.get(params.deadlineId);
    return d ?? notFound();
    }),
  )
  .patch(
    "/deadlines/:deadlineId",
    asIttyRoute("patch", "/deadlines/:deadlineId", async (req) => {
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
      if (body[key] !== undefined)
        (d as Record<string, unknown>)[key] = body[key];
    }
    return d;
    }),
  )
  .delete(
    "/deadlines/:deadlineId",
    asIttyRoute("delete", "/deadlines/:deadlineId", ({ params }) => {
    if (!db.deadlines.has(params.deadlineId)) return notFound();
    db.deadlines.delete(params.deadlineId);
    return noContent();
    }),
  )
  .post(
    "/deadlines/:deadlineId/toggle-complete",
    asIttyRoute(
      "post",
      "/deadlines/:deadlineId/toggle-complete",
      ({ params }) => {
    const d = db.deadlines.get(params.deadlineId);
    if (!d) return notFound();
    d.completed = !d.completed;
    return d;
      },
    ),
  )

  // --- Finances ---
  .get(
    "/finances",
    asIttyRoute("get", "/finances", () => [...db.finances.values()]),
  )
  .post(
    "/finances",
    asIttyRoute("post", "/finances", async (req) => {
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
    }),
  )
  .get(
    "/finances/:entryId",
    asIttyRoute("get", "/finances/:entryId", ({ params }) => {
    const e = db.finances.get(params.entryId);
    return e ?? notFound();
    }),
  )
  .patch(
    "/finances/:entryId",
    asIttyRoute("patch", "/finances/:entryId", async (req) => {
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
      if (body[key] !== undefined)
        (e as Record<string, unknown>)[key] = body[key];
    }
    return e;
    }),
  )
  .delete(
    "/finances/:entryId",
    asIttyRoute("delete", "/finances/:entryId", ({ params }) => {
    if (!db.finances.has(params.entryId)) return notFound();
    db.finances.delete(params.entryId);
    return noContent();
    }),
  )

  // --- Evidences ---
  .get(
    "/evidences",
    asIttyRoute("get", "/evidences", () => [...db.evidences.values()]),
  )
  .post(
    "/evidences",
    asIttyRoute("post", "/evidences", async (req) => {
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
    }),
  )
  .get(
    "/evidences/:evidenceId",
    asIttyRoute("get", "/evidences/:evidenceId", ({ params }) => {
    const e = db.evidences.get(params.evidenceId);
    return e ?? notFound();
    }),
  )
  .patch(
    "/evidences/:evidenceId",
    asIttyRoute("patch", "/evidences/:evidenceId", async (req) => {
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
      if (body[key] !== undefined)
        (e as Record<string, unknown>)[key] = body[key];
    }
    return e;
    }),
  )
  .delete(
    "/evidences/:evidenceId",
    asIttyRoute("delete", "/evidences/:evidenceId", ({ params }) => {
    if (!db.evidences.has(params.evidenceId)) return notFound();
    db.evidences.delete(params.evidenceId);
    return noContent();
    }),
  )

  // --- Filings ---
  .get(
    "/filings",
    asIttyRoute("get", "/filings", () => [...db.filings.values()]),
  )
  .post(
    "/filings",
    asIttyRoute("post", "/filings", async (req) => {
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
    }),
  )
  .get(
    "/filings/:filingId",
    asIttyRoute("get", "/filings/:filingId", ({ params }) => {
    const f = db.filings.get(params.filingId);
    return f ?? notFound();
    }),
  )
  .patch(
    "/filings/:filingId",
    asIttyRoute("patch", "/filings/:filingId", async (req) => {
    const f = db.filings.get(req.params.filingId);
    if (!f) return notFound();
    const body = await req.json();
    for (const key of ["title", "date", "type", "notes", "caseId"] as const) {
      if (body[key] !== undefined)
        (f as Record<string, unknown>)[key] = body[key];
    }
    return f;
    }),
  )
  .delete(
    "/filings/:filingId",
    asIttyRoute("delete", "/filings/:filingId", ({ params }) => {
    if (!db.filings.has(params.filingId)) return notFound();
    db.filings.delete(params.filingId);
    return noContent();
    }),
  )

  // --- Notes ---
  .get("/notes", asIttyRoute("get", "/notes", () => [...db.notes.values()]))
  .post(
    "/notes",
    asIttyRoute("post", "/notes", async (req) => {
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
    }),
  )
  .get(
    "/notes/:noteId",
    asIttyRoute("get", "/notes/:noteId", ({ params }) => {
    const n = db.notes.get(params.noteId);
    return n ?? notFound();
    }),
  )
  .patch(
    "/notes/:noteId",
    asIttyRoute("patch", "/notes/:noteId", async (req) => {
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
      if (body[key] !== undefined)
        (n as Record<string, unknown>)[key] = body[key];
    }
    n.updatedAt = new Date().toISOString();
    return n;
    }),
  )
  .delete(
    "/notes/:noteId",
    asIttyRoute("delete", "/notes/:noteId", ({ params }) => {
    if (!db.notes.has(params.noteId)) return notFound();
    db.notes.delete(params.noteId);
    return noContent();
    }),
  )

  // --- Chat ---
  .post("/chat", asIttyRoute("post", "/chat", async (req) => {
    const { messages } = (await req.json()) as {
      messages: { role: string; content: string }[];
    };
    const openai = new OpenAI({
      apiKey: getConfig('OPENAI_API_KEY'),
      baseURL: getConfig('OPENAI_ENDPOINT'),
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
    ];

    const baseDir = join(appRoot, "case-data/case-documents-app");
    const indexPath = join(baseDir, "index.json");
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
    let documentEntriesCache: DocumentEntry[] | null = null;
    const loadDocumentEntries = async (): Promise<DocumentEntry[]> => {
      if (documentEntriesCache) return documentEntriesCache;
      try {
        const raw = await readFile(indexPath, "utf-8");
        documentEntriesCache = JSON.parse(raw) as DocumentEntry[];
        return documentEntriesCache;
      } catch {
        documentEntriesCache = [];
        return [];
      }
    };
    const documentEntries = await loadDocumentEntries();
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

Treat this snapshot as baseline context for case connectivity and bottlenecks. Use tools for exact record-level lookups when needed.`;

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
          if (caseId) deadlines = deadlines.filter((d) => d.caseId === caseId);
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
          const entries = await loadDocumentEntries();
          return JSON.stringify(
            entries.map(({ id, title, category, pageCount }) => ({
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
          try {
            const entries = await loadDocumentEntries();
            const doc = entries.find((e) => e.id === documentId);
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
              model: getConfig("EMBEDDINGS_MODEL") || "text-embedding-3-small",
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
          const result = await executeTool(toolCall.function.name, args);
          chatMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }
        continue;
      }

      return {
        reply: choice.message.content ?? "Sorry, I was unable to complete the request.",
      };
    }

    return { reply: "Sorry, I was unable to complete the request." };
  }))

  // --- Reports ---
  .post("/reports", asIttyRoute("post", "/reports", async (req) => {
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
        return json(400, { error: "Invalid report type" });
    }
  }))

  // --- Documents ---
  .get(
    "/documents",
    asIttyRoute("get", "/documents", async () => {
      const indexPath = join(appRoot, "case-data/case-documents-app/index.json");
      try {
        const raw = await readFile(indexPath, "utf-8");
        return JSON.parse(raw) as DocumentEntry[];
      } catch {
        return [];
      }
    }),
  )
  .post("/documents/upload", asIttyRoute("post", "/documents/upload", async (req) => {
    const formData = await req.formData();
    const category = (formData.get("category") as string) || "_new_filings";
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return json(400, { error: "No files provided" });
    }

    const baseDir = join(appRoot, "case-data/case-documents-app");
    await mkdir(baseDir, { recursive: true });

    const openai = new OpenAI({
      apiKey: getConfig('OPENAI_API_KEY'),
      baseURL: getConfig('OPENAI_ENDPOINT'),
    });
    const indexPath = join(baseDir, "index.json");

    let existingEntries: DocumentEntry[] = [];
    try {
      const raw = await readFile(indexPath, "utf-8");
      existingEntries = JSON.parse(raw);
    } catch {
      /* index file doesn't exist yet */
    }

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
  }))

  .delete(
    "/documents/:id",
    asIttyRoute("delete", "/documents/:id", async ({ params }) => {
      const baseDir = join(appRoot, "case-data/case-documents-app");
      const indexPath = join(baseDir, "index.json");

      let entries: DocumentEntry[] = [];
      try {
        const raw = await readFile(indexPath, "utf-8");
        entries = JSON.parse(raw);
      } catch {
        return notFound();
      }

      const idx = entries.findIndex((e) => e.id === params.id);
      if (idx === -1) return notFound();

      const doc = entries[idx];

      // Remove PDF and text files (best-effort)
      if (doc.path) {
        try {
          await unlink(join(baseDir, doc.path));
        } catch {
          /* file may not exist */
        }
      }
      if (doc.textFile) {
        try {
          await unlink(join(baseDir, doc.textFile));
        } catch {
          /* file may not exist */
        }
      }

      entries.splice(idx, 1);
      await writeFile(indexPath, JSON.stringify(entries, null, 2));
      return noContent();
    }),
  )

  // --- Ingestion status ---
  .get(
    "/ingest/status",
    asIttyRoute("get", "/ingest/status", () => ingestionStatus),
  )

  // --- Scan directory for documents ---
  .post("/ingest/scan", asIttyRoute("post", "/ingest/scan", async (req) => {
    try {
      const body = await req.json();
      const { directory } = body;

      if (!directory) {
        return json(400, { error: "directory is required" });
      }

      // Verify OpenAI is configured
      const openaiApiKey = getConfig("OPENAI_API_KEY");
      if (!openaiApiKey) {
        return json(400, { error: "OpenAI API key not configured" });
      }

      // Verify directory exists and is accessible
      try {
        const dirStat = await stat(directory);
        if (!dirStat.isDirectory()) {
          return json(400, { error: "Path is not a directory" });
        }
      } catch {
        return json(400, { error: "Directory not found or not accessible" });
      }

      const startedAt = new Date().toISOString();
      const openai = new OpenAI({ apiKey: openaiApiKey, baseURL: getConfig('OPENAI_ENDPOINT') });
      const baseDir = join(appRoot, "case-data/case-documents-app");
      const indexPath = join(baseDir, "index.json");

      // Load existing entries
      let existingEntries: DocumentEntry[] = [];
      try {
        const raw = await readFile(indexPath, "utf-8");
        existingEntries = JSON.parse(raw);
      } catch {
        /* index file doesn't exist yet */
      }

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

      return {
        status: "completed",
        added,
        skipped,
        errors,
        directory,
        startedAt,
        finishedAt,
      };
    } catch (error) {
      return json(500, {
        error: error instanceof Error ? error.message : "Scan failed",
      });
    }
  }))

  // --- Device Tokens (FCM) ---
  .get(
    "/device-tokens",
    asIttyRoute("get", "/device-tokens", () => getDeviceTokens()),
  )
  .post(
    "/device-tokens",
    asIttyRoute("post", "/device-tokens", async (req) => {
      const body = await req.json();
      const token = typeof body?.token === "string" ? body.token : "";
      const platform = body?.platform;

      if (
        !token ||
        (platform !== "ios" && platform !== "android" && platform !== "web")
      ) {
        return json(400, { error: "token and platform are required" });
      }

      return json201(registerDeviceToken(token, platform));
    }),
  )
  .delete(
    "/device-tokens/:tokenId",
    asIttyRoute("delete", "/device-tokens/:tokenId", ({ params }) => {
      const removed = removeDeviceToken(params.tokenId);
      if (!removed) return notFound();
      return noContent();
    }),
  )

  // --- SMS Recipients ---
  .get(
    "/sms-recipients",
    asIttyRoute("get", "/sms-recipients", () => getSmsRecipients()),
  )
  .post(
    "/sms-recipients",
    asIttyRoute("post", "/sms-recipients", async (req) => {
      const body = await req.json();
      const phone = typeof body?.phone === "string" ? body.phone : "";
      const name = typeof body?.name === "string" ? body.name : undefined;

      if (!phone) {
        return json(400, { error: "phone is required" });
      }

      return json201(registerSmsRecipient(phone, name));
    }),
  )
  .delete(
    "/sms-recipients/:recipientId",
    asIttyRoute("delete", "/sms-recipients/:recipientId", ({ params }) => {
      const removed = removeSmsRecipient(params.recipientId);
      if (!removed) return notFound();
      return noContent();
    }),
  )

  // --- Evaluations ---
  .get(
    "/evaluations",
    asIttyRoute("get", "/evaluations", () => {
      const evaluations = [...db.evaluations.values()].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      return evaluations;
    }),
  )
  .get(
    "/evaluations/:evaluationId",
    asIttyRoute("get", "/evaluations/:evaluationId", ({ params }) => {
      const evaluation = db.evaluations.get(params.evaluationId);
      return evaluation ?? notFound();
    }),
  )
  .post(
    "/evaluations/trigger",
    asIttyRoute("post", "/evaluations/trigger", async () => {
      try {
        const result = await triggerEvaluation();
        return json201(result);
      } catch (error) {
        return json(500, {
          error: error instanceof Error ? error.message : "Evaluation failed",
        });
      }
    }),
  )

  // --- Scheduler ---
  .get(
    "/scheduler/status",
    asIttyRoute("get", "/scheduler/status", () => {
      const status = getSchedulerStatus();
      const channels = getChannelsStatus();
      return { ...status, channels };
    }),
  );

// --- Fax Jobs ---
router
  .get(
    "/fax-jobs",
    asIttyRoute("get", "/fax-jobs", () => {
      const jobs = [...db.faxJobs.values()].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      return jobs;
    }),
  )
  .get(
    "/fax-jobs/:jobId",
    asIttyRoute("get", "/fax-jobs/:jobId", ({ params }) => {
      const job = db.faxJobs.get(params.jobId);
      return job ?? notFound();
    }),
  )
  .post(
    "/fax-jobs",
    asIttyRoute("post", "/fax-jobs", async (req) => {
      const body = await req.json();
      if (!body.filingId || !body.recipientFax) {
        return json(400, { error: "filingId and recipientFax are required" });
      }
      const now = new Date().toISOString();
      const job: FaxJob = {
        id: crypto.randomUUID(),
        filingId: body.filingId,
        caseId: body.caseId ?? "",
        recipientName: body.recipientName ?? "",
        recipientFax: body.recipientFax,
        documentPath: body.documentPath,
        status: "pending",
        provider: "",
        createdAt: now,
        updatedAt: now,
      };
      db.faxJobs.set(job.id, job);
      db.persist();

      // Kick off async send (non-blocking)
      void sendFax(job, body.documentPath);

      return json201(job);
    }),
  )
  .delete(
    "/fax-jobs/:jobId",
    asIttyRoute("delete", "/fax-jobs/:jobId", ({ params }) => {
      if (!db.faxJobs.has(params.jobId)) return notFound();
      db.faxJobs.delete(params.jobId);
      return noContent();
    }),
  )
  .get(
    "/fax/status",
    asIttyRoute("get", "/fax/status", () => {
      const p = getFaxProvider();
      return { configured: p.isConfigured(), provider: p.name };
    }),
  );

// --- Estate Plans ---
router
  .get(
    "/estate-plans",
    asIttyRoute("get", "/estate-plans", () => [...db.estatePlans.values()]),
  )
  .post(
    "/estate-plans",
    asIttyRoute("post", "/estate-plans", async (req) => {
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
    }),
  )
  .get(
    "/estate-plans/:planId",
    asIttyRoute("get", "/estate-plans/:planId", ({ params }) => {
      return db.estatePlans.get(params.planId) ?? notFound();
    }),
  )
  .patch(
    "/estate-plans/:planId",
    asIttyRoute("patch", "/estate-plans/:planId", async (req) => {
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
        if (body[key] !== undefined)
          (plan as Record<string, unknown>)[key] = body[key];
      }
      plan.updatedAt = new Date().toISOString();
      return plan;
    }),
  )
  .delete(
    "/estate-plans/:planId",
    asIttyRoute("delete", "/estate-plans/:planId", ({ params }) => {
      if (!db.estatePlans.has(params.planId)) return notFound();
      db.estatePlans.delete(params.planId);
      return noContent();
    }),
  )
  // Beneficiaries
  .post(
    "/estate-plans/:planId/beneficiaries",
    asIttyRoute(
      "post",
      "/estate-plans/:planId/beneficiaries",
      async (req) => {
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
      },
    ),
  )
  .delete(
    "/estate-plans/:planId/beneficiaries/:id",
    asIttyRoute(
      "delete",
      "/estate-plans/:planId/beneficiaries/:id",
      ({ params }) => {
        const plan = db.estatePlans.get(params.planId);
        if (!plan) return notFound();
        const idx = plan.beneficiaries.findIndex((b) => b.id === params.id);
        if (idx === -1) return notFound();
        plan.beneficiaries.splice(idx, 1);
        plan.updatedAt = new Date().toISOString();
        return noContent();
      },
    ),
  )
  // Assets
  .post(
    "/estate-plans/:planId/assets",
    asIttyRoute("post", "/estate-plans/:planId/assets", async (req) => {
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
    }),
  )
  .delete(
    "/estate-plans/:planId/assets/:id",
    asIttyRoute("delete", "/estate-plans/:planId/assets/:id", ({ params }) => {
      const plan = db.estatePlans.get(params.planId);
      if (!plan) return notFound();
      const idx = plan.assets.findIndex((a) => a.id === params.id);
      if (idx === -1) return notFound();
      plan.assets.splice(idx, 1);
      plan.updatedAt = new Date().toISOString();
      return noContent();
    }),
  )
  // Documents
  .post(
    "/estate-plans/:planId/documents",
    asIttyRoute("post", "/estate-plans/:planId/documents", async (req) => {
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
    }),
  )
  .patch(
    "/estate-plans/:planId/documents/:id",
    asIttyRoute("patch", "/estate-plans/:planId/documents/:id", async (req) => {
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
        if (body[key] !== undefined)
          (doc as Record<string, unknown>)[key] = body[key];
      }
      doc.updatedAt = new Date().toISOString();
      plan.updatedAt = new Date().toISOString();
      return doc;
    }),
  )
  .delete(
    "/estate-plans/:planId/documents/:id",
    asIttyRoute("delete", "/estate-plans/:planId/documents/:id", ({ params }) => {
      const plan = db.estatePlans.get(params.planId);
      if (!plan) return notFound();
      const idx = plan.documents.findIndex((d) => d.id === params.id);
      if (idx === -1) return notFound();
      plan.documents.splice(idx, 1);
      plan.updatedAt = new Date().toISOString();
      return noContent();
    }),
  );

// Mount config router
router.all("/config/*", configRouter.fetch);
router.all("/security/*", securityRouter.fetch);
router.all("/auth/*", authRouter.fetch);

// Research agent chat endpoint
router.post(
  "/research/agent/chat",
  asIttyRoute("post", "/research/agent/chat", async (request: Request) => {
    try {
      const body = (await request.json()) as {
        messages?: Array<{ role: string; content: string }>;
      };
      if (!body.messages || !Array.isArray(body.messages)) {
        return json(400, { error: "messages array is required" });
      }

      const result = await handleResearchChat(
        body.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      );

      return result;
    } catch (err) {
      console.error("[ResearchAgent] Error:", (err as Error)?.message);
      return json(500, { error: (err as Error)?.message ?? "Unknown error" });
    }
  }),
);

// Mount research router
router.all("/research/*", researchRouter.fetch);

// Initialize the scheduler on server startup
initScheduler();

const port = parseInt(process.env.PORT || "3001", 10);

if (import.meta.main) {
  console.log(`ProSeVA server running on http://localhost:${port}`);
}


export const ittyServer = {
  fetch: router.fetch,
};

export default {...ittyServer, port}
