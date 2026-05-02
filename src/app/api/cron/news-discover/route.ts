import { NextRequest, NextResponse } from "next/server"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"
import { withCronLock } from "@/lib/cron-lock"
import { runNewsDiscover } from "@/lib/news-discover"

// Pipeline now does synthesis + per-story moderation (vision-capable
// when OPENAI_API_KEY is set) + research extraction. Each LLM call
// is 1-5s, so the 60s ceiling was getting tight with 8-10 stories.
// Bump to 300s (Vercel Pro maximum) to give headroom.
export const maxDuration = 300

// Lease for the cron lock. Must be ≥ maxDuration so a healthy run
// always finishes inside its lease, with margin for clock drift /
// post-run logging. If the Lambda dies mid-run, the lease auto-expires
// after this window and the next scheduled invocation can recover.
const LOCK_LEASE_SECONDS = 600

export async function GET(req: NextRequest) {
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  try {
    const stats = await withCronLock("news-discover", LOCK_LEASE_SECONDS, () =>
      runNewsDiscover(),
    )
    if (stats === null) {
      // Another worker is mid-run. Return 200 (not 500) so GH Actions
      // doesn't flag this as a failure on overlapping schedules.
      await logCronRun({
        task: "news-discover",
        status: "partial",
        summary: "Skipped — another run already in progress",
        startTime,
      })
      return NextResponse.json({ skipped: true, reason: "lock-held" })
    }
    await logCronRun({
      task: "news-discover",
      status: stats.storiesPersisted > 0 ? "success" : "partial",
      summary: `${stats.storiesPersisted} histoires synthétisées à partir de ${stats.itemsCollected} articles`,
      details: stats as unknown as Record<string, unknown>,
      startTime,
    })
    return NextResponse.json({ success: true, ...stats })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    console.error("[cron] news-discover failed:", error)
    await logCronRun({
      task: "news-discover",
      status: "error",
      summary: msg,
      startTime,
    })
    return NextResponse.json({ error: "Discover failed", message: msg }, { status: 500 })
  }
}
