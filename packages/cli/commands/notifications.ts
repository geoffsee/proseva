import chalk from "chalk";
import ora from "ora";
import {
  createTable,
  printSuccess,
  printError,
  formatJson,
  formatPhone,
  printSection,
} from "../lib/formatters";

const devices = {
  async list(): Promise<void> {
    const client = globalThis.apiClient;
    const outputJson = globalThis.cliOptions.json;

    const tokens = (await client.get("/device-tokens")) as Array<
      Record<string, unknown>
    >;

    if (outputJson) {
      console.log(formatJson(tokens));
      return;
    }

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      console.log(chalk.gray("No device tokens registered"));
      return;
    }

    console.log();
    console.log(chalk.bold.blue("FCM Device Tokens"));
    console.log();

    const table = createTable(["ID", "Platform", "Token", "Created"]);

    tokens.forEach((token) => {
      table.push([
        (token.id as string)?.slice(0, 8) || "—",
        (token.platform as string) || "—",
        (token.token as string)?.slice(0, 20) + "..." || "—",
        new Date(token.createdAt as string).toLocaleDateString() || "—",
      ]);
    });

    console.log(table.toString());
    console.log();
  },

  async add(
    token: string,
    options: { name?: string; platform?: string },
  ): Promise<void> {
    const client = globalThis.apiClient;
    const outputJson = globalThis.cliOptions.json;

    const spinner = ora("Adding device token...").start();

    try {
      const result = (await client.post("/device-tokens", {
        body: {
          token,
          platform: options.platform || "web",
          name: options.name,
        } as Record<string, unknown>,
      })) as Record<string, unknown>;

      spinner.succeed("Device token added");

      if (outputJson) {
        console.log(formatJson(result));
      } else {
        printSuccess(`Token ID: ${result.id}`);
      }
    } catch (error) {
      spinner.fail("Failed to add device token");
      throw error;
    }
  },

  async remove(id: string): Promise<void> {
    const client = globalThis.apiClient;
    const outputJson = globalThis.cliOptions.json;

    const spinner = ora("Removing device token...").start();

    try {
      await client.delete(`/device-tokens/${id}` as "/device-tokens/{id}");
      spinner.succeed("Device token removed");

      if (!outputJson) {
        printSuccess(`Removed token: ${id}`);
      }
    } catch (error) {
      spinner.fail("Failed to remove device token");
      throw error;
    }
  },
};

/**
 * SMS recipients
 */
const sms = {
  async list(): Promise<void> {
    const client = globalThis.apiClient;
    const outputJson = globalThis.cliOptions.json;

    const recipients = (await client.get("/sms-recipients")) as Array<
      Record<string, unknown>
    >;

    if (outputJson) {
      console.log(formatJson(recipients));
      return;
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      console.log(chalk.gray("No SMS recipients registered"));
      return;
    }

    console.log();
    console.log(chalk.bold.blue("SMS Recipients"));
    console.log();

    const table = createTable(["ID", "Name", "Phone", "Active", "Created"]);

    recipients.forEach((recipient) => {
      const active = recipient.active ? chalk.green("✓") : chalk.gray("○");
      table.push([
        (recipient.id as string)?.slice(0, 8) || "—",
        (recipient.name as string) || "—",
        formatPhone(recipient.phone as string) || "—",
        active,
        new Date(recipient.createdAt as string).toLocaleDateString() || "—",
      ]);
    });

    console.log(table.toString());
    console.log();
  },

  async add(phone: string, options: { name?: string }): Promise<void> {
    const client = globalThis.apiClient;
    const outputJson = globalThis.cliOptions.json;

    // Validate phone number format
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length !== 10 && cleaned.length !== 11) {
      printError(
        "Invalid phone number. Use format: +15555551234 or 5555551234",
      );
      process.exit(3);
    }

    const spinner = ora("Adding SMS recipient...").start();

    try {
      const result = (await client.post("/sms-recipients", {
        body: {
          phone,
          name: options.name,
        } as Record<string, unknown>,
      })) as Record<string, unknown>;

      spinner.succeed("SMS recipient added");

      if (outputJson) {
        console.log(formatJson(result));
      } else {
        printSuccess(`Recipient ID: ${result.id}`);
        printSuccess(`Phone: ${formatPhone(result.phone as string)}`);
      }
    } catch (error) {
      spinner.fail("Failed to add SMS recipient");
      throw error;
    }
  },

  async remove(id: string): Promise<void> {
    const client = globalThis.apiClient;
    const outputJson = globalThis.cliOptions.json;

    const spinner = ora("Removing SMS recipient...").start();

    try {
      await client.delete(`/sms-recipients/${id}` as "/sms-recipients/{id}");
      spinner.succeed("SMS recipient removed");

      if (!outputJson) {
        printSuccess(`Removed recipient: ${id}`);
      }
    } catch (error) {
      spinner.fail("Failed to remove SMS recipient");
      throw error;
    }
  },
};

/**
 * Test notification (trigger evaluation)
 */
async function test(): Promise<void> {
  const client = globalThis.apiClient;
  const outputJson = globalThis.cliOptions.json;

  const spinner = ora("Triggering test evaluation...").start();

  try {
    const result = (await client.post("/evaluations/trigger", {})) as Record<
      string,
      unknown
    >;

    spinner.succeed("Test evaluation triggered");

    if (outputJson) {
      console.log(formatJson(result));
    } else {
      printSection("Evaluation Result");
      console.log(chalk.gray("Status:"), result.status || "—");
      console.log(chalk.gray("Overdue:"), result.overdue || 0);
      console.log(chalk.gray("Upcoming:"), result.upcoming || 0);
      console.log(
        chalk.gray("Sent:"),
        result.sent ? chalk.green("✓") : chalk.gray("○"),
      );
      console.log();
    }
  } catch (error) {
    spinner.fail("Failed to trigger test evaluation");
    throw error;
  }
}

export const notificationsCommand = {
  devices,
  sms,
  test,
};
