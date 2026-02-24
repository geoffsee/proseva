import { AutoRouter } from "itty-router";
import { db, type Correspondence } from "./db";
import { getBlobStore } from "./blob-store";
import { importSingleEml } from "./correspondence-import";
import { safeDownloadFilename } from "./utils";
import {
  created as openapiCreated,
  json,
  noContent as openapiNoContent,
  notFound as openapiNotFound,
  openapiFormat,
} from "./openapi";

const json201 = <T>(data: T) => openapiCreated(data);
const notFound = () => openapiNotFound();
const noContent = () => openapiNoContent();

function normalizeIsoDateOrNow(value: unknown, fallbackIso: string): string {
  if (typeof value !== "string" || !value.trim()) return fallbackIso;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallbackIso;
  return parsed.toISOString();
}

function toCorrespondenceRecord(
  body: Record<string, unknown>,
  nowIso: string,
): Correspondence {
  return {
    id: crypto.randomUUID(),
    caseId: typeof body.caseId === "string" ? body.caseId : "",
    date: normalizeIsoDateOrNow(body.date, nowIso),
    direction: body.direction === "outgoing" ? "outgoing" : "incoming",
    channel:
      body.channel === "email" ||
      body.channel === "mail" ||
      body.channel === "fax" ||
      body.channel === "phone" ||
      body.channel === "sms"
        ? body.channel
        : "other",
    subject: typeof body.subject === "string" ? body.subject : "",
    sender: typeof body.sender === "string" ? body.sender : "",
    recipient: typeof body.recipient === "string" ? body.recipient : "",
    summary: typeof body.summary === "string" ? body.summary : "",
    notes: typeof body.notes === "string" ? body.notes : "",
    attachments: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

async function downloadCorrespondenceAttachment(
  correspondenceId: string,
  attachmentId: string,
) {
  const correspondence = db.correspondences.get(correspondenceId);
  if (!correspondence) return notFound();

  const attachment = (correspondence.attachments ?? []).find(
    (item) => item.id === attachmentId,
  );
  if (!attachment) return notFound();

  const blob = await getBlobStore().retrieve(attachmentId);
  if (!blob) return notFound();

  const metadata = db.fileMetadata.get(attachmentId);
  const filename = safeDownloadFilename(
    metadata?.filename || attachment.filename || "attachment.bin",
  );
  const contentType =
    metadata?.mimeType || attachment.contentType || "application/octet-stream";
  const normalizedBytes = new Uint8Array(blob.byteLength);
  normalizedBytes.set(blob);
  const responseBlob = new Blob([normalizedBytes], { type: contentType });

  return new Response(responseBlob, {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-length": String(responseBlob.size),
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

async function deleteCorrespondenceRecord(
  correspondenceId: string,
): Promise<boolean> {
  const correspondence = db.correspondences.get(correspondenceId);
  if (!correspondence) return false;

  const blobStore = getBlobStore();
  for (const attachment of correspondence.attachments ?? []) {
    try {
      await blobStore.delete(attachment.id);
    } catch {
      // Best effort cleanup; metadata record will still be removed.
    }
    db.fileMetadata.delete(attachment.id);
  }

  db.correspondences.delete(correspondenceId);
  return true;
}

async function importCorrespondenceEmails(formData: FormData) {
  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File);
  const caseIdRaw = formData.get("caseId");
  const caseId = typeof caseIdRaw === "string" ? caseIdRaw : "";

  if (files.length === 0) {
    return json(400, { error: "No email files provided" });
  }

  const created: Correspondence[] = [];
  const errors: { fileName: string; error: string }[] = [];

  for (const file of files) {
    const name = file.name || "email.eml";
    if (!name.toLowerCase().endsWith(".eml")) {
      errors.push({
        fileName: name,
        error: "Only .eml files are supported",
      });
      continue;
    }

    try {
      const c = await importSingleEml(await file.arrayBuffer(), caseId);
      created.push(c);
    } catch (error) {
      errors.push({
        fileName: name,
        error:
          error instanceof Error ? error.message : "Failed to parse email file",
      });
    }
  }

  return json201({
    created,
    createdCount: created.length,
    errors,
    errorCount: errors.length,
  });
}

const router = AutoRouter({ base: "/api", format: openapiFormat });

router
  .get("/correspondence", () => [...db.correspondences.values()])
  .get("/correspondences", () => [...db.correspondences.values()])
  .post("/correspondence", async (req) => {
    const body = (await req.json()) as Record<string, unknown>;
    const now = new Date().toISOString();
    const c = toCorrespondenceRecord(body, now);
    db.correspondences.set(c.id, c);
    return json201(c);
  })
  .post("/correspondences", async (req) => {
    const body = (await req.json()) as Record<string, unknown>;
    const now = new Date().toISOString();
    const c = toCorrespondenceRecord(body, now);
    db.correspondences.set(c.id, c);
    return json201(c);
  })
  .post("/correspondence/import-email", async (req) => {
    const formData = await req.formData();
    return importCorrespondenceEmails(formData);
  })
  .post("/correspondences/import-email", async (req) => {
    const formData = await req.formData();
    return importCorrespondenceEmails(formData);
  })
  .get("/correspondence/:correspondenceId", ({ params }) => {
    const c = db.correspondences.get(params.correspondenceId);
    return c ?? notFound();
  })
  .get("/correspondences/:correspondenceId", ({ params }) => {
    const c = db.correspondences.get(params.correspondenceId);
    return c ?? notFound();
  })
  .get(
    "/correspondence/:correspondenceId/attachments/:attachmentId",
    async ({ params }) =>
      downloadCorrespondenceAttachment(
        params.correspondenceId,
        params.attachmentId,
      ),
  )
  .get(
    "/correspondences/:correspondenceId/attachments/:attachmentId",
    async ({ params }) =>
      downloadCorrespondenceAttachment(
        params.correspondenceId,
        params.attachmentId,
      ),
  )
  .patch("/correspondence/:correspondenceId", async (req) => {
    const c = db.correspondences.get(req.params.correspondenceId);
    if (!c) return notFound();
    const body = await req.json();
    for (const key of [
      "caseId",
      "date",
      "direction",
      "channel",
      "subject",
      "sender",
      "recipient",
      "summary",
      "notes",
    ] as const) {
      if (body[key] !== undefined)
        (c as Record<string, unknown>)[key] = body[key];
    }
    c.updatedAt = new Date().toISOString();
    return c;
  })
  .patch("/correspondences/:correspondenceId", async (req) => {
    const c = db.correspondences.get(req.params.correspondenceId);
    if (!c) return notFound();
    const body = await req.json();
    for (const key of [
      "caseId",
      "date",
      "direction",
      "channel",
      "subject",
      "sender",
      "recipient",
      "summary",
      "notes",
    ] as const) {
      if (body[key] !== undefined)
        (c as Record<string, unknown>)[key] = body[key];
    }
    c.updatedAt = new Date().toISOString();
    return c;
  })
  .delete("/correspondence/:correspondenceId", async ({ params }) => {
    const deleted = await deleteCorrespondenceRecord(params.correspondenceId);
    if (!deleted) return notFound();
    return noContent();
  })
  .delete("/correspondences/:correspondenceId", async ({ params }) => {
    const deleted = await deleteCorrespondenceRecord(params.correspondenceId);
    if (!deleted) return notFound();
    return noContent();
  });

export { router as correspondenceRouter };
