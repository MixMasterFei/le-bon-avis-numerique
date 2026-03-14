import { NextRequest, NextResponse } from "next/server"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { prisma } from "@/lib/prisma"
import { getMovieDetails, getTVDetails } from "@/lib/tmdb"
import { logCronRun } from "@/lib/cron-log"

export const maxDuration = 60

/**
 * POST /api/admin/fix-posters
 * Finds media items with broken or missing poster URLs and refreshes them from TMDB.
 * Processes up to 50 items per call.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()

  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Find items with tmdbId that either have no poster or a potentially broken one
  const items = await prisma.mediaItem.findMany({
    where: {
      tmdbId: { not: null },
      type: { in: ["MOVIE", "TV"] },
      OR: [
        { posterUrl: null },
        { posterUrl: "" },
        // TMDB poster URLs that might be stale
        { posterUrl: { startsWith: "https://image.tmdb.org" } },
      ],
    },
    select: { id: true, tmdbId: true, type: true, title: true, posterUrl: true },
    take: 50,
    orderBy: { dataQualityScore: "desc" },
  })

  let updated = 0
  let errors = 0
  const results: { title: string; status: string }[] = []

  for (const item of items) {
    try {
      let newPosterPath: string | null = null

      if (item.type === "MOVIE") {
        const details = await getMovieDetails(item.tmdbId!)
        newPosterPath = details.poster_path
      } else if (item.type === "TV") {
        const details = await getTVDetails(item.tmdbId!)
        newPosterPath = details.poster_path
      }

      const newPosterUrl = newPosterPath
        ? `https://image.tmdb.org/t/p/w500${newPosterPath}`
        : null

      // Only update if the URL actually changed
      if (newPosterUrl && newPosterUrl !== item.posterUrl) {
        await prisma.mediaItem.update({
          where: { id: item.id },
          data: { posterUrl: newPosterUrl },
        })
        updated++
        results.push({ title: item.title, status: "updated" })
      } else if (!newPosterUrl && item.posterUrl) {
        // TMDB removed the poster entirely
        results.push({ title: item.title, status: "no_poster_on_tmdb" })
      } else {
        results.push({ title: item.title, status: "unchanged" })
      }

      // TMDB rate limit: ~40 req/10s
      if (items.indexOf(item) % 10 === 9) {
        await new Promise((r) => setTimeout(r, 500))
      }
    } catch (err) {
      errors++
      results.push({ title: item.title, status: `error: ${String(err)}` })
    }
  }

  await logCronRun({
    task: "fix-posters",
    status: updated > 0 ? "success" : "partial",
    summary: `Checked ${items.length}, updated ${updated}, errors ${errors}`,
    details: { checked: items.length, updated, errors },
    startTime,
  })

  return NextResponse.json({
    checked: items.length,
    updated,
    errors,
    duration: `${Date.now() - startTime}ms`,
    results,
  })
}
