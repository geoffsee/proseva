import { AutoRouter } from "itty-router";
import { db, type Case, type Party, type Filing } from "./db";
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
  );

export { router as casesRouter };
