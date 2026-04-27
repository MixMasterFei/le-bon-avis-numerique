import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { runNewsDiscover } from "@/lib/news-discover"
import { runWeeklyDossier } from "@/lib/news-dossier"
import { logCronRun } from "@/lib/cron-log"

/**
 * One-shot admin action: archive every PUBLISHED brief + dossier,
 * then re-run news synthesis and dossier generation against the
 * (now-empty) feed. Lets Xavier preview the new prompt's output
 * without waiting for the next scheduled cron tick.
 *
 * Idempotent on re-call: archives whatever is currently PUBLISHED,
 * then synthesizes fresh content. Safe to spam-click without
 * compounding archives.
 *
 * Vercel Pro maxDuration cap is 300s. News-discover + weekly-dossier
 * each typically take 30-90s with the moderation + judge passes, so
 * the whole flow fits comfortably under that ceiling.
 */
export const maxDuration = 300
export const dynamic = "force-dynamic"

export async function POST() {
  const session = await auth()
  const user = session?.user as { email?: string | null; role?: string } | undefined
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  try {
    // 1. Archive all currently-published news. Dedup in news-discover
    //    only consults PUBLISHED rows, so archived stories don't block
    //    fresh re-syntheses on the same topic.
    const archived = await prisma.newsStory.updateMany({
      where: { status: "PUBLISHED" },
      data: { status: "ARCHIVED" },
    })

    // 2. Re-run brief synthesis against the now-empty feed.
    const discoverStats = await runNewsDiscover()

    // 3. Force a fresh dossier (bypasses the 6-day idempotency guard
    //    since the previous dossier just got archived but its
    //    publishedAt is still recent).
    const dossierStats = await runWeeklyDossier({ force: true })

    const totalMs = Date.now() - startTime
    await logCronRun({
      task: "news-rebuild",
      status: "success",
      summary: `archivé=${archived.count}, briefs=${discoverStats.storiesPersisted}, dossier=${dossierStats.result}`,
      details: {
        archived: archived.count,
        discover: discoverStats as unknown as Record<string, unknown>,
        dossier: dossierStats as unknown as Record<string, unknown>,
        totalMs,
      },
      startTime,
    })

    return NextResponse.json({
      success: true,
      archived: archived.count,
      discover: discoverStats,
      dossier: dossierStats,
      totalMs,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    console.error("[admin/news-rebuild] failed:", error)
    await logCronRun({
      task: "news-rebuild",
      status: "error",
      summary: `Rebuild manuel : ${msg}`,
      startTime,
    })
    return NextResponse.json({ error: "Rebuild failed", message: msg }, { status: 500 })
  }
}
