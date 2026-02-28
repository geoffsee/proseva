#!/usr/bin/env sh

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

claude -p --verbose --output-format stream-json \
  --allowedTools "Bash(bun run dev*)" "Bash(bun run eval:ai*)" "Bash(bun run scripts/ai-eval*)" "Bash(bun run test*)" "Bash(cd packages/* && bun run test*)" "Bash(uv run *)" "Bash(ls ${ROOT}*)" "Bash(python*)" "Bash(git *)" "Read" "Glob" "Grep" "Edit" "Write" \
  -- "Follow the instructions in CHAT_ADVANCEMENT_AGENT.md. Evaluate and improve." \
  | bun scripts/stream-to-html.ts
