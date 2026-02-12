import chalk from "chalk";
import { join } from "path";
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import { homedir } from "os";
import {
  printSuccess,
  printError,
  printWarning,
  formatJson,
} from "../lib/formatters";
import type { ApiClient } from "../lib/api-client";

const CREDENTIALS_DIR = join(homedir(), ".proseva");
const CREDENTIALS_FILE = join(CREDENTIALS_DIR, "credentials");

/**
 * Load saved token from credentials file
 */
export async function loadToken(): Promise<string | null> {
  try {
    const content = await readFile(CREDENTIALS_FILE, "utf-8");
    const data = JSON.parse(content);
    return data.token || null;
  } catch {
    return null;
  }
}

/**
 * Save token to credentials file
 */
async function saveToken(token: string, expiresAt: string): Promise<void> {
  await mkdir(CREDENTIALS_DIR, { recursive: true });
  await writeFile(
    CREDENTIALS_FILE,
    JSON.stringify({ token, expiresAt }, null, 2),
  );
}

/**
 * Clear saved token
 */
async function clearToken(): Promise<void> {
  try {
    await unlink(CREDENTIALS_FILE);
  } catch {
    // File doesn't exist, that's fine
  }
}

/**
 * Login command
 */
async function login(passphrase?: string): Promise<void> {
  const client = (global as any).apiClient as ApiClient;
  const outputJson = (global as any).cliOptions.json;

  // Warn if passphrase provided as argument
  if (passphrase && !outputJson) {
    printWarning(
      "Security Warning: Passphrase provided as command argument may be exposed in shell history.",
    );
    console.log(
      chalk.dim("For better security, use: proseva auth login (without passphrase argument)"),
    );
    console.log();
  }

  // Prompt for passphrase if not provided
  if (!passphrase) {
    const { default: prompts } = await import("prompts");
    const response = await prompts({
      type: "password",
      name: "passphrase",
      message: "Enter passphrase:",
    });

    if (!response.passphrase) {
      printError("Passphrase is required");
      process.exit(1);
    }

    passphrase = response.passphrase;
  }

  try {
    // Call login endpoint
    // Note: Login endpoint is intentionally unauthenticated to allow users to obtain a token
    const response = await client.post("/auth/login", {
      body: { passphrase },
    });

    if (!response || !response.token) {
      printError("Failed to obtain token");
      process.exit(1);
    }

    // Save token
    await saveToken(response.token, response.expiresAt);

    if (outputJson) {
      console.log(formatJson(response));
      return;
    }

    printSuccess("Login successful!");
    console.log();
    console.log(
      chalk.dim(
        `Token expires: ${new Date(response.expiresAt).toLocaleString()}`,
      ),
    );
    console.log(
      chalk.dim(`Token saved to: ${CREDENTIALS_FILE}`),
    );
  } catch (error: any) {
    if (outputJson) {
      console.error(formatJson({ error: error.message }));
      process.exit(1);
    }

    if (error.status === 401) {
      printError("Invalid passphrase");
    } else if (error.status === 404) {
      printError(
        "No passphrase configured. Use POST /api/security/setup-passphrase to configure.",
      );
    } else {
      printError(`Login failed: ${error.message}`);
    }
    process.exit(1);
  }
}

/**
 * Logout command
 */
async function logout(): Promise<void> {
  const client = (global as any).apiClient as ApiClient;
  const outputJson = (global as any).cliOptions.json;

  try {
    // Load token to check if we're logged in
    const token = await loadToken();

    if (!token) {
      if (outputJson) {
        console.log(formatJson({ message: "No token found" }));
      } else {
        printWarning("No saved token found");
      }
      return;
    }

    // Call logout endpoint using API client (which has the token)
    try {
      await client.post("/auth/logout", {});
    } catch (apiError: any) {
      // If 401, token already invalid - that's fine
      if (apiError.status !== 401) {
        throw apiError;
      }
    }

    // Clear saved token
    await clearToken();

    if (outputJson) {
      console.log(formatJson({ success: true }));
      return;
    }

    printSuccess("Logout successful!");
    console.log(chalk.dim("Token removed from local storage"));
  } catch (error: any) {
    // Even if logout fails, clear local token
    await clearToken();

    if (outputJson) {
      console.log(formatJson({ success: true, note: "Local token cleared" }));
      return;
    }

    printWarning("Token cleared from local storage");
  }
}

/**
 * Check token status
 */
async function status(): Promise<void> {
  const client = (global as any).apiClient as ApiClient;
  const outputJson = (global as any).cliOptions.json;

  try {
    const token = await loadToken();

    if (!token) {
      if (outputJson) {
        console.log(
          formatJson({ authenticated: false, message: "No token found" }),
        );
      } else {
        printWarning("Not authenticated. Use 'proseva auth login' to login.");
      }
      process.exit(1);
    }

    // Verify token with server using API client
    const data = await client.get("/auth/verify");

    if (outputJson) {
      console.log(formatJson(data));
      return;
    }

    if (data.valid) {
      printSuccess("Authenticated");
      console.log(chalk.dim("Token is valid"));
    } else {
      printError("Token is invalid or expired");
      console.log(chalk.dim("Use 'proseva auth login' to re-authenticate"));
      process.exit(1);
    }
  } catch (error: any) {
    if (outputJson) {
      console.error(
        formatJson({ authenticated: false, error: error.message }),
      );
    } else {
      printError(`Failed to check authentication status: ${error.message}`);
    }
    process.exit(1);
  }
}

export const authCommand = {
  login,
  logout,
  status,
};
