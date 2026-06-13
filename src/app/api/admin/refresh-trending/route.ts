import { NextRequest, NextResponse } from "next/server"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { refreshTrending } from "@/lib/trending"
import { logCronRun } from "@/lib/cron-log"

export const maxDuration = 60

/**
 * POST /api/admin/refresh-trending
 *
 * Manually refresh the "tendance du moment" signal (TMDB /trending +
 * IGDB popularity) that powers the homepage time-aware hero rail. Also
 * runs daily inside the import cron; this route lets an admin re-roll it
 * on demand (and is dual cron/admin-authorized so it can be wired as its
 * own cron later without code changes).
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()

  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const stats = await refreshTrending()
    const duration = Math.round((Date.now() - startTime) / 1000)

    await logCronRun({
      task: "trending-refresh",
      status: stats.errors > 0 && stats.total === 0 ? "error" : "success",
      summary: `${stats.total} titres tendance (${stats.movies} films, ${stats.tv} séries, ${stats.games} jeux) en ${duration}s`,
      details: { ...stats },
      startTime,
    })

    return NextResponse.json({ success: true, duration: `${duration}s`, ...stats })
  } catch (error) {
    await logCronRun({
      task: "trending-refresh",
      status: "error",
      summary: error instanceof Error ? error.message : "Trending refresh failed",
      startTime,
    })
    return NextResponse.json(
      { error: "Refresh failed", message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    )
  }
}
