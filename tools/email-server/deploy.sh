#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

source .env.secret

if [ -z "${D1_DATABASE_ID:-}" ]; then
  echo "Error: D1_DATABASE_ID not set in .env.secret"
  exit 1
fi

# Substitute placeholder in wrangler.jsonc before deploy
sed -i '' "s/<d1-database>/${D1_DATABASE_ID}/g" wrangler.jsonc

trap 'sed -i "" "s/${D1_DATABASE_ID}/<d1-database>/g" wrangler.jsonc' EXIT

npx wrangler deploy
