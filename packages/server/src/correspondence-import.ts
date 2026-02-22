/**
 * Shared EML import logic used by both the manual file upload handler
 * and the automated email poller.
 */

import { parseEml } from "@proseva/correspondence";
import {
  db,
  type Correspondence,
  type CorrespondenceAttachment,
} from "./db";
import { BlobStore, getBlobStore } from "./blob-store";

function normalizeIsoDateOrNow(
  raw: string | undefined | null,
  fallback: string,
): string {
  if (!raw) return fallback;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? fallback : d.toISOString();
}

/**
 * Import a single raw EML file into the correspondence store.
 * Returns the created Correspondence record.
 */
export async function importSingleEml(
  emlBytes: ArrayBuffer,
  caseId: string,
): Promise<Correspondence> {
  const blobStore = getBlobStore();
  const storedAttachmentIds: string[] = [];

  try {
    const parsed = parseEml(emlBytes);
    const now = new Date().toISOString();
    const correspondenceId = crypto.randomUUID();
    const attachments: CorrespondenceAttachment[] = [];

    for (const parsedAttachment of parsed.attachments) {
      const bytes = new Uint8Array(parsedAttachment.content);
      if (bytes.byteLength === 0) continue;

      const attachmentId = crypto.randomUUID();
      const filename = parsedAttachment.filename?.trim()
        ? parsedAttachment.filename.trim()
        : `attachment-${attachmentId}`;
      const contentType = parsedAttachment.contentType?.trim()
        ? parsedAttachment.contentType.trim()
        : "application/octet-stream";
      const createdAt = new Date().toISOString();
      const hash = BlobStore.computeHash(bytes);

      await blobStore.store(attachmentId, bytes);
      storedAttachmentIds.push(attachmentId);

      db.fileMetadata.set(attachmentId, {
        id: attachmentId,
        filename,
        mimeType: contentType,
        size: bytes.byteLength,
        hash,
        createdAt,
        sourceType: "correspondence-attachment",
        sourceRef: correspondenceId,
      });

      attachments.push({
        id: attachmentId,
        filename,
        contentType,
        size: bytes.byteLength,
        hash,
        createdAt,
      });
    }

    const summaryText = (parsed.text || "").trim();
    const attachmentsText = attachments.length
      ? `Attachments: ${attachments.map((a) => a.filename).join(", ")}`
      : "";
    const notes = [
      parsed.cc ? `CC: ${parsed.cc}` : "",
      parsed.bcc ? `BCC: ${parsed.bcc}` : "",
      parsed.replyTo ? `Reply-To: ${parsed.replyTo}` : "",
      parsed.messageId ? `Message-ID: ${parsed.messageId}` : "",
      attachmentsText,
    ]
      .filter(Boolean)
      .join("\n");

    const c: Correspondence = {
      id: correspondenceId,
      caseId,
      date: normalizeIsoDateOrNow(parsed.date, now),
      direction: parsed.direction,
      channel: "email",
      subject: parsed.subject || "Untitled Email",
      sender: parsed.from,
      recipient: parsed.to,
      summary: summaryText.slice(0, 4000),
      notes,
      attachments,
      createdAt: now,
      updatedAt: now,
    };

    db.correspondences.set(c.id, c);
    return c;
  } catch (error) {
    // Rollback any stored attachments on failure
    for (const attachmentId of storedAttachmentIds) {
      try {
        await blobStore.delete(attachmentId);
      } catch {
        // Best effort rollback
      }
      db.fileMetadata.delete(attachmentId);
    }
    throw error;
  }
}
