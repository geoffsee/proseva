import chalk from "chalk";
import ora from "ora";
import {
  createTable,
  formatCount,
  printSection,
  printSuccess,
  formatJson,
} from "../lib/formatters";
import type { ApiClient } from "../lib/api-client";

/**
 * Show database statistics
 */
async function stats(): Promise<void> {
  const client = (global as any).apiClient as ApiClient;
  const outputJson = (global as any).cliOptions.json;

  const spinner = ora("Fetching database statistics...").start();

  try {
    // Fetch all entity counts in parallel
    const [cases, deadlines, contacts, finances, evidences, filings, notes] =
      await Promise.all([
        client.get("/cases"),
        client.get("/deadlines"),
        client.get("/contacts"),
        client.get("/finances"),
        client.get("/evidences"),
        client.get("/filings"),
        client.get("/notes"),
      ]);

    spinner.stop();

    const stats = {
      cases: cases?.length || 0,
      deadlines: deadlines?.length || 0,
      contacts: contacts?.length || 0,
      finances: finances?.length || 0,
      evidences: evidences?.length || 0,
      filings: filings?.length || 0,
      notes: notes?.length || 0,
    };

    const total = Object.values(stats).reduce((sum, count) => sum + count, 0);

    if (outputJson) {
      console.log(formatJson({ ...stats, total }));
      return;
    }

    console.log();
    console.log(chalk.bold.blue("Database Statistics"));
    console.log();

    const table = createTable(["Collection", "Count"]);

    table.push(
      ["Cases", chalk.cyan(stats.cases)],
      ["Deadlines", chalk.cyan(stats.deadlines)],
      ["Contacts", chalk.cyan(stats.contacts)],
      ["Finances", chalk.cyan(stats.finances)],
      ["Evidence", chalk.cyan(stats.evidences)],
      ["Filings", chalk.cyan(stats.filings)],
      ["Notes", chalk.cyan(stats.notes)],
      [chalk.bold("Total"), chalk.bold.cyan(total)],
    );

    console.log(table.toString());
    console.log();
  } catch (error) {
    spinner.fail("Failed to fetch statistics");
    throw error;
  }
}

/**
 * Export database
 */
async function exportData(format: string): Promise<void> {
  const client = (global as any).apiClient as ApiClient;
  const outputJson = (global as any).cliOptions.json;

  if (format !== "json" && format !== "csv") {
    console.error(chalk.red("Invalid format. Supported formats: json, csv"));
    process.exit(3);
  }

  const spinner = ora("Exporting database...").start();

  try {
    // Fetch all data in parallel
    const [cases, deadlines, contacts, finances, evidences, filings, notes] =
      await Promise.all([
        client.get("/cases"),
        client.get("/deadlines"),
        client.get("/contacts"),
        client.get("/finances"),
        client.get("/evidences"),
        client.get("/filings"),
        client.get("/notes"),
      ]);

    const data = {
      cases: cases || [],
      deadlines: deadlines || [],
      contacts: contacts || [],
      finances: finances || [],
      evidences: evidences || [],
      filings: filings || [],
      notes: notes || [],
    };

    spinner.stop();

    if (format === "json") {
      console.log(JSON.stringify(data, null, 2));
      if (!outputJson) {
        printSuccess(
          `Exported ${Object.values(data).reduce((sum, arr) => sum + arr.length, 0)} entities`,
        );
      }
    } else if (format === "csv") {
      // CSV export
      console.error(chalk.yellow("CSV export not yet implemented"));
      console.error(
        chalk.gray(
          "Use JSON export for now: proseva db export json > data.json",
        ),
      );
      process.exit(1);
    }
  } catch (error) {
    spinner.fail("Failed to export database");
    throw error;
  }
}

export const dbCommand = {
  stats,
  export: exportData,
};
