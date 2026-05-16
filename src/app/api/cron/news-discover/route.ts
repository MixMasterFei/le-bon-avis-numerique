import { NextRequest, NextResponse } from "next/server"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"
import { withCronLock } from "@/lib/cron-lock"
import { runNewsDiscover } from "@/lib/news-discover"

// Pipeline does synthesis (Sonnet 4.6) + per-story moderation/quality/
// research/catalog-verify (Haiku 4.5). Each LLM call has its own
// AbortController timeout (synthesis 180s, others 20-30s) so a single
// stuck call can no longer starve the run. 300s is the Vercel
// function ceiling.
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
    // Status mapping:
    //   success - at least one story was persisted.
    //   partial - feeds or synthesis produced no usable story this
    //             cycle. This stays visible in cron_logs, but no
    //             longer turns the whole scheduled-maintenance workflow
    //             red unless the route actually throws below.
    const status: "success" | "partial" =
      stats.storiesPersisted > 0 ? "success" : "partial"

    // Surface the dropped-counter mix in the summary so the admin
    // dashboard table tells you WHY a run produced few/0 stories without
    // having to expand the details JSON.
    const dropMix =
      stats.itemsDroppedNoImage +
        stats.storiesDroppedInvalid +
        stats.storiesDroppedUnsuitable +
        stats.storiesDroppedImageReused +
        stats.storiesDroppedImageUnreachable >
      0
        ? ` · drops: noImg=${stats.itemsDroppedNoImage} invalid=${stats.storiesDroppedInvalid} unsuit=${stats.storiesDroppedUnsuitable} imgReused=${stats.storiesDroppedImageReused} imgUnreach=${stats.storiesDroppedImageUnreachable}`
        : ""
    // How much of the run leaned on the branded fallback card — a high
    // ratio means the feeds were image-starved that cycle, not that
    // anything broke.
    const cardMix =
      stats.storiesUsingFallbackCard > 0
        ? ` · cartes: ${stats.storiesUsingFallbackCard}/${stats.storiesPersisted} (items repli=${stats.itemsFellBackToCard})`
        : ""

    await logCronRun({
      task: "news-discover",
      status,
      summary: `${stats.storiesPersisted} histoires synthétisées à partir de ${stats.itemsCollected} articles${cardMix}${dropMix}`,
      details: stats as unknown as Record<string, unknown>,
      startTime,
    })

    return NextResponse.json({
      success: status === "success",
      partial: status === "partial",
      reason: status === "partial" ? "0 stories produced this cycle" : undefined,
      ...stats,
    })
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
