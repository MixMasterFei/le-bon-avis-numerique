import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { RAN_STATUSES, decideLateRuns, guardedJobsFor } from "@/lib/late-run-guard"

export const dynamic = "force-dynamic"
export const maxDuration = 15

/**
 * Read-only: which jobs of this `github.event.schedule` slot have already
 * been done (by the heartbeat's re-dispatch or by hand) and must not run
 * again. Called by cron.yml's `late-guard` job on schedule events only.
 * Writes nothing — no cron_logs row, a skip is not a run.
 * See src/lib/late-run-guard.ts.
 *
 *   GET /api/cron/already-ran?schedule=7%203%20*%20*%20*
 *   → { schedule, skip: ["import"], checks: [...] }
 */
export async function GET(req: NextRequest) {
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const schedule = req.nextUrl.searchParams.get("schedule")?.trim()
  if (!schedule) {
    return NextResponse.json({ error: "Paramètre schedule manquant", skip: [] }, { status: 400 })
  }

  const now = new Date()
  const jobs = guardedJobsFor(schedule)
  if (jobs.length === 0) return NextResponse.json({ schedule, skip: [], checks: [] })

  try {
    const rows = await prisma.cronLog.groupBy({
      by: ["task"],
      where: {
        task: { in: [...new Set(jobs.map((j) => j.task))] },
        status: { in: [...RAN_STATUSES] },
        // Longest guarded cadence is weekly.
        createdAt: { gte: new Date(now.getTime() - 8 * 86_400_000) },
      },
      _max: { createdAt: true },
    })
    const lastOkRunByTask = new Map<string, Date>()
    for (const r of rows) if (r._max.createdAt) lastOkRunByTask.set(r.task, r._max.createdAt)
    const checks = decideLateRuns({ schedule, now, lastOkRunByTask, jobs })
    return NextResponse.json({ schedule, skip: checks.filter((c) => c.skip).map((c) => c.dispatchTask), checks })
  } catch (error) {
    // Fail open: cron.yml treats a non-200 as « skip nothing ».
    console.error("[already-ran] failed:", error)
    return NextResponse.json({ error: "lecture cron_logs impossible", skip: [] }, { status: 500 })
  }
}
