import { NextRequest, NextResponse } from "next/server"
import { runWeeklyDossier } from "@/lib/news-dossier"
import { logCronRun } from "@/lib/cron-log"

export const maxDuration = 60

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
  if (process.env.NODE_ENV === "development") return true
  return false
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startedAt = Date.now()
  try {
    const stats = await runWeeklyDossier()
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
