import { AutoRouter } from "itty-router";
import {
  db,
  type EstatePlan,
  type Beneficiary,
  type EstateAsset,
  type EstateDocument,
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
    asIttyRoute("post", "/estate-plans/:planId/beneficiaries", async (req) => {
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
    }),
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
    asIttyRoute(
      "delete",
      "/estate-plans/:planId/documents/:id",
      ({ params }) => {
        const plan = db.estatePlans.get(params.planId);
        if (!plan) return notFound();
        const idx = plan.documents.findIndex((d) => d.id === params.id);
        if (idx === -1) return notFound();
        plan.documents.splice(idx, 1);
        plan.updatedAt = new Date().toISOString();
        return noContent();
      },
    ),
  );

export { router as estatePlansRouter };
