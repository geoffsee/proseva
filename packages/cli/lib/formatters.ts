import chalk from "chalk";
import Table from "cli-table3";

/**
 * Format a configuration value, masking sensitive data
 */
export function formatConfigValue(
  value: string | undefined,
  isSensitive = false,
): string {
  if (!value) return chalk.gray("(not set)");
  if (isSensitive && value.startsWith("••••")) return chalk.yellow(value);
  return value;
}

/**
 * Format a source indicator (database or environment)
 */
export function formatSource(source: "database" | "environment"): string {
  return source === "database"
    ? chalk.green("database")
    : chalk.yellow("environment");
}

/**
 * Format a boolean status
 */
export function formatStatus(enabled: boolean): string {
  return enabled ? chalk.green("✓ Enabled") : chalk.gray("○ Disabled");
}

/**
 * Format a service status
 */
export function formatServiceStatus(
  name: string,
  configured: boolean,
  extraInfo?: string,
): string {
  const status = configured ? chalk.green("✓") : chalk.gray("○");
  const info = extraInfo ? chalk.gray(` (${extraInfo})`) : "";
  return `${status} ${name}${info}`;
}

/**
 * Create a table for displaying data
 */
export function createTable(headers: string[]): Table.Table {
  return new Table({
    head: headers.map((h) => chalk.cyan(h)),
    style: {
      head: [],
      border: ["gray"],
    },
  });
}

/**
 * Format a date string
 */
export function formatDate(date: string): string {
  return new Date(date).toLocaleString();
}

/**
 * Format a phone number
 */
export function formatPhone(phone: string): string {
  // Simple US phone number formatting
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

/**
 * Format entity counts
 */
export function formatCount(
  count: number,
  singular: string,
  plural?: string,
): string {
  const label = count === 1 ? singular : plural || `${singular}s`;
  return `${chalk.cyan(count)} ${label}`;
}

/**
 * Print a section header
 */
export function printSection(title: string): void {
  console.log();
  console.log(chalk.bold.underline(title));
  console.log();
}

/**
 * Print a success message
 */
export function printSuccess(message: string): void {
  console.log(chalk.green("✓"), message);
}

/**
 * Print an error message
 */
export function printError(message: string): void {
  console.log(chalk.red("✗"), message);
}

/**
 * Print a warning message
 */
export function printWarning(message: string): void {
  console.log(chalk.yellow("⚠"), message);
}

/**
 * Print an info message
 */
export function printInfo(message: string): void {
  console.log(chalk.blue("ℹ"), message);
}

/**
 * Format JSON output
 */
export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Print a horizontal rule
 */
export function printRule(): void {
  console.log(chalk.gray("━".repeat(60)));
}

/**
 * Print a key-value pair
 */
export function printKeyValue(key: string, value: string, indent = 0): void {
  const spaces = " ".repeat(indent);
  console.log(`${spaces}${chalk.gray(key + ":")} ${value}`);
}
