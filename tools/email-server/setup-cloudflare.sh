#!/usr/bin/env bash
#
# Sets up Cloudflare Email Routing and custom domain for the ProSeVA email worker.
#
# Required environment variable:
#   CLOUDFLARE_API_TOKEN - API token with permissions:
#     - Zone:Email Routing Rules:Edit
#     - Zone:DNS:Edit
#     - Zone:Zone:Read
#     - Account:Workers Scripts:Edit
#
# Usage:
#   export CLOUDFLARE_API_TOKEN="your-token-here"
#   ./setup-cloudflare.sh

set -euo pipefail

source .env.secret

DOMAIN="proseva.app"
WORKER_NAME="proseva-email-server"
CUSTOM_DOMAIN="email.proseva.app"
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID}"

API="https://api.cloudflare.com/client/v4"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "Error: CLOUDFLARE_API_TOKEN is not set."
  echo ""
  echo "Create an API token at https://dash.cloudflare.com/profile/api-tokens"
  echo "with these permissions:"
  echo "  - Zone > Email Routing Rules > Edit"
  echo "  - Zone > DNS > Edit"
  echo "  - Zone > Zone > Read"
  echo "  - Account > Worker Scripts > Edit"
  echo ""
  echo "Then run:  export CLOUDFLARE_API_TOKEN=\"your-token\""
  exit 1
fi

AUTH="Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"

cf_api() {
  local method="$1"
  local path="$2"
  shift 2
  local response
  response=$(curl -s -X "$method" "${API}${path}" \
    -H "$AUTH" \
    -H "Content-Type: application/json" \
    "$@")

  local success
  success=$(echo "$response" | jq -r '.success // false')
  if [ "$success" != "true" ]; then
    echo "API call failed: $method $path"
    echo "$response" | jq '.errors'
    return 1
  fi
  echo "$response"
}

echo "=== ProSeVA Email Worker - Cloudflare Setup ==="
echo ""

# --- Step 1: Look up Zone ID ---
echo "[1/6] Looking up zone ID for ${DOMAIN}..."
ZONE_RESPONSE=$(cf_api GET "/zones?name=${DOMAIN}")
ZONE_ID=$(echo "$ZONE_RESPONSE" | jq -r '.result[0].id')

if [ -z "$ZONE_ID" ] || [ "$ZONE_ID" = "null" ]; then
  echo "Error: Zone not found for ${DOMAIN}"
  exit 1
fi
echo "       Zone ID: ${ZONE_ID}"

# --- Step 2: Add MX records for Cloudflare Email Routing ---
echo "[2/6] Adding MX records for ${DOMAIN}..."
for record in "route1.mx.cloudflare.net:12" "route2.mx.cloudflare.net:98" "route3.mx.cloudflare.net:29"; do
  MX_HOST="${record%%:*}"
  MX_PRIO="${record##*:}"
  # Check if record already exists
  EXISTING=$(curl -s -X GET "${API}/zones/${ZONE_ID}/dns_records?type=MX&content=${MX_HOST}" \
    -H "$AUTH" -H "Content-Type: application/json" | jq -r '.result | length')
  if [ "$EXISTING" = "0" ]; then
    cf_api POST "/zones/${ZONE_ID}/dns_records" \
      -d "{\"type\":\"MX\",\"name\":\"${DOMAIN}\",\"content\":\"${MX_HOST}\",\"priority\":${MX_PRIO},\"proxied\":false}" > /dev/null
    echo "       Added MX ${MX_PRIO} ${MX_HOST}"
  else
    echo "       MX ${MX_HOST} already exists (skipping)"
  fi
done

# --- Step 3: Enable Email Routing ---
echo "[3/6] Enabling Email Routing on ${DOMAIN}..."
ENABLE_RESPONSE=$(cf_api POST "/zones/${ZONE_ID}/email/routing/enable" -d '{}') && \
  echo "       Email Routing enabled." || \
  echo "       Email Routing may already be enabled (continuing)."

# --- Step 4: Configure catch-all rule to forward to worker ---
echo "[4/6] Setting catch-all rule → worker '${WORKER_NAME}'..."
CATCHALL_RESPONSE=$(cf_api PUT "/zones/${ZONE_ID}/email/routing/rules/catch_all" \
  -d "{
    \"actions\": [{\"type\": \"worker\", \"value\": [\"${WORKER_NAME}\"]}],
    \"matchers\": [{\"type\": \"all\"}],
    \"enabled\": true
  }")
echo "       Catch-all rule configured."

# --- Step 5: Set up custom domain for the worker ---
echo "[5/6] Attaching custom domain ${CUSTOM_DOMAIN} to worker..."
DOMAIN_RESPONSE=$(cf_api PUT "/accounts/${ACCOUNT_ID}/workers/domains" \
  -d "{
    \"hostname\": \"${CUSTOM_DOMAIN}\",
    \"service\": \"${WORKER_NAME}\",
    \"zone_id\": \"${ZONE_ID}\",
    \"environment\": \"production\"
  }")
echo "       Custom domain attached."

# --- Step 6: Verify ---
echo "[6/6] Verifying setup..."
echo ""

# Check email routing status
SETTINGS=$(cf_api GET "/zones/${ZONE_ID}/email/routing")
ENABLED=$(echo "$SETTINGS" | jq -r '.result.enabled')
echo "  Email Routing enabled: ${ENABLED}"

# Check catch-all
CATCHALL=$(cf_api GET "/zones/${ZONE_ID}/email/routing/rules/catch_all")
CATCHALL_ENABLED=$(echo "$CATCHALL" | jq -r '.result.enabled')
CATCHALL_ACTION=$(echo "$CATCHALL" | jq -r '.result.actions[0].type')
echo "  Catch-all rule enabled: ${CATCHALL_ENABLED}"
echo "  Catch-all action: ${CATCHALL_ACTION}"

# Check custom domain
echo "  Custom domain: https://${CUSTOM_DOMAIN}"

echo ""
echo "=== Setup complete ==="
echo ""
echo "Email sent to *@${DOMAIN} will be routed to the ${WORKER_NAME} worker."
echo "Worker HTTP API available at https://${CUSTOM_DOMAIN}"
echo ""
echo "Test it:"
echo "  curl https://${CUSTOM_DOMAIN}/api/v1/health"
