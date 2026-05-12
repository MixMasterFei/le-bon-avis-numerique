import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"

export const maxDuration = 30

/**
 * Watchdog for the GitHub Actions cron pipeline.
 *
 * Every other automated job in this app runs from GitHub Actions — and
 * so does the daily supervisor that's supposed to catch failures. If
 * GitHub Actions itself stops dispatching runners (it has happened:
 * "job was not acquired by Runner of type hosted"), the supervisor
 * goes silent right alongside everything it watches, and nobody hears
 * about it.
 *
 * This route runs from **Vercel Cron** instead — separate infra — so it
 * stays alive when GH Actions doesn't. It checks whether the
 * daily-cadence "canary" jobs have logged a run recently; if NONE of
 * them have, the whole GH Actions pipeline is down and `logCronRun`
 * fires the failure email (the only channel left).
 */

// Jobs that GitHub Actions runs at least once a day. Seeing a recent
// cron_log row from any of these means the GH Actions pipeline is alive.
const DAILY_CANARY_TASKS = ["cron-supervisor", "enrich", "import", "news-discover"]
// GH Actions free runners can queue for hours; 30h leaves slack for a
// late run before we call the pipeline dead.
const STALE_HOURS = 30

export async function GET(req: NextRequest) {
  // Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically
  // when CRON_SECRET is set in the project env, so this is the same gate
  // as every other cron route.
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  try {
    const since = new Date(Date.now() - STALE_HOURS * 3_600_000)
    const recent = await prisma.cronLog.findMany({
      where: { task: { in: DAILY_CANARY_TASKS }, createdAt: { gte: since } },
      select: { task: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    })
    const seen = new Set(recent.map((r) => r.task))
    const missing = DAILY_CANARY_TASKS.filter((t) => !seen.has(t))
    const pipelineDown = seen.size === 0

    // status === "error" → logCronRun sends sendCronFailureAlert. (Note:
    // if CRON_ALERT_MODE=digest the immediate mail is suppressed in
    // favour of the supervisor digest — but the whole point of this
    // route is the case where the supervisor isn't running, so digest
    // mode should not be enabled in production.)
    await logCronRun({
      task: "heartbeat",
      status: pipelineDown ? "error" : missing.length > 0 ? "partial" : "success",
      summary: pipelineDown
        ? `Pipeline GitHub Actions HORS SERVICE — aucun job canary (${DAILY_CANARY_TASKS.join(", ")}) depuis ${STALE_HOURS}h. Vérifier https://github.com/MixMasterFei/le-bon-avis-numerique/actions`
        : missing.length > 0
          ? `${seen.size}/${DAILY_CANARY_TASKS.length} canaries vus ${STALE_HOURS}h (manquants: ${missing.join(", ")})`
          : `OK — ${DAILY_CANARY_TASKS.length}/${DAILY_CANARY_TASKS.length} canaries vus`,
      details: { seen: [...seen], missing, staleHours: STALE_HOURS },
      startTime,
    })

    return NextResponse.json({ ok: !pipelineDown, seen: [...seen], missing })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "heartbeat failed"
    console.error("[cron-heartbeat] failed:", error)
    await logCronRun({ task: "heartbeat", status: "error", summary: msg, startTime })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
