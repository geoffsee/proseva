/**
 * Email service: registers with the Cloudflare Email Worker, polls for
 * encrypted inbound emails, decrypts them, and imports them as
 * Correspondence records via the existing EML import pipeline.
 */

import { Cron } from "croner";
import { db } from "./db";
import { loadConfigFromDatabase, invalidateConfigCache } from "./config";
import { generateEcdhKeyPair, decryptEmail } from "./email-crypto";
import { importSingleEml } from "./correspondence-import";

const DEFAULT_WORKER_URL = "https://email.proseva.app";
const DEFAULT_POLL_INTERVAL = 60; // seconds

let pollerJob: Cron | null = null;
let lastPollAt: string | null = null;
let lastPollError: string | null = null;
let lastPollCount = 0;

function getEmailConfig() {
  const config = loadConfigFromDatabase();
  return config?.email ?? null;
}

function getWorkerUrl(): string {
  const config = getEmailConfig();
  return config?.workerUrl || process.env.EMAIL_WORKER_URL || DEFAULT_WORKER_URL;
}

export interface EmailServiceStatus {
  configured: boolean;
  instanceId: string | null;
  emailAddress: string | null;
  pollingEnabled: boolean;
  pollingIntervalSeconds: number;
  lastPollAt: string | null;
  lastPollCount: number;
  lastPollError: string | null;
}

export function getEmailServiceStatus(): EmailServiceStatus {
  const config = getEmailConfig();
  return {
    configured: !!config?.instanceId && !!config?.apiKey,
    instanceId: config?.instanceId ?? null,
    emailAddress: config?.emailAddress ?? null,
    pollingEnabled: config?.pollingEnabled ?? false,
    pollingIntervalSeconds: config?.pollingIntervalSeconds ?? DEFAULT_POLL_INTERVAL,
    lastPollAt,
    lastPollCount,
    lastPollError,
  };
}

/**
 * Register this instance with the Cloudflare Email Worker.
 * Generates an ECDH keypair and sends the public key to the worker.
 * Returns the assigned email address.
 */
export async function registerEmailAddress(registrationSecret: string): Promise<{
  emailAddress: string;
}> {
  const { publicKeyJwk, privateKeyJwk } = await generateEcdhKeyPair();
  const instanceId = crypto.randomUUID();
  const workerUrl = getWorkerUrl();

  const response = await fetch(`${workerUrl}/api/v1/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${registrationSecret}`,
    },
    body: JSON.stringify({ instanceId, publicKey: publicKeyJwk }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Registration failed (${response.status}): ${body}`);
  }

  const result = (await response.json()) as {
    emailAddress: string;
    apiKey: string;
  };

  // Save to server config
  let config = db.serverConfig.get("singleton");
  if (!config) {
    config = {
      id: "singleton",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  config = {
    ...config,
    updatedAt: new Date().toISOString(),
    email: {
      instanceId,
      emailAddress: result.emailAddress,
      apiKey: result.apiKey,
      publicKeyJwk,
      privateKeyJwk,
      workerUrl,
      pollingEnabled: true,
      pollingIntervalSeconds: DEFAULT_POLL_INTERVAL,
    },
  };

  db.serverConfig.set("singleton", config);
  db.persist();
  invalidateConfigCache();

  // Start polling
  startPoller();

  return { emailAddress: result.emailAddress };
}

/**
 * Poll the email worker for new emails, decrypt, and import them.
 */
export async function pollForEmails(): Promise<number> {
  const config = getEmailConfig();
  if (!config?.instanceId || !config?.apiKey || !config?.privateKeyJwk) {
    return 0;
  }

  const workerUrl = getWorkerUrl();
  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    "X-Instance-Id": config.instanceId,
  };

  try {
    // List pending emails
    const listResponse = await fetch(`${workerUrl}/api/v1/emails`, { headers });
    if (!listResponse.ok) {
      throw new Error(`List emails failed: ${listResponse.status}`);
    }

    const { emails } = (await listResponse.json()) as {
      emails: Array<{
        emailId: string;
        receivedAt: string;
        sizeBytes: number;
      }>;
    };

    if (emails.length === 0) {
      lastPollAt = new Date().toISOString();
      lastPollCount = 0;
      lastPollError = null;
      return 0;
    }

    let imported = 0;

    for (const emailMeta of emails) {
      // Download encrypted email
      const downloadResponse = await fetch(
        `${workerUrl}/api/v1/emails/${emailMeta.emailId}`,
        { headers },
      );

      if (!downloadResponse.ok) {
        console.error(
          `[email] Failed to download email ${emailMeta.emailId}: ${downloadResponse.status}`,
        );
        continue;
      }

      const ephemeralPublicKeyJwk = downloadResponse.headers.get(
        "X-Ephemeral-Public-Key",
      );
      const iv = downloadResponse.headers.get("X-Encryption-IV");

      if (!ephemeralPublicKeyJwk || !iv) {
        console.error(
          `[email] Missing decryption headers for email ${emailMeta.emailId}`,
        );
        continue;
      }

      const encryptedBytes = await downloadResponse.arrayBuffer();

      // Decrypt
      let rawEml: ArrayBuffer;
      try {
        rawEml = await decryptEmail(
          encryptedBytes,
          ephemeralPublicKeyJwk,
          iv,
          config.privateKeyJwk,
        );
      } catch (err) {
        console.error(
          `[email] Decryption failed for email ${emailMeta.emailId}:`,
          err,
        );
        continue;
      }

      // Import as correspondence
      try {
        await importSingleEml(rawEml, "");
        imported++;
      } catch (err) {
        console.error(
          `[email] Import failed for email ${emailMeta.emailId}:`,
          err,
        );
        continue;
      }

      // ACK the email (delete from worker)
      try {
        await fetch(`${workerUrl}/api/v1/emails/${emailMeta.emailId}/ack`, {
          method: "POST",
          headers,
        });
      } catch (err) {
        console.error(
          `[email] ACK failed for email ${emailMeta.emailId}:`,
          err,
        );
      }
    }

    lastPollAt = new Date().toISOString();
    lastPollCount = imported;
    lastPollError = null;
    return imported;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    lastPollError = message;
    lastPollAt = new Date().toISOString();
    console.error("[email] Poll failed:", message);
    return 0;
  }
}

/**
 * Test the connection to the email worker.
 */
export async function testEmailConnection(): Promise<{
  success: boolean;
  error?: string;
  pendingEmails?: number;
}> {
  const config = getEmailConfig();
  if (!config?.instanceId || !config?.apiKey) {
    return { success: false, error: "Email not configured" };
  }

  try {
    const workerUrl = getWorkerUrl();
    const response = await fetch(`${workerUrl}/api/v1/status`, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "X-Instance-Id": config.instanceId,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Worker returned ${response.status}`,
      };
    }

    const status = (await response.json()) as { pendingEmails: number };
    return { success: true, pendingEmails: status.pendingEmails };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Rotate the ECDH keypair. Old private key must be retained until all
 * pending emails encrypted with the old public key are downloaded.
 */
export async function rotateEmailKey(): Promise<void> {
  const config = getEmailConfig();
  if (!config?.instanceId || !config?.apiKey) {
    throw new Error("Email not configured");
  }

  const { publicKeyJwk, privateKeyJwk } = await generateEcdhKeyPair();
  const workerUrl = getWorkerUrl();

  // First poll to download any emails encrypted with the old key
  await pollForEmails();

  // Update worker with new public key
  const response = await fetch(`${workerUrl}/api/v1/rotate-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "X-Instance-Id": config.instanceId,
    },
    body: JSON.stringify({ newPublicKey: publicKeyJwk }),
  });

  if (!response.ok) {
    throw new Error(`Key rotation failed: ${response.status}`);
  }

  // Update local config
  const serverConfig = db.serverConfig.get("singleton");
  if (serverConfig?.email) {
    serverConfig.email.publicKeyJwk = publicKeyJwk;
    serverConfig.email.privateKeyJwk = privateKeyJwk;
    serverConfig.updatedAt = new Date().toISOString();
    db.serverConfig.set("singleton", serverConfig);
    db.persist();
    invalidateConfigCache();
  }
}

function startPoller(): void {
  stopPoller();

  const config = getEmailConfig();
  if (!config?.pollingEnabled || !config?.instanceId || !config?.apiKey) {
    return;
  }

  const interval = config.pollingIntervalSeconds ?? DEFAULT_POLL_INTERVAL;
  const cronExpr = `*/${interval} * * * * *`;

  pollerJob = new Cron(cronExpr, {}, () => {
    void pollForEmails();
  });

  console.log(
    `[email] Polling started for ${config.emailAddress} every ${interval}s`,
  );
}

function stopPoller(): void {
  if (pollerJob) {
    pollerJob.stop();
    pollerJob = null;
  }
}

/**
 * Initialize the email poller if configured and enabled.
 * Called on server startup.
 */
export function initEmailPoller(): void {
  startPoller();
}

/**
 * Stop the email poller. Called on server shutdown.
 */
export function stopEmailPoller(): void {
  stopPoller();
}

/**
 * Restart the email poller (after config changes).
 */
export function restartEmailPoller(): void {
  stopPoller();
  startPoller();
}
