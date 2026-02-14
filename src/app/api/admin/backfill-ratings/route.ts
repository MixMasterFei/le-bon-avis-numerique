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
  let errors = 0

  for (const item of items) {
    try {
      let rating: number | null = null
      let voteCount: number | null = null

      if (item.type === "MOVIE") {
        const details = await getMovieDetails(item.tmdbId!)
        rating = details.vote_average || null
        voteCount = details.vote_count || null
      } else if (item.type === "TV") {
        const details = await getTVDetails(item.tmdbId!)
        rating = details.vote_average || null
        voteCount = details.vote_count || null
      }

      if (rating !== null) {
        await prisma.mediaItem.update({
          where: { id: item.id },
          data: { tmdbRating: rating, tmdbVoteCount: voteCount },
        })
        updated++
      }

      await new Promise((resolve) => setTimeout(resolve, 150))
    } catch {
      errors++
    }
  }

  const remaining = await prisma.mediaItem.count({
    where: { tmdbId: { not: null }, tmdbRating: null, type: { in: ["MOVIE", "TV"] } },
  })

  await logCronRun({
    task: "backfill-ratings",
    status: errors > 0 ? "partial" : "success",
    summary: `${updated} notes TMDB ajoutees, ${remaining} restants`,
    details: { updated, errors, remaining },
    startTime,
  })

  return NextResponse.json({
    updated,
    errors,
    remaining,
    message: remaining > 0
      ? `Updated ${updated} items. ${remaining} remaining - call again to continue.`
      : `Done! Updated ${updated} items. All items now have ratings.`,
  })
}
