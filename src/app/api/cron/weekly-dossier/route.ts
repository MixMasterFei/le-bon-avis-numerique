import { NextRequest, NextResponse } from "next/server"
import { runWeeklyDossier } from "@/lib/news-dossier"
import { logCronRun } from "@/lib/cron-log"
import { withCronLock } from "@/lib/cron-lock"

// Long-read agent does one big LLM call (8K output tokens) plus
// moderation + image mirror. 60s is borderline; 300s gives headroom.
export const maxDuration = 300

// Lease ≥ maxDuration with margin — see news-discover for rationale.
const LOCK_LEASE_SECONDS = 600

/**
 * Sunday 05:00 UTC — write the weekly "Dossier de la semaine".
 *
 * Picks one theme from the past 7 days of brief stories and synthesizes
 * an 800-1200 word long-read. Idempotent across re-runs (slug collision
 * handled by the agent), but only one dossier per week is meaningful —
 * the cron schedule should never trigger this twice.
 */

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization")
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true
  // Development bypass requires an explicit opt-in flag. Without it,
  // a `next dev` accidentally exposed over a tunnel / LAN can't be
  // used to trigger expensive LLM + DB jobs anonymously. Set
  // ALLOW_INSECURE_CRON_LOCAL=true in `.env.local` if you actually
  // need to hit this endpoint without the Bearer token while iterating.
  if (
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_INSECURE_CRON_LOCAL === "true"
  ) {
    return true
  }
  return false
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startedAt = Date.now()
  // ?force=true bypasses the 6-day idempotency guard. Used after
  // archiving stale dossiers so we can immediately regenerate under
  // updated prompts without waiting for next week's cron.
  const url = new URL(req.url)
  const force = url.searchParams.get("force") === "true"
  try {
    const stats = await withCronLock("weekly-dossier", LOCK_LEASE_SECONDS, () =>
      runWeeklyDossier({ force }),
    )
    if (stats === null) {
      await logCronRun({
        task: "weekly-dossier",
        status: "partial",
        summary: "Skipped — another run already in progress",
        startTime: startedAt,
      })
      return NextResponse.json({ skipped: true, reason: "lock-held" })
    }
    await logCronRun({
      task: "weekly-dossier",
      status: stats.result === "error" ? "error" : stats.result === "persisted" ? "success" : "partial",
      summary: `result=${stats.result} briefs=${stats.briefsConsidered}${stats.reason ? ` (${stats.reason})` : ""}${stats.dossierId ? ` id=${stats.dossierId}` : ""}`,
      details: { ...stats },
      startTime: startedAt,
    })
    return NextResponse.json({ success: stats.result !== "error", ...stats })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown"
    await logCronRun({
      task: "weekly-dossier",
      status: "error",
      summary: `Weekly dossier failed: ${msg}`,
      details: { error: msg },
      startTime: startedAt,
    })
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
