# Explorer Knowledge Flow — MCP-Based Control Flow

This document reflects the current architecture after moving explorer-style tools into MCP servers.  
There is no local `executeExplorerTool` path in `chat.router.ts`; tool discovery and execution are dynamic.

## 1. Tool Registry and Routing

`/chat` builds its tool list at runtime:

- `caseTools = await getCaseTools()`
- `knowledgeTools = await getKnowledgeTools()`
- `tools = [...caseTools, ...knowledgeTools]`

Routing in `executeTool(name, args)` is now:

```mermaid
flowchart TD
    A["executeTool"] --> B{"Case tool?"}
    B -->|Yes| C["callCaseTool"]
    B -->|No| D{"SearchKnowledge tool?"}
    D -->|Yes| E["Embed query then searchKnowledge"]
    D -->|No| F{"Knowledge tool?"}
    F -->|Yes| G["callKnowledgeTool"]
    F -->|No| H["Return unknown tool error"]
```

Notes:

- `SearchKnowledge` is handled specially for embedding generation and dimension checks.
- `search_nodes`, `get_node`, `get_neighbors`, etc. are MCP knowledge tools.
- `parseSearchNodesTotal` is still used for telemetry + fallback logic (`search_nodes` empty-result detection).

## 2. `/chat` Standard Two-Phase Path

```mermaid
flowchart TD
    A["POST /api/chat"] --> B["Build system prompt and graph snapshot"]
    B --> C["Load tools from MCP servers"]
    C --> D{"Deterministic graph flow for legal query?"}
    D -->|No| E["Phase 1 tool loop with TEXT_MODEL_SMALL"]
    E --> F["Collect tool calls and tool results"]
    F --> G["Run summary grounding tool GetKnowledgeNNTopK3Chunks"]
    G --> H["Build Phase 2 messages from transcript and summary"]
    H --> I["Generate final answer with TEXT_MODEL_LARGE"]
```

Key differences vs old docs:

- Tool descriptions and labels are generated from runtime tool metadata, not hardcoded lists.
- Tool set size is dynamic (depends on what MCP servers expose).
- Phase 2 uses the full tool transcript plus summary context.

## 3. Deterministic Graph Flow Branch

When `CHAT_DETERMINISTIC_GRAPH` is enabled and the query is likely legal, `/chat` delegates to
`runDeterministicGraphOrchestration(...)`.

```mermaid
flowchart TD
    A["Deterministic graph orchestration"] --> B["Optional context optimization"]
    B --> C["Parallel: MCP semantic search and GraphQL introspection"]
    C --> D["Plan up to 4 GraphQL queries with TEXT_MODEL_SMALL"]
    D --> E["Execute planned GraphQL queries against explorer endpoint"]
    E --> F["Summarize MCP and GraphQL retrieval results"]
    F --> G["Return conversation messages and summary"]
    G --> H["Final generation in /chat with TEXT_MODEL_LARGE"]
```

## 4. Logging Update: Raw MCP JSON

`chat/chat-graphql-orchestrator.ts` now logs full raw semantic-search output:

```text
[chat][graph-flow] MCP semantic search done answers=5 context=15 raw={...full JSON...}
```

This is emitted in the deterministic graph-flow path right after `searchKnowledge(...)` returns.

## 5. Deprecated Paths Removed

The following are obsolete in chat routing and should not be reintroduced:

- Local explorer dispatcher (`executeExplorerTool`)
- Explorer tool type guard in router (`isExplorerToolName`)
- Hardcoded static tool-semantic lists for explorer tools
