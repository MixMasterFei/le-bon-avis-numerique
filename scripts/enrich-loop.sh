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

# Fetch the starting backlog so we can show real progress (47/1019, 4.6%).
# Capture status + body so we can detect auth failures clearly instead of
# silently treating "401 {error: ...}" as "0 items remaining".
preflight=$(curl -sS --max-time 15 -w "\n%{http_code}" \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$SITE_URL/api/admin/enrich" 2>/dev/null || echo $'\n000')
preflight_status=$(echo "$preflight" | tail -1)
preflight_body=$(echo "$preflight" | sed '$d')

if [ "$preflight_status" = "401" ] || [ "$preflight_status" = "403" ]; then
  echo "❌ Auth failed ($preflight_status). Your CRON_SECRET doesn't match Vercel's." >&2
  echo "   Fix: run 'npx vercel env pull .env' to sync, or copy CRON_SECRET" >&2
  echo "   from https://vercel.com/dashboard → project → Settings → Environment Variables." >&2
  exit 1
fi

backlog_start=$(echo "$preflight_body" | jq -r '.enrichment.withoutMetrics // 0' 2>/dev/null || echo 0)

if [ "$backlog_start" -gt 0 ]; then
  echo "Backlog: $backlog_start items to enrich."
elif [ "$preflight_status" = "200" ]; then
  echo "Backlog: 0 (everything's already enriched). Nothing to do."
  exit 0
else
  echo "⚠ Could not fetch backlog count (HTTP $preflight_status):"
  echo "  ${preflight_body:0:200}"
  echo "  Continuing anyway — progress will show running totals only."
fi
echo ""

batch=0
total_enriched=0
total_errors=0
start_epoch=$(date +%s)

while true; do
  batch=$((batch + 1))

  # --max-time 320 leaves a small buffer over the server's 300s ceiling.
  # Capture HTTP status alongside body so we can detect auth/gateway
  # failures instead of silently treating them as "0 items processed".
  raw=$(curl -sS --max-time 320 -w "\n%{http_code}" -X POST \
    -H "Authorization: Bearer $CRON_SECRET" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"$TYPE\",\"limit\":$LIMIT,\"onlyMissing\":true}" \
    "$SITE_URL/api/admin/enrich" || echo $'\n000')
  status=$(echo "$raw" | tail -1)
  out=$(echo "$raw" | sed '$d')

  # Auth or rate-limit failures shouldn't loop forever pretending to
  # work. Abort cleanly so the user sees the cause.
  if [ "$status" = "401" ] || [ "$status" = "403" ]; then
    echo "❌ Auth failed mid-loop ($status). CRON_SECRET stopped working." >&2
    exit 1
  fi
  if [ "$status" = "429" ]; then
    echo "⚠ Rate-limited (429). Sleeping 60s and retrying..."
    sleep 60
    continue
  fi

  # Defensive parse — server can still return non-JSON if Vercel's
  # gateway times out mid-stream. Default everything to 0 / false on
  # parse fail; the err_msg / bad_status checks below catch the rest.
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
    bail_note=" (server bailed)"
  fi

  # Progress against the starting backlog. Capped at backlog_start because
  # late items might trickle in from new imports while we run, but those
  # weren't part of the original promise — so show 100% when we hit it.
  progress_note=""
  if [ "$backlog_start" -gt 0 ]; then
    done_count=$total_enriched
    if [ "$done_count" -gt "$backlog_start" ]; then done_count=$backlog_start; fi
    pct=$(awk "BEGIN { printf \"%.1f\", ($done_count * 100) / $backlog_start }")

    # ETA — pace from elapsed wall-clock time vs items done.
    elapsed=$(( $(date +%s) - start_epoch ))
    eta_note=""
    if [ "$total_enriched" -gt 0 ] && [ "$elapsed" -gt 0 ]; then
      remaining=$((backlog_start - done_count))
      if [ "$remaining" -gt 0 ]; then
        # secs_per_item = elapsed / total_enriched ; ETA = secs_per_item * remaining
        eta_secs=$(awk "BEGIN { printf \"%d\", ($elapsed * $remaining) / $total_enriched }")
        eta_min=$((eta_secs / 60))
        eta_s=$((eta_secs % 60))
        if [ "$eta_min" -gt 0 ]; then
          eta_note=", ETA ~${eta_min}m${eta_s}s"
        else
          eta_note=", ETA ~${eta_s}s"
        fi
      fi
    fi
    progress_note=" — $done_count/$backlog_start (${pct}%)$eta_note"
  fi

  echo "$ts  batch $batch: +$enriched enriched, $errors errors$progress_note$bail_note"

  # processed=0 means the server found nothing matching the filter — we're done.
  if [ "$processed" = "0" ]; then
    elapsed=$(( $(date +%s) - start_epoch ))
    elapsed_min=$((elapsed / 60))
    elapsed_s=$((elapsed % 60))
    echo ""
    echo "Done in ${elapsed_min}m${elapsed_s}s. Total enriched: $total_enriched (with $total_errors errors)."
    break
  fi

  sleep "$SLEEP_SECS"
done
