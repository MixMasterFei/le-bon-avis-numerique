import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { estimateProvisionalAgeFromStored, floorTousPublicsByGenre } from "@/lib/import-helpers"

// Admin-gated by middleware (/api/admin/*). Mutates many rows → keep batches small.
export const maxDuration = 60

/**
 * Backfill provisional ages for films/series already imported with
 * expertAgeRec = null (and therefore invisible everywhere the age filter
 * applies). Estimates from STORED data only (officialRating CSA → genre
 * heuristic) — no TMDB refetch. Leaves isEnriched = false so the UI shows the
 * "âge provisoire" badge. Each call drains the next `limit` rows; click again
 * (or re-POST) until `remaining` reaches 0.
 *
 * Second pass: re-floor films already stored at `expertAgeRec: 0` ("Tous
 * publics") that carry a mature genre. A TP thriller sits below every age
 * filter on the site AND renders without a badge, so it reads as "not rated" on
 * a family rail. Idempotent and monotonic — the floor only ever raises an age.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(Number(body.limit) || 150, 400)

    const films = await prisma.mediaItem.findMany({
      where: { type: { in: ["MOVIE", "TV"] }, expertAgeRec: null },
      select: { id: true, officialRating: true, genres: true, dataQualityScore: true },
      take: limit,
    })

    let updated = 0
    for (const film of films) {
      const { age } = estimateProvisionalAgeFromStored({
        officialRating: film.officialRating,
        genres: film.genres,
      })
      await prisma.mediaItem.update({
        where: { id: film.id },
        data: {
          expertAgeRec: age,
          // Having an age is worth at least the import baseline.
          dataQualityScore: Math.max(film.dataQualityScore, 30),
          // isEnriched stays false on purpose → flagged provisional in the UI.
        },
      })
      updated++
    }

    // Second pass — false "Tous publics" on mature-genre titles.
    let reFloored = 0
    const tpMature = await prisma.mediaItem.findMany({
      where: { type: { in: ["MOVIE", "TV"] }, expertAgeRec: 0 },
      select: { id: true, genres: true },
      take: limit,
    })
    for (const film of tpMature) {
      const floored = floorTousPublicsByGenre(0, film.genres)
      if (floored == null || floored <= 0) continue
      await prisma.mediaItem.update({
        where: { id: film.id },
        data: { expertAgeRec: floored },
      })
      reFloored++
    }

    const remaining = await prisma.mediaItem.count({
      where: { type: { in: ["MOVIE", "TV"] }, expertAgeRec: null },
    })

    return NextResponse.json({
      success: true,
      count: updated,
      reFloored,
      remaining,
      done: remaining === 0,
    })
  } catch (error) {
    console.error("backfill-provisional-age failed:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Backfill failed" },
      { status: 500 },
    )
  }
}

// GET — how many films still lack an age (so the admin can see if a backfill is needed).
export async function GET() {
  const remaining = await prisma.mediaItem.count({
    where: { type: { in: ["MOVIE", "TV"] }, expertAgeRec: null },
  })
  return NextResponse.json({ remaining })
}
