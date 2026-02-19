#!/bin/bash

# Test script for Pro-Se-VA CLI
# Assumes server is running on localhost:3001

set -e

CLI="bun run bin/proseva.ts"
API_URL="http://localhost:3001"

echo "Testing Pro-Se-VA CLI"
echo "====================="
echo ""

# Test 1: Status command
echo "Test 1: Status command"
$CLI --api-url $API_URL status
echo "✓ Status command works"
echo ""

# Test 2: Config get
echo "Test 2: Config get"
$CLI --api-url $API_URL config get | head -10
echo "✓ Config get works"
echo ""

# Test 3: Config get specific key
echo "Test 3: Config get specific key"
TIMEZONE=$($CLI --api-url $API_URL config get scheduler.timezone)
echo "Timezone: $TIMEZONE"
echo "✓ Config get specific key works"
echo ""

# Test 4: Config set
echo "Test 4: Config set"
$CLI --api-url $API_URL config set scheduler.timezone "America/New_York" 2>/dev/null
TIMEZONE=$($CLI --api-url $API_URL config get scheduler.timezone)
if [ "$TIMEZONE" = "America/New_York" ]; then
  echo "✓ Config set works"
else
  echo "✗ Config set failed"
  exit 1
fi
echo ""

# Test 5: DB stats
echo "Test 5: DB stats"
$CLI --api-url $API_URL db stats
echo "✓ DB stats works"
echo ""

# Test 6: DB export
echo "Test 6: DB export JSON"
$CLI --api-url $API_URL db export json > /tmp/proseva-test-export.json 2>/dev/null
if [ -s /tmp/proseva-test-export.json ]; then
  echo "✓ DB export works"
else
  echo "✗ DB export failed"
  exit 1
fi
rm /tmp/proseva-test-export.json
echo ""

# Test 7: Notifications devices list
echo "Test 7: Notifications devices list"
$CLI --api-url $API_URL notifications devices list
echo "✓ Notifications devices list works"
echo ""

# Test 8: Notifications SMS list
echo "Test 8: Notifications SMS list"
$CLI --api-url $API_URL notifications sms list
echo "✓ Notifications SMS list works"
echo ""

# Test 9: JSON output mode
echo "Test 9: JSON output mode"
JSON=$($CLI --api-url $API_URL --json config get)
if echo "$JSON" | jq . > /dev/null 2>&1; then
  echo "✓ JSON output mode works"
else
  echo "✗ JSON output mode failed"
  exit 1
fi
echo ""

# Test 10: Verbose mode
echo "Test 10: Verbose mode"
$CLI --api-url $API_URL --verbose config get scheduler.timezone 2>&1 | grep -q "GET /config"
echo "✓ Verbose mode works"
echo ""

echo "====================="
echo "All tests passed! ✓"
echo ""
echo "To test scan command:"
echo "  proseva scan /path/to/pdfs"
echo ""
echo "To test remote server:"
echo "  proseva --api-url https://your-server.com status"
