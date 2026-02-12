import chalk from "chalk";
import {
  formatServiceStatus,
  formatCount,
  printSection,
  printRule,
  printKeyValue,
  formatJson,
  formatDate,
} from "../lib/formatters";
import type { ApiClient } from "../lib/api-client";

interface StatusOptions {
  watch?: boolean;
}

export async function statusCommand(options: StatusOptions): Promise<void> {
  const client = globalThis.apiClient;
  const outputJson = globalThis.cliOptions.json;

  if (options.watch) {
    // Watch mode - refresh every 5 seconds
    while (true) {
      console.clear();
      await displayStatus(client, outputJson);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  } else {
    await displayStatus(client, outputJson);
  }
}

async function displayStatus(
  client: ApiClient,
  outputJson: boolean,
): Promise<void> {
  // Fetch all status data in parallel
  const [
    config,
    schedulerStatus,
    ingestStatus,
    evaluations,
    cases,
    deadlines,
    contacts,
  ] = (await Promise.all([
    client.get("/config"),
    client.get("/scheduler/status"),
    client.get("/ingest/status"),
    client.get("/evaluations"),
    client.get("/cases"),
    client.get("/deadlines"),
    client.get("/contacts"),
  ])) as [any, any, any, any[] | null, any[] | null, any[] | null, any[] | null];

  if (outputJson) {
    console.log(
      formatJson({
        config,
        scheduler: schedulerStatus,
        ingest: ingestStatus,
        evaluations: evaluations?.slice(0, 5),
        database: {
          cases: cases?.length || 0,
          deadlines: deadlines?.length || 0,
          contacts: contacts?.length || 0,
        },
      }),
    );
    return;
  }

  // Header
  console.log();
  console.log(chalk.bold.blue("Pro-Se-VA Server Status"));
  printRule();

  // Database stats
  const totalEntities =
    (cases?.length || 0) + (deadlines?.length || 0) + (contacts?.length || 0);
  printSection("Database");
  console.log(formatCount(totalEntities, "entity", "entities"));
  printKeyValue("  Cases", String(cases?.length || 0), 2);
  printKeyValue("  Deadlines", String(deadlines?.length || 0), 2);
  printKeyValue("  Contacts", String(contacts?.length || 0), 2);

  // Services
  printSection("Services");

  // Firebase
  const firebaseConfigured = !!config?.firebase?.projectId;
  const deviceCount = await client
    .get("/device-tokens")
    .then((tokens: any) => (tokens as any[])?.length || 0)
    .catch(() => 0);
  console.log(
    formatServiceStatus(
      "Firebase",
      firebaseConfigured,
      deviceCount > 0 ? `${deviceCount} devices` : undefined,
    ),
  );

  // Twilio
  const twilioConfigured = !!config?.twilio?.accountSid;
  const smsCount = await client
    .get("/sms-recipients")
    .then((recipients: any) => (recipients as any[])?.length || 0)
    .catch(() => 0);
  console.log(
    formatServiceStatus(
      "Twilio",
      twilioConfigured,
      smsCount > 0 ? `${smsCount} recipients` : undefined,
    ),
  );

  // Scheduler
  const schedulerEnabled = schedulerStatus?.enabled || false;
  const nextRun = schedulerStatus?.nextRun;
  console.log(
    formatServiceStatus(
      "Scheduler",
      schedulerEnabled,
      nextRun ? `Next: ${formatDate(nextRun as string)}` : undefined,
    ),
  );

  // OpenAI
  const openaiConfigured = !!config?.ai?.openaiApiKey;
  console.log(formatServiceStatus("OpenAI", openaiConfigured));

  // Auto-Ingest
  const autoIngestConfigured = !!config?.autoIngest?.directory;
  console.log(
    formatServiceStatus(
      "Auto-Ingest",
      autoIngestConfigured,
      autoIngestConfigured
        ? (ingestStatus as any)?.directory
        : "Not configured",
    ),
  );

  // Recent evaluations
  if (evaluations && Array.isArray(evaluations) && evaluations.length > 0) {
    printSection("Recent Evaluations");
    evaluations.slice(0, 5).forEach((evaluation) => {
      const date = new Date(evaluation.createdAt).toLocaleString();
      const status = evaluation.sent
        ? chalk.green("Sent")
        : chalk.yellow("Pending");
      const summary = evaluation.summary
        ? chalk.gray(`(${evaluation.summary})`)
        : "";
      console.log(`• ${date} - ${status} ${summary}`);
    });
  }

  console.log();
}
