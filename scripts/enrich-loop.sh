#!/usr/bin/env bash
# enrich-loop.sh — bypass the admin UI and run enrichment from the CLI.
#
# When the /admin/enrich page choke (timeouts, browser quirks, auto-mode
# stalls), this script does the same job from a terminal: posts batches
# to /api/admin/enrich in a loop until the server reports `processed: 0`
# (no more items to enrich). Ctrl+C at any time — onlyMissing=true means
# the next run picks up exactly where this left off.
#
# Usage:
#   bash scripts/enrich-loop.sh                 # all types, 5 per batch
#   TYPE=manga bash scripts/enrich-loop.sh      # only mangas
#   LIMIT=10 SLEEP_SECS=2 bash scripts/enrich-loop.sh
#
# Reads .env automatically (CRON_SECRET, optional SITE_URL).
# Defaults: SITE_URL=https://totemavise.com, TYPE=all, LIMIT=5, SLEEP_SECS=3.

set -euo pipefail

# Load .env from repo root if present so the user doesn't have to export
# CRON_SECRET manually. set -a auto-exports every var sourced.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${CRON_SECRET:?CRON_SECRET must be set (add to .env or export it)}"
SITE_URL="${SITE_URL:-https://totemavise.com}"
TYPE="${TYPE:-all}"
LIMIT="${LIMIT:-5}"
SLEEP_SECS="${SLEEP_SECS:-3}"

echo "Enriching from $SITE_URL  type=$TYPE  limit=$LIMIT"
echo "Press Ctrl+C to stop. onlyMissing=true → resuming is safe."
echo ""

batch=0
total_enriched=0
total_errors=0

while true; do
  batch=$((batch + 1))

  # --max-time 320 leaves a small buffer over the server's 300s ceiling.
  # If the server bails on its own (returns JSON with bailedOnTime), we
  # respect that signal; if curl itself hits its own timeout, we treat it
  # as a transient and keep looping.
  out=$(curl -sS --max-time 320 -X POST \
    -H "Authorization: Bearer $CRON_SECRET" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"$TYPE\",\"limit\":$LIMIT,\"onlyMissing\":true}" \
    "$SITE_URL/api/admin/enrich" || echo '{"error":"curl failed"}')

  # Defensive parse — server can return non-JSON if Vercel's gateway
  # times out mid-stream. Default everything to 0 / false on parse fail.
  enriched=$(echo "$out" | jq -r '.result.enriched // 0' 2>/dev/null || echo 0)
  errors=$(echo "$out" | jq -r '.result.errors // 0' 2>/dev/null || echo 0)
  processed=$(echo "$out" | jq -r '.result.processed // 0' 2>/dev/null || echo 0)
  bailed=$(echo "$out" | jq -r '.bailedOnTime // false' 2>/dev/null || echo false)
  err_msg=$(echo "$out" | jq -r '.error // empty' 2>/dev/null || echo "")

  total_enriched=$((total_enriched + enriched))
  total_errors=$((total_errors + errors))
  ts=$(date '+%H:%M:%S')

  if [ -n "$err_msg" ]; then
    echo "$ts  batch $batch: ERROR — $err_msg (sleeping then retrying)"
    sleep 10
    continue
  fi

  bail_note=""
  if [ "$bailed" = "true" ]; then
    bail_note=" (server bailed on time)"
  fi
  echo "$ts  batch $batch: +$enriched enriched, $errors errors (running total: $total_enriched enriched, $total_errors errors)$bail_note"

  # processed=0 means the server found nothing matching the filter — we're done.
  if [ "$processed" = "0" ]; then
    echo ""
    echo "Done. Total enriched this run: $total_enriched (with $total_errors errors)."
    break
  fi

  sleep "$SLEEP_SECS"
done
