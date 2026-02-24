# proseva-embeddings

Rust CLI tool that builds a knowledge graph and precomputed vector embeddings from `virginia.db`. This is a one-shot build tool — run it once when the dataset changes, ship the output `embeddings.sqlite.db` alongside `virginia.db`.

## Overview

```mermaid
graph LR
    VDB[(virginia.db)] --> P1[Pass 1: Parse]
    P1 --> P2[Pass 2: Extract]
    P2 --> P3[Pass 3: Embed]
    P3 --> EDB[(embeddings.sqlite.db)]

    style VDB fill:#e8f4f8,stroke:#2196F3
    style EDB fill:#e8f5e9,stroke:#4CAF50
    style P1 fill:#fff3e0,stroke:#FF9800
    style P2 fill:#fff3e0,stroke:#FF9800
    style P3 fill:#fff3e0,stroke:#FF9800
```

The tool reads six tables from `virginia.db`, constructs a knowledge graph of nodes and edges, computes vector embeddings for semantic search, and writes everything to `embeddings.sqlite.db`.

---

## Architecture

```mermaid
graph TD
    subgraph "src/"
        main[main.rs<br/>CLI + orchestration]

        subgraph "db/"
            reader[reader.rs<br/>Read virginia.db]
            writer[writer.rs<br/>Write embeddings.sqlite.db]
        end

        subgraph "graph/"
            nodes[nodes.rs<br/>Node creation + chunking]
            edges[edges.rs<br/>Edge extraction]
        end

        subgraph "text/"
            html[html.rs<br/>HTML stripping]
            chunker[chunker.rs<br/>Text chunking]
        end

        subgraph "embed/"
            embedder[mod.rs<br/>fastembed wrapper]
        end
    end

    main --> reader
    main --> writer
    main --> nodes
    main --> edges
    main --> embedder
    nodes --> html
    nodes --> chunker
    edges --> nodes
```

---

## Usage

```bash
cargo run --release -- \
  --input ../datasets/data/virginia.db \
  --output ../datasets/data/embeddings.sqlite.db
```

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--input` | (required) | Path to `virginia.db` |
| `--output` | sibling of input | Path to write `embeddings.sqlite.db` |
| `--model` | `BAAI/bge-small-en-v1.5` | fastembed model name |
| `--batch-size` | `256` | Texts per embedding batch |
| `--skip-embeddings` | `false` | Only build graph, skip Pass 3 |

---

## The Three Passes

```mermaid
flowchart TD
    START([Start]) --> READ[Read 6 tables from virginia.db]

    READ --> PASS1["<b>Pass 1: Parse</b><br/>Build nodes from all tables"]
    PASS1 --> STRIP[Strip HTML from text]
    STRIP --> CHUNK{Text > threshold?}
    CHUNK -->|Yes| SPLIT[Chunk into ~500-token<br/>overlapping segments]
    CHUNK -->|No| SINGLE[Keep as single node]
    SPLIT --> NODES[(In-memory:<br/>nodes + cleaned text)]
    SINGLE --> NODES

    NODES --> PASS2["<b>Pass 2: Extract</b><br/>Build edges"]
    PASS2 --> HIER[Hierarchy edges<br/>title → chapter → section]
    PASS2 --> CITE[Citation edges<br/>regex § extraction]
    PASS2 --> DOCREF[Document reference edges]
    HIER --> EDGES[(In-memory: edges)]
    CITE --> EDGES
    DOCREF --> EDGES

    EDGES --> WRITE[Write nodes + edges<br/>to output DB]

    WRITE --> SKIP{--skip-embeddings?}
    SKIP -->|Yes| DONE([Done])
    SKIP -->|No| PASS3["<b>Pass 3: Embed</b><br/>Compute vectors"]
    PASS3 --> BATCH[Batch embed 256 texts at a time<br/>via BAAI/bge-small-en-v1.5]
    BATCH --> BLOB[Serialize as f32 BLOBs]
    BLOB --> WEMBED[Write embeddings to DB]
    WEMBED --> DONE
```

---

### Pass 1: Parse — Build Nodes

Reads every table in `virginia.db` and creates a **node** for each embeddable unit of content.

```mermaid
graph TD
    subgraph "virginia.db tables"
        VC[virginia_code<br/>~33k rows]
        CON[constitution<br/>~131 rows]
        AUTH[authorities<br/>~6.2k rows]
        CRT[courts<br/>~206 rows]
        PN[popular_names<br/>~5k rows]
        DOC[documents<br/>~28 rows]
    end

    subgraph "Node types created"
        T["<b>title</b> (synthetic)<br/>from unique title_num"]
        CH["<b>chapter</b> (synthetic)<br/>from unique title:chapter"]
        SEC["<b>section</b><br/>one per code section"]
        ART["<b>article</b> (synthetic)<br/>from unique article_id"]
        CS["<b>constitution_section</b><br/>one per section"]
        AU["<b>authority</b><br/>chunked if > 512 tokens"]
        CO["<b>court</b><br/>one per court"]
        PNM["<b>popular_name</b><br/>one per name"]
        MC["<b>manual_chunk</b><br/>always chunked ~500 tokens"]
    end

    VC --> T
    VC --> CH
    VC --> SEC
    CON --> ART
    CON --> CS
    AUTH --> AU
    CRT --> CO
    PN --> PNM
    DOC --> MC
```

**Synthetic nodes** (title, chapter, article) represent structural groupings. They participate in hierarchy edges but do not get embeddings — they have no standalone text content worth embedding.

#### Text Preparation

Each node type prepares its embeddable text differently:

| Node type | Text formula |
|-----------|-------------|
| `section` | `strip_html(title) + " " + strip_html(body)` |
| `constitution_section` | `strip_html(section_name) + " " + strip_html(section_title) + " " + strip_html(section_text)` |
| `authority` | `strip_html(title) + " " + strip_html(body)` |
| `court` | `name + locality + court_type + district + city` |
| `popular_name` | `strip_html(name) + " " + strip_html(body)` |
| `manual_chunk` | `strip_html(title) + " " + strip_html(content)` |

#### HTML Stripping

Uses the `scraper` crate to parse HTML fragments, extract text content, and normalize whitespace. If the input contains no `<` characters, it skips parsing and just normalizes whitespace (fast path).

#### Chunking

Large texts are split into overlapping segments to keep each embedding focused:

```mermaid
graph LR
    subgraph "Original text (~1500 tokens)"
        A[Sentence 1-10<br/>~500 tokens]
        B[Sentence 8-18<br/>~500 tokens]
        C[Sentence 16-22<br/>~350 tokens]
    end

    A -.->|50-token overlap| B
    B -.->|50-token overlap| C
```

- **Max chunk size**: ~500 tokens (word-approximated)
- **Overlap**: ~50 tokens between consecutive chunks
- Splits on **sentence boundaries** (`.`, `?`, `!`) to maintain coherence
- If a single sentence exceeds 500 tokens, it becomes its own chunk
- Authorities: only chunked if total text > 512 tokens
- Documents: always chunked

---

### Pass 2: Extract — Build Edges

Builds three types of relationships between nodes.

```mermaid
graph TD
    subgraph "contains (structural hierarchy)"
        T[title] --> CH[chapter]
        CH --> SEC[section]
        ART[article] --> CS[constitution_section]
    end

    subgraph "cites (code citations)"
        SEC2[section] -.->|"§ 19.2-392"| SEC3[section]
        AU[authority] -.->|"§ 2.2-3700"| SEC4[section]
        CS2[constitution_section] -.->|"§ 1-200"| SEC5[section]
        PN[popular_name] -.->|"§ 8.01-1"| SEC6[section]
    end

    subgraph "references (document → code)"
        MC[manual_chunk] -.->|"Va. Code § X.Y-Z"| SEC7[section]
    end
```

#### Hierarchy Edges (`contains`)

Built from the grouping structure in `virginia_code` and `constitution`:

- **title** → **chapter**: from matching `title_num` fields
- **chapter** → **section**: from matching `title_num:chapter_num` to section rows
- **article** → **constitution_section**: from matching `article_id`

#### Citation Edges (`cites`)

Extracted via regex from the cleaned text of sections, constitution sections, authorities, and popular names.

Three regex patterns are applied:

| Pattern | What it matches | Example |
|---------|----------------|---------|
| `href.*?/vacode/([^/'"]+)` | VA Code URLs in `<a>` tags | `href="/vacode/19.2-392"` |
| `§\s*(\d+(?:\.\d+)*-\d+(?:\.\d+)*)` | Single section references | `§ 2.2-3700` |
| `§§\s*([\d.,\s\-and]+)` | Plural section lists | `§§ 1-200, 2-300, and 3-400` |

Each extracted section number is resolved against the node lookup map. Unresolvable references (no matching node) are dropped silently. Self-citations are excluded.

#### Document Reference Edges (`references`)

Same regex patterns applied to raw document content (before HTML stripping, to capture `href` attributes). Only the **first chunk** of each document creates reference edges, to avoid duplicate edges from overlapping chunks.

#### Deduplication

All edges are sorted by `(from_id, to_id, rel_type)` and deduplicated. The output DB uses `INSERT OR IGNORE` with a composite primary key as a secondary guard.

---

### Pass 3: Embed — Compute Vectors

```mermaid
flowchart LR
    TEXTS["42k+ texts"] --> BATCH["Batch (256 texts)"]
    BATCH --> MODEL["BAAI/bge-small-en-v1.5<br/>(ONNX via fastembed)"]
    MODEL --> VEC["Vec&lt;f32&gt; × 384"]
    VEC --> BLOB["to_le_bytes()"]
    BLOB --> DB["embeddings table<br/>1,536 bytes/vector"]
```

- **Model**: `BAAI/bge-small-en-v1.5` — 384 dimensions, ~130MB ONNX model downloaded on first run
- **Batch size**: 256 texts per batch (configurable via `--batch-size`)
- **Skips**: synthetic hierarchy nodes (no text to embed) and nodes with empty text
- **Storage**: raw little-endian `f32` bytes — 384 floats * 4 bytes = **1,536 bytes** per vector
- **Progress**: `indicatif` progress bar with ETA

Supported models (via `--model`):
- `BAAI/bge-small-en-v1.5` (default, 384 dims)
- `BAAI/bge-base-en-v1.5`
- `BAAI/bge-large-en-v1.5`

---

## Output Schema

```mermaid
erDiagram
    model_info {
        TEXT key PK
        TEXT value
    }

    nodes {
        INTEGER id PK
        TEXT source
        TEXT source_id
        INTEGER chunk_idx
        TEXT node_type
    }

    edges {
        INTEGER from_id FK
        INTEGER to_id FK
        TEXT rel_type
        REAL weight
    }

    embeddings {
        INTEGER node_id PK "FK → nodes.id"
        BLOB embedding
    }

    nodes ||--o{ edges : "from_id"
    nodes ||--o{ edges : "to_id"
    nodes ||--o| embeddings : "node_id"
```

### Tables

**`model_info`** — metadata about the embedding model used.

| key | value (example) |
|-----|-----------------|
| `model_name` | `BAAI/bge-small-en-v1.5` |
| `dimensions` | `384` |

**`nodes`** — one row per embeddable or structural unit.

| Column | Description |
|--------|-------------|
| `id` | Auto-incrementing primary key |
| `source` | Source table in virginia.db (`virginia_code`, `constitution`, etc.) |
| `source_id` | Identifier within that table (section number, short_name, filename, etc.) |
| `chunk_idx` | 0 for single nodes, 0..N for chunked content |
| `node_type` | `section`, `title`, `chapter`, `article`, `constitution_section`, `authority`, `court`, `popular_name`, `manual_chunk` |

**`edges`** — directed relationships between nodes.

| Column | Description |
|--------|-------------|
| `from_id` | Source node |
| `to_id` | Target node |
| `rel_type` | `contains`, `cites`, or `references` |
| `weight` | Reserved for future use (currently NULL) |

**`embeddings`** — one row per non-synthetic node.

| Column | Description |
|--------|-------------|
| `node_id` | FK to nodes.id |
| `embedding` | 1,536-byte BLOB (384 little-endian f32 values) |

### Indexes

- `idx_nodes_source` on `(source, source_id)` — lookup nodes by origin
- `idx_edges_to` on `(to_id, rel_type)` — find incoming edges
- `idx_edges_type` on `(rel_type)` — filter by relationship type

---

## Typical Output Stats

From a full run against the production `virginia.db`:

```
Nodes:  44,402 total (42,751 embeddable, 1,651 synthetic)
Edges:  80,554 total
  - contains:    34,717
  - cites:       43,547
  - references:   2,290
```

| Node type | Count |
|-----------|-------|
| `section` | 33,702 |
| `popular_name` | 5,093 |
| `manual_chunk` | 2,062 |
| `chapter` | 1,561 |
| `authority` | 1,557 |
| `court` | 206 |
| `constitution_section` | 131 |
| `title` | 76 |
| `article` | 14 |

---

## Verification

```bash
# Build graph only (fast, ~1.5s)
cargo run --release -- \
  --input ../datasets/data/virginia.db \
  --output /tmp/test.db \
  --skip-embeddings

# Spot-checks
sqlite3 /tmp/test.db "SELECT count(*) FROM nodes"
sqlite3 /tmp/test.db "SELECT rel_type, count(*) FROM edges GROUP BY rel_type"
sqlite3 /tmp/test.db "SELECT node_type, count(*) FROM nodes GROUP BY node_type ORDER BY count(*) DESC"

# Full run with embeddings
cargo run --release -- \
  --input ../datasets/data/virginia.db \
  --output ../datasets/data/embeddings.sqlite.db

# Verify embeddings
sqlite3 ../datasets/data/embeddings.sqlite.db "SELECT count(*) FROM embeddings"
sqlite3 ../datasets/data/embeddings.sqlite.db "SELECT length(embedding) FROM embeddings LIMIT 1"
# → should return 1536 (384 * 4)
```

---

## Dependencies

| Crate | Version | Purpose |
|-------|---------|---------|
| `rusqlite` | 0.31 (bundled) | SQLite read/write |
| `fastembed` | 4 | ONNX-based text embeddings |
| `clap` | 4 (derive) | CLI argument parsing |
| `scraper` | 0.20 | HTML parsing and text extraction |
| `regex` | 1 | Citation pattern matching |
| `indicatif` | 0.17 | Progress bars |
| `anyhow` | 1 | Error handling |
| `rayon` | 1 | Parallel iteration (available for future use) |
