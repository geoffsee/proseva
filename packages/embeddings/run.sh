#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

OMP_NUM_THREADS=10 cargo run --release --bin proseva-embeddings -- \
  --input "$SCRIPT_DIR/../datasets/data/virginia.db" \
  --output "$SCRIPT_DIR/../datasets/data/embeddings.sqlite.db" \
  "$@"
