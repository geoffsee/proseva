import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join } from "path";

const __dir =
  import.meta.dir ??
  import.meta.dirname ??
  new URL(".", import.meta.url).pathname;

let client: Client | null = null;
let transport: StdioClientTransport | null = null;

async function ensureClient(): Promise<Client> {
  if (client) return client;

  const mcpServerPath = join(__dir, "mcp-case-server.ts");
  const args = ["run", mcpServerPath];

  console.info(
    `[mcp-case-client] spawning case-management server: bun ${args.join(" ")}`,
  );

  transport = new StdioClientTransport({ command: "bun", args });
  client = new Client({ name: "proseva-server-case", version: "1.0.0" });
  await client.connect(transport);

  console.info("[mcp-case-client] case-management server connected");
  return client;
}

export async function callCaseTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  try {
    const c = await ensureClient();
    const result = await c.callTool({
      name,
      arguments: args,
    });
    const text =
      result.content && Array.isArray(result.content)
        ? (result.content[0] as { text?: string })?.text
        : undefined;
    return text ?? JSON.stringify({ error: "No response from case tool" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[mcp-case-client] callCaseTool ${name} failed: ${message}`);
    return JSON.stringify({ error: `Case tool '${name}' failed: ${message}` });
  }
}

export async function getCaseTools() {
    try {
        const c = await ensureClient();
        const result = await c.listTools();
        return result.tools.map(tool => ({
            type: "function" as const,
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema
            }
        }));
    } catch (error) {
        console.error(`[mcp-case-client] getCaseTools failed`, error);
        return [];
    }
}

export async function closeCaseMcpClient(): Promise<void> {
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
