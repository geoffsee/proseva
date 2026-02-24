import { AutoRouter } from "itty-router";
import { db, type FaxJob } from "./db";
import { sendFax, getFaxProvider } from "./fax";
import {
  pollForEmails,
  getEmailServiceStatus,
  registerEmailAddress,
  testEmailConnection,
  rotateEmailKey,
} from "./email-service";
import {
  asIttyRoute,
  created as openapiCreated,
  json,
  noContent as openapiNoContent,
  notFound as openapiNotFound,
  openapiFormat,
} from "./openapi";

const json201 = <T>(data: T) => openapiCreated(data);
const notFound = () => openapiNotFound();
const noContent = () => openapiNoContent();

const router = AutoRouter({ base: "/api", format: openapiFormat });

// --- Email Service ---
router
  .get(
    "/email/status",
    asIttyRoute("get", "/email/status", () => getEmailServiceStatus()),
  )
  .post(
    "/email/poll",
    asIttyRoute("post", "/email/poll", async () => {
      const count = await pollForEmails();
      if (count > 0) db.persist();
      return { success: true, imported: count };
    }),
  )
  .post(
    "/email/register",
    asIttyRoute("post", "/email/register", async (req) => {
      const body = await req.json();
      const registrationSecret =
        typeof body?.registrationSecret === "string"
          ? body.registrationSecret
          : "";
      if (!registrationSecret) {
        return json(400, { error: "registrationSecret is required" });
      }
      try {
        const result = await registerEmailAddress(registrationSecret);
        db.persist();
        return result;
      } catch (error) {
        return json(500, {
          error: error instanceof Error ? error.message : "Registration failed",
        });
      }
    }),
  )
  .post(
    "/email/test",
    asIttyRoute("post", "/email/test", async () => {
      return testEmailConnection();
    }),
  )
  .post(
    "/email/rotate-key",
    asIttyRoute("post", "/email/rotate-key", async () => {
      try {
        await rotateEmailKey();
        db.persist();
        return { success: true };
      } catch (error) {
        return json(500, {
          error: error instanceof Error ? error.message : "Key rotation failed",
        });
      }
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

export { router as communicationsRouter };
