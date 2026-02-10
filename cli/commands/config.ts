import chalk from "chalk";
import ora from "ora";
import {
  formatConfigValue,
  formatSource,
  printSection,
  printKeyValue,
  printSuccess,
  printError,
  printWarning,
  formatJson,
} from "../lib/formatters";
import type { ApiClient } from "../lib/api-client";

/**
 * Get configuration
 */
async function get(key?: string): Promise<void> {
  const client = (global as any).apiClient as ApiClient;
  const outputJson = (global as any).cliOptions.json;

  const config = await client.get("/config");

  if (outputJson) {
    console.log(formatJson(config));
    return;
  }

  if (key) {
    // Get specific key
    const value = getNestedValue(config, key);
    if (value === undefined) {
      printError(`Key not found: ${key}`);
      process.exit(1);
    }
    console.log(formatConfigValue(value));
    return;
  }

  // Display all configuration
  console.log();
  console.log(chalk.bold.blue("Server Configuration"));
  console.log();

  // Firebase
  printSection("Firebase");
  printConfigItem(config, "firebase.projectId", "Project ID");
  printConfigItem(config, "firebase.privateKey", "Private Key", true);
  printConfigItem(config, "firebase.clientEmail", "Client Email");

  // Twilio
  printSection("Twilio");
  printConfigItem(config, "twilio.accountSid", "Account SID", true);
  printConfigItem(config, "twilio.authToken", "Auth Token", true);
  printConfigItem(config, "twilio.phoneNumber", "Phone Number");

  // Scheduler
  printSection("Scheduler");
  printConfigItem(config, "scheduler.timezone", "Timezone");
  printConfigItem(config, "scheduler.enabled", "Enabled");

  // AI
  printSection("AI");
  printConfigItem(config, "ai.openaiApiKey", "OpenAI API Key", true);
  printConfigItem(config, "ai.openaiEndpoint", "OpenAI Endpoint");

  // Auto-Ingest
  printSection("Auto-Ingest");
  printConfigItem(config, "autoIngest.directory", "Directory");

  console.log();
}

/**
 * Set configuration value
 */
async function set(key: string, value: string): Promise<void> {
  const client = (global as any).apiClient as ApiClient;
  const outputJson = (global as any).cliOptions.json;

  // Parse the key into group and field
  const parts = key.split(".");
  if (parts.length !== 2) {
    printError("Key must be in format: group.key (e.g., firebase.projectId)");
    process.exit(3);
  }

  const [group, field] = parts;
  const validGroups = ["firebase", "twilio", "scheduler", "ai", "autoIngest"];

  if (!validGroups.includes(group)) {
    printError(
      `Invalid group: ${group}. Valid groups: ${validGroups.join(", ")}`,
    );
    process.exit(3);
  }

  const spinner = ora(`Setting ${key}...`).start();

  try {
    // Parse value for booleans
    let parsedValue: any = value;
    if (value === "true" || value === "false") {
      parsedValue = value === "true";
    }

    const result = await client.patch("/config", {
      body: {
        [group]: {
          [field]: parsedValue,
        },
      },
    });

    spinner.succeed(`Set ${key} = ${value}`);

    if (outputJson) {
      console.log(formatJson(result));
    } else {
      printWarning(
        "Remember to reinitialize the service for changes to take effect:",
      );
      console.log(chalk.gray(`  proseva config reinit ${group}`));
    }
  } catch (error) {
    spinner.fail(`Failed to set ${key}`);
    throw error;
  }
}

/**
 * Reset configuration
 */
async function reset(group?: string): Promise<void> {
  const client = (global as any).apiClient as ApiClient;
  const outputJson = (global as any).cliOptions.json;

  if (group) {
    printWarning(
      `This will reset ${group} configuration to environment defaults.`,
    );
  } else {
    printWarning("This will reset ALL configuration to environment defaults.");
  }

  // TODO: Add confirmation prompt in interactive mode

  const spinner = ora("Resetting configuration...").start();

  try {
    if (group) {
      // Delete specific group
      const config = await client.get("/config");
      const groupConfig = (config as any)[group];

      if (!groupConfig) {
        spinner.fail(`Group not found: ${group}`);
        process.exit(1);
      }

      // Delete each key in the group
      for (const key of Object.keys(groupConfig)) {
        if (!key.endsWith("Source")) {
          await client.delete(`/config/${group}/${key}` as any);
        }
      }
    } else {
      // Reset all
      await client.post("/config/reset", {});
    }

    spinner.succeed("Configuration reset");

    if (!outputJson) {
      printSuccess("Configuration has been reset to environment defaults");
    }
  } catch (error) {
    spinner.fail("Failed to reset configuration");
    throw error;
  }
}

/**
 * Test service connection
 */
async function test(service: string): Promise<void> {
  const client = (global as any).apiClient as ApiClient;
  const outputJson = (global as any).cliOptions.json;

  const validServices = ["firebase", "twilio", "openai"];
  if (!validServices.includes(service)) {
    printError(
      `Invalid service: ${service}. Valid services: ${validServices.join(", ")}`,
    );
    process.exit(3);
  }

  const spinner = ora(`Testing ${service} connection...`).start();

  try {
    let result;
    if (service === "firebase") {
      result = await client.post("/config/test-firebase", {});
    } else if (service === "twilio") {
      // For Twilio, we need a test phone number
      // In a real implementation, we'd prompt for this
      printError("Twilio test requires a test phone number");
      printError("Use: proseva config test twilio --phone +15555551234");
      spinner.stop();
      process.exit(3);
    } else if (service === "openai") {
      result = await client.post("/config/test-openai", {});
    }

    if (outputJson) {
      console.log(formatJson(result));
      return;
    }

    if ((result as any)?.success) {
      spinner.succeed(`${service} connection successful`);
      if ((result as any)?.message) {
        console.log(chalk.gray((result as any).message));
      }
    } else {
      spinner.fail(`${service} connection failed`);
      if ((result as any)?.error) {
        printError((result as any).error);
      }
      process.exit(1);
    }
  } catch (error) {
    spinner.fail(`${service} connection test failed`);
    throw error;
  }
}

/**
 * Reinitialize service
 */
async function reinit(service: string): Promise<void> {
  const client = (global as any).apiClient as ApiClient;
  const outputJson = (global as any).cliOptions.json;

  const validServices = ["firebase", "twilio", "scheduler"];
  if (!validServices.includes(service)) {
    printError(
      `Invalid service: ${service}. Valid services: ${validServices.join(", ")}`,
    );
    process.exit(3);
  }

  const spinner = ora(`Reinitializing ${service}...`).start();

  try {
    const result = await client.post(
      `/config/reinitialize/${service}` as any,
      {},
    );

    if (outputJson) {
      console.log(formatJson(result));
      return;
    }

    if ((result as any)?.success) {
      spinner.succeed(`${service} reinitialized successfully`);
    } else {
      spinner.fail(`Failed to reinitialize ${service}`);
      if ((result as any)?.error) {
        printError((result as any).error);
      }
      process.exit(1);
    }
  } catch (error) {
    spinner.fail(`Failed to reinitialize ${service}`);
    throw error;
  }
}

/**
 * Helper: Print a configuration item with source
 */
function printConfigItem(
  config: any,
  path: string,
  label: string,
  sensitive = false,
): void {
  const value = getNestedValue(config, path);
  const sourceKey = path + "Source";
  const source = getNestedValue(config, sourceKey);

  const formattedValue = formatConfigValue(value, sensitive);
  const formattedSource = source ? formatSource(source as any) : "";

  console.log(
    `  ${chalk.gray(label + ":")} ${formattedValue} ${formattedSource}`,
  );
}

/**
 * Helper: Get nested value from object by path
 */
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, part) => acc?.[part], obj);
}

export const configCommand = {
  get,
  set,
  reset,
  test,
  reinit,
};
