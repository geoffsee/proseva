#!/usr/bin/env bun

import { Command } from "commander";
import { ApiClient, ApiError } from "../lib/api-client";
import { printError } from "../lib/formatters";
import { statusCommand } from "../commands/status";
import { configCommand } from "../commands/config";
import { dbCommand } from "../commands/db";
import { notificationsCommand } from "../commands/notifications";
import { scanCommand } from "../commands/scan";
import { authCommand, readToken } from "../commands/auth";
import "../lib/globals";

const program = new Command();

program
  .name("proseva")
  .description("CLI for managing Pro-Se-VA server remotely")
  .version("0.1.0")
  .option(
    "--api-url <url>",
    "Server URL",
    process.env.PROSEVA_API_URL || "http://localhost:3001",
  )
  .option("--json", "Output as JSON")
  .option("--verbose", "Verbose logging")
  .hook("preAction", async (thisCommand) => {
    // Make options available globally
    const opts = thisCommand.optsWithGlobals() as CliOptions;
    globalThis.cliOptions = opts;

    // Load stored token
    const tokenData = await readToken();
    const token = tokenData?.token;

    // Create API client
    const apiUrl = opts.apiUrl.replace(/\/$/, ""); // Remove trailing slash
    globalThis.apiClient = new ApiClient({
      baseUrl: `${apiUrl}/api`,
      verbose: opts.verbose,
      token,
    });
  });

// Status command
program
  .command("status")
  .description("Show system status dashboard")
  .option("--watch", "Watch mode (refresh every 5 seconds)")
  .action(async (options) => {
    try {
      await statusCommand(options);
    } catch (error) {
      handleError(error);
    }
  });

// Auth commands
const auth = program.command("auth").description("Authentication management");

auth
  .command("login")
  .description("Login with passphrase and get authentication token")
  .option("--ttl <duration>", "Token time-to-live (e.g., 24h, 7d, 30m)", "24h")
  .action(async (options) => {
    try {
      await authCommand.login(options);
    } catch (error) {
      handleError(error);
    }
  });

auth
  .command("logout")
  .description("Remove stored authentication token")
  .action(async () => {
    try {
      await authCommand.logout();
    } catch (error) {
      handleError(error);
    }
  });

auth
  .command("status")
  .description("Show authentication status")
  .action(async () => {
    try {
      await authCommand.status();
    } catch (error) {
      handleError(error);
    }
  });

// Config commands
const config = program
  .command("config")
  .description("Configuration management");

config
  .command("get [key]")
  .description("View configuration (all or specific key)")
  .action(async (key) => {
    try {
      await configCommand.get(key);
    } catch (error) {
      handleError(error);
    }
  });

config
  .command("set <key> <value>")
  .description("Set configuration value")
  .action(async (key, value) => {
    try {
      await configCommand.set(key, value);
    } catch (error) {
      handleError(error);
    }
  });

config
  .command("reset [group]")
  .description("Reset to environment defaults")
  .action(async (group) => {
    try {
      await configCommand.reset(group);
    } catch (error) {
      handleError(error);
    }
  });

config
  .command("test <service>")
  .description("Test service connection (firebase|twilio|openai)")
  .action(async (service) => {
    try {
      await configCommand.test(service);
    } catch (error) {
      handleError(error);
    }
  });

config
  .command("reinit <service>")
  .description("Reinitialize service (firebase|twilio|scheduler)")
  .action(async (service) => {
    try {
      await configCommand.reinit(service);
    } catch (error) {
      handleError(error);
    }
  });

// Database commands
const db = program.command("db").description("Database operations");

db.command("stats")
  .description("Show entity counts")
  .action(async () => {
    try {
      await dbCommand.stats();
    } catch (error) {
      handleError(error);
    }
  });

db.command("export <format>")
  .description("Export data (json|csv)")
  .action(async (format) => {
    try {
      await dbCommand.export(format);
    } catch (error) {
      handleError(error);
    }
  });

// Scan command
program
  .command("scan <directory>")
  .description("Scan directory and ingest PDF documents")
  .option("--watch", "Watch mode for continuous scanning")
  .action(async (directory, options) => {
    try {
      await scanCommand(directory, options);
    } catch (error) {
      handleError(error);
    }
  });

// Notifications commands
const notifications = program
  .command("notifications")
  .description("Notification management");

// Device tokens
const devices = notifications
  .command("devices")
  .description("FCM device token management");

devices
  .command("list")
  .description("List FCM device tokens")
  .action(async () => {
    try {
      await notificationsCommand.devices.list();
    } catch (error) {
      handleError(error);
    }
  });

devices
  .command("add <token>")
  .description("Add device token")
  .option("-n, --name <name>", "Device name")
  .option("-p, --platform <platform>", "Platform (ios|android|web)", "web")
  .action(async (token, options) => {
    try {
      await notificationsCommand.devices.add(token, options);
    } catch (error) {
      handleError(error);
    }
  });

devices
  .command("remove <id>")
  .description("Remove device token")
  .action(async (id) => {
    try {
      await notificationsCommand.devices.remove(id);
    } catch (error) {
      handleError(error);
    }
  });

// SMS recipients
const sms = notifications
  .command("sms")
  .description("SMS recipient management");

sms
  .command("list")
  .description("List SMS recipients")
  .action(async () => {
    try {
      await notificationsCommand.sms.list();
    } catch (error) {
      handleError(error);
    }
  });

sms
  .command("add <phone>")
  .description("Add SMS recipient")
  .option("-n, --name <name>", "Recipient name")
  .action(async (phone, options) => {
    try {
      await notificationsCommand.sms.add(phone, options);
    } catch (error) {
      handleError(error);
    }
  });

sms
  .command("remove <id>")
  .description("Remove SMS recipient")
  .action(async (id) => {
    try {
      await notificationsCommand.sms.remove(id);
    } catch (error) {
      handleError(error);
    }
  });

// Test notification
notifications
  .command("test")
  .description("Trigger test evaluation")
  .action(async () => {
    try {
      await notificationsCommand.test();
    } catch (error) {
      handleError(error);
    }
  });

program.parse();

/**
 * Global error handler
 */
function handleError(error: unknown): void {
  if (error instanceof ApiError) {
    if (error.isNetworkError() || error.status === 0) {
      printError(
        `Cannot connect to server at ${globalThis.cliOptions.apiUrl}. Is it running?`,
      );
      process.exit(2);
    }

    if (error.isNotFound()) {
      printError("Resource not found");
      process.exit(1);
    }

    if (error.isValidationError()) {
      printError(`Validation error: ${JSON.stringify(error.body)}`);
      process.exit(3);
    }

    if (error.isServerError()) {
      printError(`Server error: ${JSON.stringify(error.body)}`);
      process.exit(1);
    }

    printError(`API error: ${error.message}`);
    process.exit(1);
  }

  if (error instanceof Error) {
    printError(error.message);
    if (globalThis.cliOptions.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }

  printError(`Unknown error: ${error}`);
  process.exit(1);
}
