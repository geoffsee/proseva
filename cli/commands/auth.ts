import { mkdir, readFile, writeFile, unlink } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { stdin as input, stdout as output } from "process";
import { createInterface } from "readline";
import chalk from "chalk";
import { printError } from "../lib/formatters";

const CONFIG_DIR = join(homedir(), ".proseva");
const TOKEN_FILE = join(CONFIG_DIR, "token.json");

interface TokenData {
  token: string;
  expiresAt: number;
  apiUrl: string;
}

/**
 * Read stored token from disk
 */
export async function readToken(): Promise<TokenData | null> {
  try {
    const data = await readFile(TOKEN_FILE, "utf-8");
    const tokenData: TokenData = JSON.parse(data);

    // Check if token is expired
    if (tokenData.expiresAt < Date.now()) {
      // Token expired, remove it
      await unlink(TOKEN_FILE).catch(() => {});
      return null;
    }

    return tokenData;
  } catch {
    return null;
  }
}

/**
 * Write token to disk
 */
async function writeToken(tokenData: TokenData): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(TOKEN_FILE, JSON.stringify(tokenData, null, 2));
}

/**
 * Remove stored token
 */
async function removeToken(): Promise<void> {
  try {
    await unlink(TOKEN_FILE);
  } catch {
    // Token file doesn't exist, ignore
  }
}

/**
 * Prompt user for passphrase (hidden input)
 */
async function promptPassphrase(): Promise<string> {
  const rl = createInterface({ input, output });

  return new Promise((resolve) => {
    // Hide input by muting stdout
    const stdin = process.stdin;
    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }

    output.write("Passphrase: ");
    let passphrase = "";

    const onData = (char: Buffer) => {
      const str = char.toString("utf-8");

      if (str === "\n" || str === "\r" || str === "\r\n") {
        // Enter pressed
        if (stdin.isTTY) {
          stdin.setRawMode(false);
        }
        stdin.removeListener("data", onData);
        output.write("\n");
        rl.close();
        resolve(passphrase);
      } else if (str === "\x7f" || str === "\x08") {
        // Backspace
        if (passphrase.length > 0) {
          passphrase = passphrase.slice(0, -1);
          output.write("\b \b");
        }
      } else if (str === "\x03") {
        // Ctrl+C
        output.write("\n");
        rl.close();
        process.exit(0);
      } else if (str.charCodeAt(0) >= 32) {
        // Printable character
        passphrase += str;
        output.write("*");
      }
    };

    stdin.on("data", onData);
  });
}

/**
 * Login command - authenticate with passphrase and store token
 */
export async function login(options: { ttl?: string }): Promise<void> {
  const client = globalThis.apiClient;
  const apiUrl = globalThis.cliOptions.apiUrl;

  try {
    // Prompt for passphrase
    const passphrase = await promptPassphrase();

    if (!passphrase) {
      printError("Passphrase is required");
      process.exit(1);
    }

    // Request token from server
    const response = await client.post("/auth/login", {
      body: {
        passphrase,
        ttl: options.ttl,
      } as Record<string, unknown>, // Cast to satisfy generated types
    });

    if (!response || typeof response !== "object" || !("success" in response) || !("token" in response)) {
      printError("Authentication failed");
      process.exit(1);
    }

    const authResponse = response as {
      success: boolean;
      token: string;
      expiresIn: number;
    };

    // Store token
    const tokenData: TokenData = {
      token: authResponse.token,
      expiresAt: Date.now() + authResponse.expiresIn * 1000,
      apiUrl,
    };

    await writeToken(tokenData);

    console.log(chalk.green("✓ Authentication successful"));
    console.log(
      chalk.gray(
        `Token expires in ${Math.floor(authResponse.expiresIn / 3600)} hours`,
      ),
    );
    console.log(chalk.gray(`Stored in ${TOKEN_FILE}`));
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 401
    ) {
      printError("Invalid passphrase");
    } else {
      const message = error instanceof Error ? error.message : "Unknown error";
      printError(`Login failed: ${message}`);
    }
    process.exit(1);
  }
}

/**
 * Logout command - remove stored token
 */
export async function logout(): Promise<void> {
  await removeToken();
  console.log(chalk.green("✓ Logged out"));
}

/**
 * Status command - show token status
 */
export async function status(): Promise<void> {
  const tokenData = await readToken();

  if (!tokenData) {
    console.log(chalk.yellow("Not authenticated"));
    console.log(chalk.gray("Run 'proseva auth login' to authenticate"));
    return;
  }

  const expiresIn = Math.floor((tokenData.expiresAt - Date.now()) / 1000);
  const hours = Math.floor(expiresIn / 3600);
  const minutes = Math.floor((expiresIn % 3600) / 60);

  console.log(chalk.green("✓ Authenticated"));
  console.log(chalk.gray(`API URL: ${tokenData.apiUrl}`));
  console.log(chalk.gray(`Token expires in ${hours}h ${minutes}m`));
  console.log(chalk.gray(`Stored in ${TOKEN_FILE}`));
}

export const authCommand = {
  login,
  logout,
  status,
};
