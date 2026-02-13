import type { FaxProvider } from "./types";
import { StubFaxProvider } from "./stub-provider";
import { db, type FaxJob } from "../db";

let provider: FaxProvider = new StubFaxProvider();

export function setFaxProvider(p: FaxProvider): void {
  provider = p;
}

export function getFaxProvider(): FaxProvider {
  return provider;
}

/**
 * Orchestrate sending a fax: updates job status through the lifecycle
 * (pending -> sending -> sent/failed) and persists changes.
 */
export async function sendFax(
  job: FaxJob,
  _documentPath?: string,
): Promise<void> {
  // Mark as sending
  job.status = "sending";
  job.updatedAt = new Date().toISOString();
  db.persist();

  try {
    const result = await provider.sendFax({
      recipientFax: job.recipientFax,
      recipientName: job.recipientName,
      documentPath: _documentPath,
      callerReference: job.id,
    });

    if (result.success) {
      job.status = "sent";
      job.providerJobId = result.providerJobId;
      job.sentAt = new Date().toISOString();
    } else {
      job.status = "failed";
      job.error = result.error ?? "Send failed";
    }
  } catch (err) {
    job.status = "failed";
    job.error = err instanceof Error ? err.message : "Unknown error";
  }

  job.provider = provider.name;
  job.updatedAt = new Date().toISOString();
  db.persist();
}
