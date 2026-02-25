import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  getMovieDetails,
  getTVDetails,
  getFrenchCertification,
  getTVFrenchRating,
  mapCertificationToInternal,
} from "@/lib/tmdb"

export const maxDuration = 60

/**
 * Backfill official certifications from TMDB for items that have officialRating = null.
 * Chunked endpoint — called repeatedly by the Operations Center.
 *
 * POST body:
 *   limit: number (items per chunk, default 20)
 *   mediaType: "MOVIE" | "TV" | "ALL" (default "ALL")
 *
 * Query params:
 *   afterId: cursor for pagination
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { limit = 20, mediaType = "ALL" } = body
    const afterId = request.nextUrl.searchParams.get("afterId")

    const typeFilter = mediaType === "ALL"
      ? { type: { in: ["MOVIE", "TV"] as ("MOVIE" | "TV")[] } }
      : { type: mediaType as "MOVIE" | "TV" }

    const whereClause = {
      ...typeFilter,
      officialRating: null as string | null,
      tmdbId: { not: null },
      ...(afterId ? { id: { gt: afterId } } : {}),
    }

    const items = await prisma.mediaItem.findMany({
      where: whereClause,
      take: limit,
      orderBy: { id: "asc" },
      select: {
        id: true,
        title: true,
        type: true,
        tmdbId: true,
      },
    })

    const remaining = await prisma.mediaItem.count({
      where: {
        ...typeFilter,
        officialRating: null as string | null,
        tmdbId: { not: null },
        ...(items.length > 0 ? { id: { gt: items[items.length - 1].id } } : {}),
      },
    })

    let updated = 0
    let skipped = 0
    let errors = 0
    const details: string[] = []

    for (const item of items) {
      try {
        let cert: string | null = null

        if (item.type === "MOVIE" && item.tmdbId) {
          const movieDetails = await getMovieDetails(item.tmdbId)
          const rawCert = getFrenchCertification(movieDetails.release_dates)
          cert = mapCertificationToInternal(rawCert)
        } else if (item.type === "TV" && item.tmdbId) {
          const tvDetails = await getTVDetails(item.tmdbId)
          const rawCert = getTVFrenchRating(tvDetails.content_ratings)
          cert = mapCertificationToInternal(rawCert)
        }

        if (cert) {
          await prisma.mediaItem.update({
            where: { id: item.id },
            data: { officialRating: cert },
          })
          updated++
          details.push(`${item.title} → ${cert}`)
        } else {
          skipped++
        }

        // Respect TMDB rate limits (40 req/10s)
        await new Promise((r) => setTimeout(r, 300))
      } catch (err) {
        errors++
        console.error(`[backfill-cert] Error for ${item.title}:`, err)
      }
    }

    const lastId = items.length > 0 ? items[items.length - 1].id : null
    const done = items.length < limit

    return NextResponse.json({
      success: true,
      done,
      lastId,
      remaining: done ? 0 : remaining,
      processed: items.length,
      updated,
      skipped,
      errors,
      details: details.slice(0, 20), // Limit details to avoid huge responses
    })
  } catch (error) {
    console.error("[backfill-cert] Error:", error)
    return NextResponse.json(
      { error: "Backfill failed", details: String(error) },
      { status: 500 },
    )
  }
}
