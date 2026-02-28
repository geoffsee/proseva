#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${EMBED_PORT:-8000}"
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Stopping embedding server (PID $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ── build embedding server if needed ──────────────────────────────────────────

SERVER_BIN="$SCRIPT_DIR/target/release/embedding-server"
if [[ ! -x "$SERVER_BIN" ]]; then
  echo "Building embedding server..."
  cargo build --release --bin embedding-server --manifest-path "$SCRIPT_DIR/Cargo.toml"
fi

# ── start embedding server ────────────────────────────────────────────────────

if curl -sf "http://localhost:$PORT/v1/embeddings" \
     -X POST -H "Content-Type: application/json" \
     -d '{"input":"ping","model":"local"}' >/dev/null 2>&1; then
  echo "Embedding server already running on port $PORT"
else
  echo "Starting embedding server on port $PORT..."
  "$SERVER_BIN" --port "$PORT" &
  SERVER_PID=$!

  echo -n "Waiting for server"
  for i in $(seq 1 60); do
    if curl -sf "http://localhost:$PORT/v1/embeddings" \
         -X POST -H "Content-Type: application/json" \
         -d '{"input":"ping","model":"local"}' >/dev/null 2>&1; then
      echo " ready"
      break
    fi
    echo -n "."
    sleep 1
    if [[ $i -eq 60 ]]; then
      echo " TIMEOUT"
      echo "ERROR: Embedding server failed to start within 60s" >&2
      exit 1
    fi
  done
fi

# ── run evaluation ────────────────────────────────────────────────────────────

EMBED_URL="http://localhost:$PORT" bun run "$SCRIPT_DIR/eval-search.ts"
