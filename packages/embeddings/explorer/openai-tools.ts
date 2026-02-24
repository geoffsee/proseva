/**
 * OpenAI-format tool definitions for the embeddings explorer.
 * Mirrors the Anthropic tool definitions used in scenario.ts.
 */

export const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_stats",
      description:
        "Get an overview of the knowledge graph dataset: total node count, edge count, embedding count, and breakdowns by node type and edge type. Call this first to understand what data is available.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_nodes",
      description:
        "Search for nodes in the knowledge graph. Filter by node type and/or a search term that matches against source and source_id. Returns nodes with truncated sourceText (500 chars max); use get_node for the full text.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", description: "Filter by node type, e.g. 'section', 'court', 'title', 'constitution_section', 'authority'" },
          search: { type: "string", description: "Search term to match against source and source_id fields" },
          limit: { type: "number", description: "Max results to return (default 20, max 200)" },
          offset: { type: "number", description: "Pagination offset (default 0)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_node",
      description:
        "Get full details of a specific node by its integer ID, including the complete sourceText (the actual law text, court info, etc.) and all edges connected to this node.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number", description: "The node ID" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_neighbors",
      description:
        "Get all edges connected to a node, with the resolved fromNode and toNode details. Use this to traverse the graph and discover related legal provisions.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number", description: "The node ID to get neighbors for" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "find_similar",
      description:
        "Find nodes with the most similar embeddings to a given node using cosine similarity. Useful for discovering semantically related legal provisions that may not be directly linked by edges.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number", description: "The node ID to find similar nodes for" },
          limit: { type: "number", description: "Number of similar nodes to return (default 10, max 50)" },
        },
        required: ["id"],
      },
    },
  },
];
