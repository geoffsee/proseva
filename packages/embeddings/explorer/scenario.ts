import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync } from "fs";
import { createApp } from "./server";

// --- ANSI helpers ---

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
};

function printUser(text: string) {
  console.log(`\n${C.bold}${C.green}USER:${C.reset} ${text}`);
}

function printAssistant(text: string) {
  console.log(`\n${C.bold}${C.cyan}ASSISTANT:${C.reset} ${text}`);
}

function printToolCall(name: string, input: unknown) {
  const inputStr = JSON.stringify(input, null, 2);
  console.log(
    `\n${C.bold}${C.yellow}TOOL CALL:${C.reset} ${C.magenta}${name}${C.reset}`,
  );
  if (inputStr.length > 500) {
    console.log(`${C.dim}${inputStr.slice(0, 500)}...${C.reset}`);
  } else {
    console.log(`${C.dim}${inputStr}${C.reset}`);
  }
}

function printToolResult(name: string, result: string) {
  const maxLen = 1500;
  const display =
    result.length > maxLen
      ? result.slice(0, maxLen) + `\n... (${result.length} chars total)`
      : result;
  console.log(
    `${C.bold}${C.blue}TOOL RESULT:${C.reset} ${C.magenta}${name}${C.reset}`,
  );
  console.log(`${C.dim}${display}${C.reset}`);
}

// --- Tool definitions for the Anthropic SDK ---

const tools: Anthropic.Tool[] = [
  {
    name: "get_stats",
    description:
      "Get an overview of the knowledge graph dataset: total node count, edge count, embedding count, and breakdowns by node type and edge type. Call this first to understand what data is available.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "search_nodes",
    description:
      "Search for nodes in the knowledge graph. Filter by node type and/or a search term that matches against source and source_id. Returns nodes with truncated sourceText (500 chars max); use get_node for the full text.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          description:
            "Filter by node type, e.g. 'section', 'court', 'title', 'constitution_section', 'authority'",
        },
        search: {
          type: "string",
          description:
            "Search term to match against source and source_id fields",
        },
        limit: {
          type: "number",
          description: "Max results to return (default 20, max 200)",
        },
        offset: {
          type: "number",
          description: "Pagination offset (default 0)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_node",
    description:
      "Get full details of a specific node by its integer ID, including the complete sourceText (the actual law text, court info, etc.) and all edges connected to this node.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "number", description: "The node ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_neighbors",
    description:
      "Get all edges connected to a node, with the resolved fromNode and toNode details. Use this to traverse the graph and discover related legal provisions.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "number", description: "The node ID to get neighbors for" },
      },
      required: ["id"],
    },
  },
  {
    name: "find_similar",
    description:
      "Find nodes with the most similar embeddings to a given node using cosine similarity. Useful for discovering semantically related legal provisions that may not be directly linked by edges.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "number",
          description: "The node ID to find similar nodes for",
        },
        limit: {
          type: "number",
          description: "Number of similar nodes to return (default 10, max 50)",
        },
      },
      required: ["id"],
    },
  },
];

// --- GraphQL queries ---

const QUERIES: Record<string, string> = {
  get_stats: `{
    stats {
      nodeCount edgeCount embeddingCount
      nodeTypes { type count }
      edgeTypes { type count }
    }
  }`,

  search_nodes: `query ($type: String, $search: String, $limit: Int, $offset: Int) {
    nodes(type: $type, search: $search, limit: $limit, offset: $offset) {
      total
      nodes { id source sourceId chunkIdx nodeType hasEmbedding sourceText }
    }
  }`,

  get_node: `query ($id: Int!) {
    node(id: $id) {
      id source sourceId chunkIdx nodeType hasEmbedding sourceText
      edges { fromId toId relType weight }
    }
  }`,

  get_neighbors: `query ($id: Int!) {
    neighbors(id: $id) {
      fromId toId relType weight
      fromNode { id source sourceId nodeType }
      toNode { id source sourceId nodeType }
    }
  }`,

  find_similar: `query ($id: Int!, $limit: Int) {
    similar(id: $id, limit: $limit) {
      score
      node { id source sourceId nodeType hasEmbedding sourceText }
    }
  }`,
};

// --- GraphQL executor (direct yoga.fetch, no HTTP server) ---

type YogaInstance = ReturnType<typeof createApp>["yoga"];

async function gql(
  yoga: YogaInstance,
  query: string,
  variables: Record<string, unknown> = {},
) {
  const res = await yoga.fetch("http://localhost/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return res.json() as Promise<{ data?: any; errors?: any[] }>;
}

function truncateSourceText(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(truncateSourceText);
  if (typeof obj === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "sourceText" && typeof v === "string" && v.length > 500) {
        out[k] = v.slice(0, 500) + "...";
      } else {
        out[k] = truncateSourceText(v);
      }
    }
    return out;
  }
  return obj;
}

async function executeTool(
  yoga: YogaInstance,
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  const query = QUERIES[name];
  if (!query) return JSON.stringify({ error: `Unknown tool: ${name}` });

  const variables: Record<string, unknown> = {};
  if (name === "search_nodes") {
    if (input.type) variables.type = input.type;
    if (input.search) variables.search = input.search;
    variables.limit = input.limit ?? 20;
    variables.offset = input.offset ?? 0;
  } else if (name === "get_node" || name === "get_neighbors") {
    variables.id = input.id;
  } else if (name === "find_similar") {
    variables.id = input.id;
    if (input.limit) variables.limit = input.limit;
  }

  const result = await gql(yoga, query, variables);

  if (result.errors) {
    return JSON.stringify({ errors: result.errors });
  }

  // Truncate sourceText in search results to prevent context blowup
  if (name === "search_nodes" || name === "find_similar") {
    return JSON.stringify(truncateSourceText(result.data));
  }

  return JSON.stringify(result.data);
}

// --- System prompt ---

const SYSTEM_PROMPT = `You are a legal research assistant with access to a Virginia law knowledge graph. The graph contains:

- **Nodes**: Virginia Code sections, Constitution sections, courts, authorities (agencies), popular names (commonly known laws), and documents
- **Edges**: Relationships between nodes such as "cites", "contains", "amends", etc.
- **Embeddings**: Semantic vectors for finding similar provisions by meaning, not just by text match

**Your methodology:**
1. Start with \`get_stats\` to understand the dataset scope
2. Use \`search_nodes\` to find relevant sections by type and keyword
3. Use \`get_node\` to read the full text of promising results
4. Use \`get_neighbors\` to traverse the graph and find related provisions
5. Use \`find_similar\` to discover semantically related provisions that may not be directly linked
6. Synthesize your findings into a clear research memo

**Important notes:**
- \`search_nodes\` returns truncated sourceText (500 chars). Always use \`get_node\` for the full text of important sections.
- Node IDs are integers. Use the IDs from search results in subsequent calls.
- When exploring, cast a wide net first, then drill into the most relevant results.
- Always cite specific section numbers and node IDs in your analysis.`;

// --- Scenario prompts ---

const SCENARIOS: Record<string, string> = {
  foia: `Research Virginia's Freedom of Information Act (FOIA). I need to understand:
1. What are the key provisions of Virginia's FOIA?
2. What exemptions exist?
3. How does it relate to other transparency laws in the code?
Please search the knowledge graph thoroughly and provide a research memo with specific code section citations.`,

  courts: `I need a comprehensive overview of Virginia's court system based on the knowledge graph. Please research:
1. What types of courts exist in the dataset?
2. How are they organized (districts, localities)?
3. What code sections govern court jurisdiction and procedures?
Explore the graph structure to find connections between court entries and relevant code sections.`,

  constitutional: `Analyze the constitutional provisions in the Virginia knowledge graph. I'd like to understand:
1. What constitutional sections are represented in the dataset?
2. How do they connect to implementing code sections?
3. Are there any interesting semantic similarities between constitutional provisions and code sections?
Use both graph traversal and embedding similarity to find connections.`,
};

// --- Agentic loop ---

async function runScenario(
  client: Anthropic,
  yoga: YogaInstance,
  scenario: string,
  prompt: string,
): Promise<string> {
  console.log(`\n${C.bold}${"=".repeat(60)}${C.reset}`);
  console.log(`${C.bold}Scenario: ${scenario}${C.reset}`);
  console.log(`${"=".repeat(60)}`);

  printUser(prompt);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: prompt },
  ];
  const maxTurns = 25;
  let finalText = "";

  for (let turn = 0; turn < maxTurns; turn++) {
    console.log(`\n${C.dim}--- Turn ${turn + 1}/${maxTurns} ---${C.reset}`);

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    // Collect text and tool_use blocks
    const textParts: string[] = [];
    const toolUseBlocks: Anthropic.ToolUseBlock[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        textParts.push(block.text);
      } else if (block.type === "tool_use") {
        toolUseBlocks.push(block);
      }
    }

    if (textParts.length > 0) {
      finalText = textParts.join("\n");
      printAssistant(finalText);
    }

    // If stop_reason is end_turn (no tool calls), we're done
    if (response.stop_reason === "end_turn") {
      console.log(
        `\n${C.bold}${C.green}Scenario complete after ${turn + 1} turns.${C.reset}`,
      );
      break;
    }

    // Process tool calls
    if (response.stop_reason === "tool_use" && toolUseBlocks.length > 0) {
      // Add the assistant's response to messages
      messages.push({ role: "assistant", content: response.content });

      // Execute all tool calls (may be parallel)
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tb of toolUseBlocks) {
        printToolCall(tb.name, tb.input);
        const result = await executeTool(
          yoga,
          tb.name,
          tb.input as Record<string, unknown>,
        );
        printToolResult(tb.name, result);
        toolResults.push({
          type: "tool_result",
          tool_use_id: tb.id,
          content: result,
        });
      }

      messages.push({ role: "user", content: toolResults });
    }
  }

  return finalText;
}

// --- CLI entrypoint ---

if (import.meta.main) {
  const args = process.argv.slice(2);
  let embeddingsPath = "";
  let virginiaPath = "";
  let scenarioName = "foia";

  try {
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--embeddings" && args[i + 1])
        embeddingsPath = args[++i]!;
      else if (args[i] === "--virginia" && args[i + 1])
        virginiaPath = args[++i]!;
      else if (args[i] === "--scenario" && args[i + 1])
        scenarioName = args[++i]!;
    }
  } catch (e) {
    console.error("ERROR PARSING COMMAND LINE ARGUMENTS");
    console.error(e);
  }

  if (!embeddingsPath) {
    console.error(
      "Usage: bun scenario.ts --embeddings <path> [--virginia <path>] [--scenario <name>]",
    );
    console.error(
      `\nAvailable scenarios: ${Object.keys(SCENARIOS).join(", ")}`,
    );
    process.exit(1);
  }

  if (!SCENARIOS[scenarioName]) {
    console.error(`Unknown scenario: ${scenarioName}`);
    console.error(`Available scenarios: ${Object.keys(SCENARIOS).join(", ")}`);
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY environment variable is required");
    process.exit(1);
  }

  const client = new Anthropic();
  const { yoga, cleanup } = createApp(
    embeddingsPath,
    virginiaPath || undefined,
  );

  const outPath = `scenario-${scenarioName}.md`;

  try {
    const result = await runScenario(
      client,
      yoga,
      scenarioName,
      SCENARIOS[scenarioName]!,
    );
    writeFileSync(outPath, result);
    console.log(`\n${C.bold}Output written to ${outPath}${C.reset}`);
  } finally {
    cleanup();
  }
}
