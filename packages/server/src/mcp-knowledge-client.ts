import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join, resolve } from "path";
import { existsSync } from "fs";

const __dir =
  import.meta.dir ??
  import.meta.dirname ??
  new URL(".", import.meta.url).pathname;

type AnswerCandidate = {
  node_id: number;
  source: string;
  source_id: string;
  node_type: string;
  content: string;
  score: number;
  semantic_score: number;
  lexical_score: number;
  graph_coherence: number;
};

type ContextNode = {
  node_id: number;
  source: string;
  source_id: string;
  node_type: string;
  content: string;
  relation: string;
  anchor_node_id: number;
};

type StructuredSearchResult = {
  answers: AnswerCandidate[];
  context: ContextNode[];
};

let client: Client | null = null;
let transport: StdioClientTransport | null = null;
let cachedEmbeddingDim: number | null = null;

function resolveDatasetFile(
  fileName: "embeddings.sqlite.db" | "virginia.db",
): string | null {
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

  const mcpServerPath = join(__dir, "../../embeddings/mcp-server.ts");
  const args = ["run", mcpServerPath];

  const embPath = resolveDatasetFile("embeddings.sqlite.db");
  const virgPath = resolveDatasetFile("virginia.db");
  if (embPath) args.push("--embeddings", embPath);
  if (virgPath) args.push("--virginia", virgPath);

  console.info(
    `[mcp-client] spawning knowledge-search server: bun ${args.join(" ")}`,
  );

  transport = new StdioClientTransport({ command: "bun", args });
  client = new Client({ name: "proseva-server", version: "1.0.0" });
  await client.connect(transport);

  console.info("[mcp-client] knowledge-search server connected");
  return client;
}

export async function getEmbeddingDim(): Promise<number> {
  if (cachedEmbeddingDim !== null) {
    console.info(`[mcp-client] getEmbeddingDim cached=${cachedEmbeddingDim}`);
    return cachedEmbeddingDim;
  }
  try {
    console.info("[mcp-client] getEmbeddingDim calling MCP tool...");
    const c = await ensureClient();
    const result = await c.callTool({
      name: "get_embedding_dim",
      arguments: {},
    });
    console.info(
      `[mcp-client] getEmbeddingDim raw result: ${JSON.stringify(result.content)}`,
    );
    const text =
      result.content && Array.isArray(result.content)
        ? (result.content[0] as { text?: string })?.text
        : undefined;
    if (text) {
      const parsed = JSON.parse(text) as { dim?: number };
      console.info(
        `[mcp-client] getEmbeddingDim parsed dim=${parsed.dim} type=${typeof parsed.dim}`,
      );
      if (typeof parsed.dim === "number" && parsed.dim > 0) {
        cachedEmbeddingDim = parsed.dim;
        return parsed.dim;
      }
    }
    console.warn("[mcp-client] getEmbeddingDim: no valid dim in response");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[mcp-client] getEmbeddingDim failed: ${message}`);
  }
  return 0;
}

export async function searchKnowledge(
  queryEmbedding: number[],
  queryText: string,
  topK: number,
): Promise<StructuredSearchResult> {
  const emptyResult: StructuredSearchResult = { answers: [], context: [] };
  try {
    const c = await ensureClient();
    const result = await c.callTool({
      name: "search_knowledge",
      arguments: {
        query_embedding: queryEmbedding,
        query_text: queryText,
        top_k: topK,
      },
    });
    const text =
      result.content && Array.isArray(result.content)
        ? (result.content[0] as { text?: string })?.text
        : undefined;
    if (!text) return emptyResult;
    return JSON.parse(text) as StructuredSearchResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[mcp-client] searchKnowledge failed: ${message}`);
    return emptyResult;
  }
}

export async function callKnowledgeTool(
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
    return text ?? JSON.stringify({ error: "No response from knowledge tool" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[mcp-client] callKnowledgeTool ${name} failed: ${message}`);
    return JSON.stringify({ error: `Knowledge tool '${name}' failed: ${message}` });
  }
}

export async function getKnowledgeTools() {
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
    console.error(`[mcp-client] getKnowledgeTools failed`, error);
    return [];
  }
}

export async function closeMcpClient(): Promise<void> {
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
  cachedEmbeddingDim = null;
}
