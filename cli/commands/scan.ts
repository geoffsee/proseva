import chalk from "chalk";
import ora from "ora";
import {
  printError,
  printWarning,
  printInfo,
  formatJson,
  printSection,
} from "../lib/formatters";

interface ScanOptions {
  watch?: boolean;
}

export async function scanCommand(
  directory: string,
  options: ScanOptions,
): Promise<void> {
  const client = globalThis.apiClient;
  const outputJson = globalThis.cliOptions.json;

  if (options.watch) {
    printWarning("Watch mode not yet implemented");
    printInfo("Use proseva scan <directory> for one-time scan");
    process.exit(1);
  }

  // Verify OpenAI is configured
  const config = (await client.get("/config")) as any;
  if (!config?.ai?.openaiApiKey) {
    printError("OpenAI API key not configured");
    printError("Run: proseva config set ai.openaiApiKey <key>");
    process.exit(1);
  }

  const spinner = ora(`Scanning ${directory} for documents...`).start();

  try {
    const result = (await client.post("/ingest/scan", {
      body: {
        directory,
      } as any,
    })) as any;

    spinner.succeed("Scan completed");

    if (outputJson) {
      console.log(formatJson(result));
      return;
    }

    const { added, skipped, errors, startedAt, finishedAt } = result;

    console.log();
    if (added > 0) {
      console.log(chalk.green(`✓ Added: ${added} documents`));
    }
    if (skipped > 0) {
      console.log(chalk.yellow(`○ Skipped: ${skipped} documents (duplicates)`));
    }
    if (errors > 0) {
      console.log(chalk.red(`✗ Errors: ${errors} documents`));
    }

    if (added > 0 || skipped > 0 || errors > 0) {
      console.log();
      printSection("Details");
      console.log(
        chalk.gray(`Started:  ${new Date(startedAt).toLocaleString()}`),
      );
      console.log(
        chalk.gray(`Finished: ${new Date(finishedAt).toLocaleString()}`),
      );
      const duration =
        (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000;
      console.log(chalk.gray(`Duration: ${duration.toFixed(1)}s`));
    }

    console.log();
  } catch (error) {
    spinner.fail("Scan failed");
    throw error;
  }
}
