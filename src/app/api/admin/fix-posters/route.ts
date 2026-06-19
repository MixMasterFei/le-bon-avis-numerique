import { NextRequest, NextResponse } from "next/server"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { prisma } from "@/lib/prisma"
import { getBestPosterPath } from "@/lib/tmdb"
import { logCronRun } from "@/lib/cron-log"
import type { Prisma } from "@prisma/client"

export const maxDuration = 60

const PLACEHOLDER = "/placeholder-poster.jpg"
const BATCH = 50

// Items that render a BROKEN card: no poster, empty, or the (404'ing)
// placeholder string. A valid https://image.tmdb.org URL is NOT broken — the
// old filter matched every TMDB poster and, ordered by quality, never reached
// the actually-broken items. All have a tmdbId, so they're re-fetchable.
const brokenPosterWhere: Prisma.MediaItemWhereInput = {
  tmdbId: { not: null },
  type: { in: ["MOVIE", "TV"] },
  OR: [{ posterUrl: null }, { posterUrl: "" }, { posterUrl: PLACEHOLDER }],
}

/**
 * POST /api/admin/fix-posters[?afterId=&total=]
 * Refreshes posters from TMDB for movies/TV whose poster is missing or is the
 * placeholder. Cursor-paginated (id ASC) so the admin "Réparer les affiches"
 * operation can loop until done. Processes up to 50 items per call.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()

  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const afterId = req.nextUrl.searchParams.get("afterId")
  const totalParam = req.nextUrl.searchParams.get("total")
  // Stable denominator for the progress bar: counted once on the first call,
  // then carried forward via the query param (the matching set shrinks as we fix).
  const total = totalParam
    ? parseInt(totalParam, 10)
    : await prisma.mediaItem.count({ where: brokenPosterWhere })

  const items = await prisma.mediaItem.findMany({
    where: afterId ? { ...brokenPosterWhere, id: { gt: afterId } } : brokenPosterWhere,
    select: { id: true, tmdbId: true, type: true, title: true, posterUrl: true },
    take: BATCH,
    orderBy: { id: "asc" },
  })

  let updated = 0
  let errors = 0
  let skipped = 0
  const results: { title: string; status: string }[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    try {
      // Use the full image set (fr,en,null), NOT the localized details poster —
      // the latter is null for films without a FR-tagged poster, which falsely
      // reads as "no poster on TMDB".
      const newPosterPath = await getBestPosterPath(item.tmdbId!, item.type as "MOVIE" | "TV")

      const newPosterUrl = newPosterPath
        ? `https://image.tmdb.org/t/p/w500${newPosterPath}`
        : null

      if (newPosterUrl && newPosterUrl !== item.posterUrl) {
        await prisma.mediaItem.update({
          where: { id: item.id },
          data: { posterUrl: newPosterUrl },
        })
        updated++
        results.push({ title: item.title, status: "updated" })
      } else {
        // No poster on TMDB (genuinely poster-less) or already correct.
        skipped++
        results.push({ title: item.title, status: newPosterUrl ? "unchanged" : "no_poster_on_tmdb" })
      }

      // TMDB rate limit: ~40 req/10s
      if (i % 10 === 9) {
        await new Promise((r) => setTimeout(r, 500))
      }
    } catch (err) {
      errors++
      results.push({ title: item.title, status: `error: ${String(err)}` })
    }
  }

  const lastId = items.length > 0 ? items[items.length - 1].id : null
  const done = items.length < BATCH

  await logCronRun({
    task: "fix-posters",
    status: errors > 0 && updated === 0 ? "partial" : "success",
    summary: `Checked ${items.length}, updated ${updated}, skipped ${skipped}, errors ${errors}`,
    details: { checked: items.length, updated, skipped, errors },
    startTime,
  })

  return NextResponse.json({
    done,
    lastId,
    total,
    checked: items.length,
    processed: items.length,
    updated,
    skipped,
    errors,
    duration: `${Date.now() - startTime}ms`,
    results,
  })
}
