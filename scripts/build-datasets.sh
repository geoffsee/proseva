#!/usr/bin/env bash
#
# Reconstruct SQLite databases from checked-in JSON/JSONL source files.
# Idempotent — skips steps whose outputs already exist.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATASETS_DIR="$REPO_ROOT/packages/datasets"
DATA_DIR="$DATASETS_DIR/data"
EMBEDDINGS_DIR="$REPO_ROOT/packages/embeddings"

VIRGINIA_DB="$DATA_DIR/virginia.db"
GRAPH_DB="$DATA_DIR/graph.sqlite.db"
GRAPH_JSONL="$DATA_DIR/graph.sqlite.jsonl"

# Step 1: Build virginia.db from source JSON files
if [[ -f "$VIRGINIA_DB" ]]; then
  echo "virginia.db exists — skipping ETL"
else
  echo "=== Building virginia.db ==="
  (cd "$DATASETS_DIR" && bun run etl:sqlite)
fi

# Step 2: Build graph.sqlite.db structure (nodes, edges, chunk_meta)
if [[ -f "$GRAPH_DB" ]]; then
  echo "graph.sqlite.db exists — skipping graph build"
else
  echo "=== Building graph.sqlite.db (structure) ==="

  # Build the Rust binary if needed
  if [[ ! -x "$EMBEDDINGS_DIR/target/release/proseva-embeddings" ]]; then
    echo "  Building proseva-embeddings..."
    cargo build --release --bin proseva-embeddings \
      --manifest-path "$EMBEDDINGS_DIR/Cargo.toml"
  fi

  "$EMBEDDINGS_DIR/target/release/proseva-embeddings" \
    --input "$VIRGINIA_DB" \
    --output "$GRAPH_DB" \
    --skip-embeddings

  # Step 3: Load embeddings from JSONL
  if [[ -f "$GRAPH_JSONL" ]]; then
    echo "=== Loading embeddings from JSONL ==="
    "$EMBEDDINGS_DIR/target/release/proseva-embeddings" \
      --output "$GRAPH_DB" \
      --load-jsonl "$GRAPH_JSONL"
  else
    echo "WARNING: $GRAPH_JSONL not found — graph.sqlite.db has no embeddings"
  fi
fi

echo "=== Datasets ready ==="
