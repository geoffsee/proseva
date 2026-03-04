import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join, resolve } from "path";
import { existsSync } from "fs";

const __dir =
  import.meta.dir ??
  import.meta.dirname ??
  new URL(".", import.meta.url).pathname;

let client: Client | null = null;
let transport: StdioClientTransport | null = null;

function resolveDatasetFile(fileName: string): string | null {
  const datasetsDir = process.env.DATASETS_DIR;
  if (!datasetsDir) return null;
  const serverPackageRoot = join(__dir, "..");
  const candidates = Array.from(
    new Set([
      resolve(datasetsDir, fileName),
      resolve(serverPackageRoot, datasetsDir, fileName),
    ]),
  );
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

async function ensureClient(): Promise<Client> {
  if (client) return client;

  const mcpServerPath = join(__dir, "mcp-sqlite-server.ts");
  const dbPath = resolveDatasetFile("virginia.db");
  if (!dbPath) {
    throw new Error(
      "[mcp-sqlite-client] virginia.db not found in DATASETS_DIR",
    );
  }

  const args = ["run", mcpServerPath, "--db", dbPath];
  console.info(
    `[mcp-sqlite-client] spawning sqlite-readonly server: bun ${args.join(" ")}`,
  );

  transport = new StdioClientTransport({ command: "bun", args });
  client = new Client({ name: "proseva-server-sqlite", version: "1.0.0" });
  await client.connect(transport);

  console.info("[mcp-sqlite-client] sqlite-readonly server connected");
  return client;
}

export async function callSqliteTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  try {
    const c = await ensureClient();
    const result = await c.callTool({ name, arguments: args });
    const text =
      result.content && Array.isArray(result.content)
        ? (result.content[0] as { text?: string })?.text
        : undefined;
    return text ?? JSON.stringify({ error: "No response from sqlite tool" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[mcp-sqlite-client] callSqliteTool ${name} failed: ${message}`,
    );
    return JSON.stringify({
      error: `SQLite tool '${name}' failed: ${message}`,
    });
  }
}

export async function getSqliteTools() {
  try {
    const c = await ensureClient();
    const result = await c.listTools();
    return result.tools.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  } catch (error) {
    console.error(`[mcp-sqlite-client] getSqliteTools failed`, error);
    return [];
  }
}

export async function closeSqliteMcpClient(): Promise<void> {
  if (client) {
    try {
      await client.close();
    } catch {}
    client = null;
  }
  if (transport) {
    try {
      await transport.close();
    } catch {}
    transport = null;
  }
}
