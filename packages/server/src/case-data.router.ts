import { AutoRouter } from "itty-router";
import {
  db,
  type Contact,
  type Deadline,
  type FinancialEntry,
  type Evidence,
  type Filing,
  type Note,
} from "./db";
import {
  asIttyRoute,
  created as openapiCreated,
  noContent as openapiNoContent,
  notFound as openapiNotFound,
  openapiFormat,
} from "./openapi";

const json201 = <T>(data: T) => openapiCreated(data);
const notFound = () => openapiNotFound();
const noContent = () => openapiNoContent();

const router = AutoRouter({ base: "/api", format: openapiFormat });

// --- Contacts ---
router
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
  .get(
    "/notes",
    asIttyRoute("get", "/notes", () => [...db.notes.values()]),
  )
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
  );

export { router as caseDataRouter };
