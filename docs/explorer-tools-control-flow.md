# Explorer Tools Integration — Control Flow

This document illustrates how the Virginia law knowledge graph explorer tools flow through the system, from Electron process startup through chat and research agent tool dispatch, using concrete example scenarios.

---

## 1. Process Startup

When the Electron app launches, it starts three processes: the main Electron window, the ProSeVA server, and the explorer process. The server receives `EXPLORER_URL` so it knows where to send GraphQL queries.

```mermaid
sequenceDiagram
    participant E as Electron Main
    participant S as ProSeVA Server
    participant X as Explorer Process

    E->>E: initDataDir()
    E->>S: spawn(server, {PROSEVA_DATA_DIR, PORT, EXPLORER_URL})
    E->>X: spawn(explorer, --embeddings db --port 3002)

    par Health Checks
        loop max 30 retries, 500ms
            E->>S: GET /api/health
            S-->>E: 200 OK
        end
    and
        loop max 20 retries, 500ms
            E->>X: POST /graphql { __typename }
            X-->>E: 200 OK
        end
    end

    alt Server ready
        E->>E: createWindow()
    else Server failed
        E->>E: showErrorBox() → quit
    end

    Note over E,X: Explorer failure is non-fatal.<br/>App continues without knowledge graph.
```

---

## 2. Chat Endpoint — Two-Phase Flow

The chat endpoint uses a two-phase architecture to separate tool execution from conversational response generation. Phase 1 uses `TEXT_MODEL_SMALL` (cheap, fast, good at structured tool use) to run the tool-calling loop. Phase 2 uses `TEXT_MODEL_LARGE` (better natural language) with a clean context — no tool schemas — to produce the final user-facing reply.

```mermaid
flowchart TD
    A[POST /chat<br/>messages array] --> B[Create OpenAI client]
    B --> C[Build system prompt<br/>+ graph snapshot<br/>+ explorer tool note]
    C --> D[Define tools array<br/>8 local + 5 explorer = 13 tools]

    D --> P1["<b>Phase 1: Tool-calling (TEXT_MODEL_SMALL)</b>"]
    P1 --> E[Build toolMessages<br/>system + user history]
    E --> F{Tool-calling loop<br/>i < 10}

    F -->|iteration| G[chat.completions.create<br/>TEXT_MODEL_SMALL + tools]
    G --> H{tool_calls present?}

    H -->|Yes| I[Push assistant msg to toolMessages]
    I --> J[For each tool_call:<br/>parse args → executeTool<br/>→ collect result → push to toolMessages]
    J --> F

    H -->|No| BREAK[break loop]
    F -->|i = 10 exhausted| BREAK

    BREAK --> P2["<b>Phase 2: Conversational (TEXT_MODEL_LARGE)</b>"]
    P2 --> M[Build fresh conversationMessages<br/>system + user history]
    M --> N{collectedToolResults<br/>not empty?}
    N -->|Yes| O[Inject assistant message:<br/>tool results summary]
    N -->|No| Q[No extra context needed]
    O --> R[chat.completions.create<br/>TEXT_MODEL_LARGE, <b>no tools param</b>]
    Q --> R
    R --> S[Return finalCompletion.message.content]
```

---

## 3. Research Agent — Two-Phase Flow

Like the chat endpoint, the research agent uses a two-phase architecture. Phase 1 uses `TEXT_MODEL_SMALL` for tool-calling, accumulating `toolResults` for the sidebar. Phase 2 uses `TEXT_MODEL_LARGE` with a clean context to produce the final research memo.

```mermaid
flowchart TD
    A[handleResearchChat<br/>messages array] --> B{OPENAI_API_KEY set?}
    B -->|No| C[Return error:<br/>API key not configured]
    B -->|Yes| D[Create OpenAI client]
    D --> E[Build system prompt<br/>+ explorer tool note]
    E --> F[Define tools array<br/>7 research + 5 explorer = 12 tools]

    F --> P1["<b>Phase 1: Tool-calling (TEXT_MODEL_SMALL)</b>"]
    P1 --> G[Build toolMessages<br/>system + user history]
    G --> H{Tool-calling loop<br/>i < 5}

    H -->|iteration| I[chat.completions.create<br/>TEXT_MODEL_SMALL + tools]
    I --> J{tool_calls present?}

    J -->|Yes| K[Push assistant msg to toolMessages]
    K --> L[For each tool_call:<br/>parse args → executeTool<br/>→ accumulate toolResults<br/>→ push to toolMessages]
    L --> H

    J -->|No| BREAK[break loop]
    H -->|i = 5 exhausted| BREAK

    BREAK --> P2["<b>Phase 2: Conversational (TEXT_MODEL_LARGE)</b>"]
    P2 --> M[Build fresh conversationMessages<br/>system + user history]
    M --> N{toolResults<br/>not empty?}
    N -->|Yes| O[Inject assistant message:<br/>tool results summary with JSON]
    N -->|No| Q[No extra context needed]
    O --> R[chat.completions.create<br/>TEXT_MODEL_LARGE, <b>no tools param</b>]
    Q --> R
    R --> S["Return {reply, toolResults}"]
```

---

## 4. Tool Dispatch — Routing Decision

Both the chat handler and research agent use the same pattern to route tool calls. Local tools are handled by a switch statement; explorer tools fall through to a type-guard check.

```mermaid
flowchart TD
    A[executeTool name, args] --> B{switch name}

    B -->|GetCases / search_opinions / etc.| C[Execute local tool logic<br/>DB query or API call]
    C --> D[Return JSON string]

    B -->|default| E{isExplorerToolName?}
    E -->|Yes| F[executeExplorerTool name, args]
    F --> G{fetch to Explorer /graphql}
    G -->|Success| H[Return JSON data]
    G -->|Network error| I[Catch → return error string:<br/>explorer may be unavailable]
    H --> D

    E -->|No| J[Return: Unknown tool]
```

---

## 5. Explorer Tool Executor — Internal Flow

```mermaid
flowchart TD
    A[executeExplorerTool<br/>name, args] --> B[Look up GraphQL query<br/>from QUERIES map]
    B --> C{query found?}
    C -->|No| D[Return error:<br/>Unknown explorer tool]
    C -->|Yes| E[Build variables object]

    E --> F{tool name}
    F -->|search_nodes| G[type, search,<br/>limit=20, offset=0]
    F -->|get_node / get_neighbors| H[id]
    F -->|find_similar| I[id, limit]
    F -->|get_stats| J[empty variables]

    G & H & I & J --> K[POST explorerUrl/graphql<br/>query + variables]

    K --> L{response.errors?}
    L -->|Yes| M[Return errors JSON]
    L -->|No| N{search_nodes or<br/>find_similar?}
    N -->|Yes| O[truncateSourceText<br/>cap at 500 chars]
    N -->|No| P[Return raw data]
    O --> P
```

---

## Scenario A: Chat — "What does Virginia Code say about FOIA?"

The user asks about Virginia's Freedom of Information Act. Phase 1 (`TEXT_MODEL_SMALL`) uses both the local `SearchKnowledge` vector search and the explorer's graph tools to gather context. Phase 2 (`TEXT_MODEL_LARGE`) receives the collected tool results and synthesizes a natural language answer with no tool schemas polluting the context.

```mermaid
sequenceDiagram
    participant U as User / GUI
    participant S as Server /chat
    participant SM as TEXT_MODEL_SMALL
    participant LG as TEXT_MODEL_LARGE
    participant DB as Local DB
    participant X as Explorer :3002

    U->>S: POST /chat "What does Virginia Code say about FOIA?"
    S->>S: Build system prompt + graph snapshot

    rect rgb(230, 245, 255)
        Note over S,SM: Phase 1: Tool-calling (TEXT_MODEL_SMALL)

        S->>SM: completions.create (13 tools, user message)

        Note over SM: Turn 1 — search knowledge + graph

        SM-->>S: tool_calls: [SearchKnowledge, search_nodes]

        par Execute tools
            S->>DB: Embed query → cosine similarity
            DB-->>S: top-3 knowledge chunks
        and
            S->>X: POST /graphql search_nodes(search:"FOIA", type:"section")
            X-->>S: {nodes: [{id:4521, sourceId:"§2.2-3700", ...}]}
        end

        S->>S: collect: [{tool: SearchKnowledge, result: ...}, {tool: search_nodes, result: ...}]
        S->>SM: tool results for both calls

        Note over SM: Turn 2 — read full text of key section

        SM-->>S: tool_calls: [get_node(id:4521)]
        S->>X: POST /graphql get_node(id:4521)
        X-->>S: {node: {sourceText:"full FOIA text...", edges:[...]}}
        S->>S: collect: [{tool: get_node, result: ...}]
        S->>SM: tool result

        Note over SM: Turn 3 — explore related provisions

        SM-->>S: tool_calls: [get_neighbors(id:4521)]
        S->>X: POST /graphql get_neighbors(id:4521)
        X-->>S: {edges with fromNode/toNode details}
        S->>S: collect: [{tool: get_neighbors, result: ...}]
        S->>SM: tool result

        Note over SM: Turn 4 — no more tools needed

        SM-->>S: finish_reason: stop (content discarded)
    end

    rect rgb(230, 255, 230)
        Note over S,LG: Phase 2: Conversational (TEXT_MODEL_LARGE, no tools)

        S->>S: Build fresh messages: system + user history
        S->>S: Inject assistant message with 4 collected tool results:<br/>[SearchKnowledge]: ...<br/>[search_nodes]: ...<br/>[get_node]: ...<br/>[get_neighbors]: ...
        S->>LG: completions.create (no tools param)
        LG-->>S: "Virginia's FOIA (§2.2-3700 et seq.)..."
    end

    S-->>U: {reply: "Virginia's FOIA (§2.2-3700 et seq.)..."}
```

### Tool Call Breakdown

```mermaid
flowchart LR
    subgraph "Phase 1 — TEXT_MODEL_SMALL"
        subgraph Turn 1
            A1[SearchKnowledge<br/>query: FOIA] --> A2[Vector cosine search<br/>over embeddings DB]
            B1[search_nodes<br/>search: FOIA<br/>type: section] --> B2[GraphQL → Explorer<br/>returns truncated nodes]
        end

        subgraph Turn 2
            C1[get_node<br/>id: 4521] --> C2[GraphQL → Explorer<br/>returns full sourceText<br/>+ edge list]
        end

        subgraph Turn 3
            D1[get_neighbors<br/>id: 4521] --> D2[GraphQL → Explorer<br/>returns connected nodes<br/>cites/contains/amends]
        end

        subgraph Turn 4
            E1[No tool calls] --> E2[Phase 1 loop breaks]
        end

        Turn 1 --> Turn 2 --> Turn 3 --> Turn 4
    end

    subgraph "Phase 2 — TEXT_MODEL_LARGE"
        F1[System + history<br/>+ tool results summary] --> F2[Final answer returned<br/>clean context, no tool schemas]
    end

    Turn 4 --> F1
```

---

## Scenario B: Research — "Research Virginia court jurisdiction rules"

The research agent combines external legal API searches with the local knowledge graph. Phase 1 (`TEXT_MODEL_SMALL`) gathers data from external APIs and the explorer, accumulating `toolResults` for the sidebar. Phase 2 (`TEXT_MODEL_LARGE`) receives the collected results and writes a comprehensive research memo with no tool schemas in context.

```mermaid
sequenceDiagram
    participant U as User / GUI
    participant S as Server
    participant R as Research Agent
    participant SM as TEXT_MODEL_SMALL
    participant LG as TEXT_MODEL_LARGE
    participant CL as CourtListener
    participant LS as LegiScan
    participant X as Explorer :3002

    U->>S: POST /research "Research Virginia court jurisdiction rules"
    S->>R: handleResearchChat(messages)

    rect rgb(230, 245, 255)
        Note over R,SM: Phase 1: Tool-calling (TEXT_MODEL_SMALL)

        R->>SM: completions.create (12 tools, user message)

        Note over SM: Turn 1 — query external APIs + knowledge graph

        SM-->>R: tool_calls: [search_opinions, search_statutes, search_nodes]

        par Execute tools
            R->>CL: GET /search/?q=Virginia+court+jurisdiction
            CL-->>R: {results: [...opinions]}
        and
            R->>LS: GET /search?query=court+jurisdiction&state=VA
            LS-->>R: {results: [...statutes]}
        and
            R->>X: POST /graphql search_nodes(search:"court jurisdiction")
            X-->>R: {nodes: [{id:892, nodeType:"section", ...}, ...]}
        end

        R->>R: Accumulate toolResults[3]
        R->>SM: tool results for all 3 calls

        Note over SM: Turn 2 — drill into a specific code section

        SM-->>R: tool_calls: [get_node(id:892), find_similar(id:892)]

        par Execute tools
            R->>X: POST /graphql get_node(id:892)
            X-->>R: {node: {full text + edges}}
        and
            R->>X: POST /graphql find_similar(id:892, limit:5)
            X-->>R: {similar: [{score:0.94, node:{...}}, ...]}
        end

        R->>R: Accumulate toolResults[5]
        R->>SM: tool results

        Note over SM: Turn 3 — no more tools needed

        SM-->>R: finish_reason: stop (content discarded)
    end

    rect rgb(230, 255, 230)
        Note over R,LG: Phase 2: Conversational (TEXT_MODEL_LARGE, no tools)

        R->>R: Build fresh messages: system + user history
        R->>R: Inject assistant message with 5 tool results as JSON
        R->>LG: completions.create (no tools param)
        LG-->>R: "## Virginia Court Jurisdiction..."
    end

    R-->>S: {reply: "## Virginia Court Jurisdiction...", toolResults: [...5 entries]}
    S-->>U: Response with reply + sidebar tool results
```

### toolResults Accumulation

```mermaid
flowchart TD
    subgraph "Phase 1 — TEXT_MODEL_SMALL"
        subgraph "Turn 1 — 3 parallel tool calls"
            T1A[search_opinions<br/>→ CourtListener] -->|push| TR["toolResults[]"]
            T1B[search_statutes<br/>→ LegiScan] -->|push| TR
            T1C[search_nodes<br/>→ Explorer] -->|push| TR
        end

        subgraph "Turn 2 — 2 parallel tool calls"
            T2A[get_node<br/>→ Explorer] -->|push| TR
            T2B[find_similar<br/>→ Explorer] -->|push| TR
        end
    end

    subgraph "Phase 2 — TEXT_MODEL_LARGE"
        TR --> CTX[Inject as assistant context summary]
        CTX --> RESP[Generate research memo<br/>clean context, no tool schemas]
    end

    RESP --> RET["Return {reply, toolResults}<br/>5 entries total"]
```

---

## Scenario C: Graceful Degradation — Explorer Unavailable

When the explorer process is down, explorer tool calls fail gracefully. Phase 1's `TEXT_MODEL_SMALL` receives the error and adapts by falling back to local tools. Phase 2's `TEXT_MODEL_LARGE` receives the collected results (including the error) and produces the final answer.

```mermaid
sequenceDiagram
    participant U as User / GUI
    participant S as Server /chat
    participant SM as TEXT_MODEL_SMALL
    participant LG as TEXT_MODEL_LARGE
    participant DB as Local DB
    participant X as Explorer :3002

    U->>S: POST /chat "What does Virginia Code say about FOIA?"

    rect rgb(230, 245, 255)
        Note over S,SM: Phase 1: Tool-calling (TEXT_MODEL_SMALL)

        S->>SM: completions.create (13 tools)

        SM-->>S: tool_calls: [SearchKnowledge, search_nodes]

        par Execute tools
            S->>DB: cosine similarity search
            DB-->>S: top-3 results
        and
            S->>X: POST /graphql search_nodes(...)
            X--xS: Connection refused (ECONNREFUSED)
            Note over S: try/catch catches the error
            S->>S: collect: [{tool: search_nodes, result: error string}]
        end

        S->>S: collect: [{tool: SearchKnowledge, result: ...}]
        S->>SM: SearchKnowledge: [results...], search_nodes: {error: "...unavailable"}

        Note over SM: Turn 2 — adapts, uses only local tools

        SM-->>S: tool_calls: [GetDocuments]
        S->>DB: db.documents.values()
        DB-->>S: document list
        S->>S: collect: [{tool: GetDocuments, result: ...}]
        S->>SM: tool result

        Note over SM: Turn 3 — no more tools

        SM-->>S: finish_reason: stop (content discarded)
    end

    rect rgb(230, 255, 230)
        Note over S,LG: Phase 2: Conversational (TEXT_MODEL_LARGE, no tools)

        S->>S: Inject assistant message with 3 collected results<br/>(including explorer error)
        S->>LG: completions.create (no tools param)
        LG-->>S: "Based on the knowledge base..."
    end

    S-->>U: {reply: "Based on the knowledge base..."}
```

### Error Propagation Path

```mermaid
flowchart TD
    A[executeTool 'search_nodes'] --> B{switch: default branch}
    B --> C{isExplorerToolName?<br/>Yes}
    C --> D[executeExplorerTool]
    D --> E[fetch explorerUrl/graphql]
    E --> F{Network error?}

    F -->|ECONNREFUSED| G[throw Error]
    G --> H[Caught by try/catch in caller]
    H --> I["Return JSON: {error: 'Explorer tool search_nodes<br/>failed — explorer may be unavailable'}"]
    I --> J[Collected in collectedToolResults +<br/>pushed as tool message in Phase 1]
    J --> K[Phase 1 LLM sees error, adapts strategy]
    K --> L[Phase 2 receives all results<br/>including error context]

    F -->|200 OK with errors| M[Return errors array as JSON]
    M --> J

    F -->|200 OK success| N[Return data JSON]
```

---

## Scenario D: Research — Full Iteration Exhaustion

If the Phase 1 LLM keeps calling tools without stopping, the loop terminates after the maximum number of iterations. Phase 2 still runs, receiving all accumulated tool results, and produces a coherent response from `TEXT_MODEL_LARGE`.

```mermaid
sequenceDiagram
    participant R as Research Agent
    participant SM as TEXT_MODEL_SMALL
    participant LG as TEXT_MODEL_LARGE
    participant APIs as External APIs / Explorer

    rect rgb(230, 245, 255)
        Note over R,SM: Phase 1: Tool-calling (TEXT_MODEL_SMALL)

        loop Iteration 1
            R->>SM: completions.create
            SM-->>R: tool_calls: [search_opinions]
            R->>APIs: execute search_opinions
            APIs-->>R: results
            R->>R: push to toolResults, push to toolMessages
        end

        loop Iteration 2
            R->>SM: completions.create
            SM-->>R: tool_calls: [search_statutes, get_stats]
            R->>APIs: execute both tools
            APIs-->>R: results
            R->>R: push to toolResults (now 3 entries)
        end

        loop Iteration 3
            R->>SM: completions.create
            SM-->>R: tool_calls: [search_nodes, get_node]
            R->>APIs: execute both tools
            APIs-->>R: results
            R->>R: push to toolResults (now 5 entries)
        end

        loop Iteration 4
            R->>SM: completions.create
            SM-->>R: tool_calls: [find_similar]
            R->>APIs: execute tool
            APIs-->>R: results
            R->>R: push to toolResults (now 6 entries)
        end

        loop Iteration 5 — final
            R->>SM: completions.create
            SM-->>R: tool_calls: [get_neighbors]
            R->>APIs: execute tool
            APIs-->>R: results
            R->>R: push to toolResults (now 7 entries)
        end

        Note over R: maxIterations (5) exhausted — loop exits
    end

    rect rgb(230, 255, 230)
        Note over R,LG: Phase 2: Conversational (TEXT_MODEL_LARGE, no tools)

        R->>R: Build fresh messages + inject 7 tool results as context
        R->>LG: completions.create (no tools param)
        LG-->>R: "## Virginia Court Jurisdiction..."
    end

    R-->>R: Return {reply: Phase 2 response, toolResults: [7 entries]}
```

---

## Architecture Overview

```mermaid
graph TB
    subgraph Electron
        E[Electron Main Process]
    end

    subgraph "Server :3001"
        subgraph "/chat — Two-Phase"
            CH1["Phase 1: Tool-calling<br/>TEXT_MODEL_SMALL + tools"]
            CH2["Phase 2: Conversational<br/>TEXT_MODEL_LARGE, no tools"]
            CH1 -->|collected tool results| CH2
        end
        subgraph "Research Agent — Two-Phase"
            RA1["Phase 1: Tool-calling<br/>TEXT_MODEL_SMALL + tools"]
            RA2["Phase 2: Conversational<br/>TEXT_MODEL_LARGE, no tools"]
            RA1 -->|toolResults + context| RA2
        end
        ET["explorer-tools.ts<br/>executeExplorerTool()"]
        CFG["config.ts<br/>getConfig('EXPLORER_URL')"]
        DB[(SQLite DB<br/>cases, deadlines,<br/>embeddings)]
    end

    subgraph "Explorer :3002"
        GQL["/graphql endpoint"]
        KG[(Knowledge Graph<br/>nodes, edges,<br/>embeddings)]
    end

    subgraph "External APIs"
        OAI[OpenAI API]
        CL[CourtListener]
        LS[LegiScan]
        GI[GovInfo]
        OA[OpenAlex]
        SA[SerpAPI]
    end

    E -->|spawn + env| CH1
    E -->|spawn| GQL

    CH1 -->|completions.create<br/>with tools| OAI
    CH1 -->|local tools| DB
    CH1 -->|explorer tools| ET
    CH2 -->|completions.create<br/>no tools| OAI

    RA1 -->|completions.create<br/>with tools| OAI
    RA1 -->|research tools| CL & LS & GI & OA & SA
    RA1 -->|explorer tools| ET
    RA2 -->|completions.create<br/>no tools| OAI

    ET -->|reads| CFG
    ET -->|POST /graphql| GQL
    GQL -->|queries| KG
```
