import { NextRequest, NextResponse } from "next/server"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { prisma } from "@/lib/prisma"
import { logCronRun } from "@/lib/cron-log"
import {
  refreshFromTmdb,
  staleReleaseStatusWhere,
  STALE_RELEASE_STATUS_ORDER,
  TMDB_REFRESH_SELECT,
} from "@/lib/tmdb-refresh"

export const maxDuration = 120

const DEFAULT_LIMIT = 80
const MAX_LIMIT = 200
// Leave room under maxDuration for the final count + cron log.
const TIME_BUDGET_MS = 100_000

/**
 * POST /api/admin/refresh-release-status — daily (Daily Import job).
 *
 * Re-reads on TMDB the lifecycle status of films/series imported before
 * release ("Post Production", "Planned"…) once their release date has passed,
 * plus undated announced titles weekly. `release_status` used to be written
 * once at import, and the enrichment gate excludes pre-release statuses, so
 * those titles were never enriched. The same call refreshes their vote
 * counters. See src/lib/tmdb-refresh.ts.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()

  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const url = new URL(req.url)
    const requested = Number.parseInt(url.searchParams.get("limit") ?? "", 10)
    const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, MAX_LIMIT) : DEFAULT_LIMIT

    const rows = await prisma.mediaItem.findMany({
      where: staleReleaseStatusWhere(new Date()),
      select: TMDB_REFRESH_SELECT,
      orderBy: STALE_RELEASE_STATUS_ORDER,
      take: limit,
    })

    const result = await refreshFromTmdb(rows, { deadline: startTime + TIME_BUDGET_MS })
    // Re-read rows are stamped, so this is what is still waiting for a re-read.
    const remaining = await prisma.mediaItem.count({ where: staleReleaseStatusWhere(new Date()) })

    const released = result.nowReleased.length
    await logCronRun({
      task: "release-status",
      status: result.errors > 0 ? "partial" : "success",
      summary:
        `${released} titre${released > 1 ? "s" : ""} désormais sorti${released > 1 ? "s" : ""} ` +
        `(${result.examined} statuts relus, ${result.updated} fiches modifiées)` +
        `${result.errors > 0 ? `, ${result.errors} erreurs` : ""}, ${remaining} en attente`,
      details: { ...result, nowReleased: result.nowReleased.slice(0, 25), remaining },
      startTime,
    })

    return NextResponse.json({ success: true, ...result, remaining, done: remaining === 0 })
  } catch (error) {
    console.error("[refresh-release-status] failed:", error)
    await logCronRun({
      task: "release-status",
      status: "error",
      summary: error instanceof Error ? error.message : "Release status refresh failed",
      startTime,
    })
    return NextResponse.json(
      { success: false, error: "Failed to refresh release statuses" },
      { status: 500 },
    )
  }
}
