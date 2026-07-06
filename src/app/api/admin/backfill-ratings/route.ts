import { NextRequest, NextResponse } from "next/server"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { prisma } from "@/lib/prisma"
import { getMovieDetails, getTVDetails } from "@/lib/tmdb"
import { logCronRun } from "@/lib/cron-log"

export const maxDuration = 60

/**
 * POST /api/admin/backfill-ratings
 * Backfill tmdbRating + tmdbVoteCount for existing items that don't have them yet.
 * Processes up to 50 items per call to stay within timeout.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()

  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Find items with tmdbId but no rating stored yet
  const items = await prisma.mediaItem.findMany({
    where: {
      tmdbId: { not: null },
      tmdbRating: null,
      type: { in: ["MOVIE", "TV"] },
    },
    select: { id: true, tmdbId: true, type: true },
    take: 50,
    orderBy: { dataQualityScore: "desc" },
  })

  if (items.length === 0) {
    await logCronRun({
      task: "backfill-ratings",
      status: "success",
      summary: "Tous les items ont deja des notes TMDB",
      startTime,
    })
    return NextResponse.json({ message: "All items already have ratings", updated: 0 })
  }

  let updated = 0
  let unratable = 0
  let errors = 0

  for (const item of items) {
    try {
      // `vote_average` is legitimately 0 for titles TMDB has no votes
      // for. We MUST still persist that 0 — otherwise tmdbRating stays
      // NULL, the item is re-selected on the next run, and (because the
      // query is ordered by dataQualityScore DESC) the backfill loops
      // forever on the same top-N items, never draining the queue.
      // Use `?? 0` so a present-but-zero value is stored, not skipped.
      let rating = 0
      let voteCount = 0

      if (item.type === "MOVIE") {
        const details = await getMovieDetails(item.tmdbId!)
        rating = details.vote_average ?? 0
        voteCount = details.vote_count ?? 0
      } else if (item.type === "TV") {
        const details = await getTVDetails(item.tmdbId!)
        rating = details.vote_average ?? 0
        voteCount = details.vote_count ?? 0
      }

      await prisma.mediaItem.update({
        where: { id: item.id },
        data: { tmdbRating: rating, tmdbVoteCount: voteCount },
      })
      updated++

      await new Promise((resolve) => setTimeout(resolve, 150))
    } catch (error) {
      // A 404 means the tmdbId no longer exists on TMDB (deleted/merged
      // title) — it will NEVER get a rating, so persist 0/0 to drain it
      // from the queue. Without this, the same handful of dead ids was
      // re-selected every batch (highest dataQualityScore first) and the
      // Saturday loop spun on them forever. Transient failures (429,
      // timeout, 5xx) still fall through to errors++ and retry next run.
      const message = error instanceof Error ? error.message : ""
      if (message.includes("TMDB API error: 404")) {
        try {
          await prisma.mediaItem.update({
            where: { id: item.id },
            data: { tmdbRating: 0, tmdbVoteCount: 0 },
          })
          unratable++
        } catch {
          errors++
        }
      } else {
        errors++
      }
    }
  }

  const remaining = await prisma.mediaItem.count({
    where: { tmdbId: { not: null }, tmdbRating: null, type: { in: ["MOVIE", "TV"] } },
  })

  await logCronRun({
    task: "backfill-ratings",
    status: errors > 0 ? "partial" : "success",
    summary: `${updated} notes TMDB ajoutees${unratable > 0 ? `, ${unratable} sans fiche TMDB (ignores)` : ""}, ${remaining} restants`,
    details: { updated, unratable, errors, remaining },
    startTime,
  })

  return NextResponse.json({
    updated,
    unratable,
    errors,
    remaining,
    message: remaining > 0
      ? `Updated ${updated} items. ${remaining} remaining - call again to continue.`
      : `Done! Updated ${updated} items. All items now have ratings.`,
  })
}
