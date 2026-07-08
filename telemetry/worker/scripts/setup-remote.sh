#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../.." && pwd)"
cd "$ROOT"

ACCOUNT_ID="213905aaccc912864fb5ea0e4e28d270"
ONBOARDING_URL="https://dash.cloudflare.com/${ACCOUNT_ID}/workers/onboarding"

TELEMETRY_TOKEN="${TELEMETRY_TOKEN:-$(openssl rand -hex 32)}"
TELEMETRY_ADMIN_TOKEN="${TELEMETRY_ADMIN_TOKEN:-$(openssl rand -hex 32)}"

CREDS_FILE="$REPO_ROOT/telemetry/.credentials.local"
mkdir -p "$(dirname "$CREDS_FILE")"
cat > "$CREDS_FILE" <<EOF
# Local only — do not commit. Generated $(date -u +%Y-%m-%dT%H:%M:%SZ)
TELEMETRY_TOKEN=$TELEMETRY_TOKEN
TELEMETRY_ADMIN_TOKEN=$TELEMETRY_ADMIN_TOKEN
EOF
chmod 600 "$CREDS_FILE"

echo "Setting Worker secrets…"
printf '%s' "$TELEMETRY_TOKEN" | npx wrangler secret put TELEMETRY_TOKEN
printf '%s' "$TELEMETRY_ADMIN_TOKEN" | npx wrangler secret put TELEMETRY_ADMIN_TOKEN

echo "Deploying Worker…"
DEPLOY_LOG="$(mktemp)"
if ! npm run deploy 2>&1 | tee "$DEPLOY_LOG"; then
  if grep -q "register a workers.dev subdomain" "$DEPLOY_LOG"; then
    echo ""
    echo "Register a workers.dev subdomain first (one-time):"
    echo "  $ONBOARDING_URL"
    echo ""
    echo "Tokens saved to: $CREDS_FILE"
    echo "Re-run after registering subdomain: bash telemetry/worker/scripts/setup-remote.sh"
    rm -f "$DEPLOY_LOG"
    exit 1
  fi
  rm -f "$DEPLOY_LOG"
  exit 1
fi

WORKER_URL="$(grep -Eo 'https://github-publish-telemetry\.[a-z0-9-]+\.workers\.dev' "$DEPLOY_LOG" | head -1 || true)"
rm -f "$DEPLOY_LOG"

if [[ -z "$WORKER_URL" ]]; then
  echo "Deploy succeeded but could not detect workers.dev URL from output."
  exit 1
fi

{
  echo "# Local only — do not commit. Updated $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "TELEMETRY_URL=$WORKER_URL"
  echo "TELEMETRY_TOKEN=$TELEMETRY_TOKEN"
  echo "TELEMETRY_ADMIN_TOKEN=$TELEMETRY_ADMIN_TOKEN"
} > "$CREDS_FILE"
chmod 600 "$CREDS_FILE"

echo ""
echo "Done."
echo "  Worker URL:  $WORKER_URL"
echo "  Admin token: $CREDS_FILE"
echo ""
echo "Update src/telemetry/ingest.ts with TELEMETRY_URL and TELEMETRY_TOKEN if they changed."
echo ""
echo "Test:"
echo "  curl -sS -X POST \"$WORKER_URL/v1/event\" \\"
echo "    -H \"Authorization: Bearer <TELEMETRY_TOKEN>\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"event\":\"publish\"}'"
