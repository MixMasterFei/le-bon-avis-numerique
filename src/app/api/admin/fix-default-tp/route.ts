import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  getMovieDetails,
  getTVDetails,
  getFrenchCertification,
  getTVFrenchRating,
  mapCertificationToInternal,
} from "@/lib/tmdb"

const BATCH_SIZE = 20
const TMDB_DELAY_MS = 300 // ~3 req/s, well under 40 req/10s limit

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function GET() {
  const tpCount = await prisma.mediaItem.count({
    where: {
      type: { in: ["MOVIE", "TV"] },
      officialRating: "TOUS_PUBLICS",
    },
  })

  const nullCount = await prisma.mediaItem.count({
    where: {
      type: { in: ["MOVIE", "TV"] },
      officialRating: null,
    },
  })

  const totalMovieTV = await prisma.mediaItem.count({
    where: { type: { in: ["MOVIE", "TV"] } },
  })

  return NextResponse.json({
    tousPublics: tpCount,
    nonClasse: nullCount,
    totalMovieTV,
    message: `${tpCount} items marked "Tous publics". POST to re-check each against TMDB and reset false positives to null.`,
  })
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get("limit") || "30")
    const dryRun = url.searchParams.get("dry") === "true"

    // Get MOVIE/TV items currently marked TOUS_PUBLICS
    const totalTP = await prisma.mediaItem.count({
      where: { type: { in: ["MOVIE", "TV"] }, officialRating: "TOUS_PUBLICS", tmdbId: { not: null } },
    })
    const items = await prisma.mediaItem.findMany({
      where: {
        type: { in: ["MOVIE", "TV"] },
        officialRating: "TOUS_PUBLICS",
        tmdbId: { not: null },
      },
      select: {
        id: true,
        title: true,
        type: true,
        tmdbId: true,
      },
      take: limit,
    })

    let resetToNull = 0
    let updatedToReal = 0
    let keptAsTP = 0
    let errors = 0
    const changes: string[] = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      try {
        let rawCert: string | null = null

        if (item.type === "MOVIE") {
          const details = await getMovieDetails(item.tmdbId!)
          rawCert = getFrenchCertification(details.release_dates)
        } else if (item.type === "TV") {
          const details = await getTVDetails(item.tmdbId!)
          rawCert = getTVFrenchRating(details.content_ratings)
        }

        const newRating = mapCertificationToInternal(rawCert)

        if (newRating === null) {
          // TMDB has no French cert — this was a false "Tous publics"
          if (!dryRun) {
            await prisma.mediaItem.update({
              where: { id: item.id },
              data: { officialRating: null },
            })
          }
          resetToNull++
          changes.push(`${item.title}: TOUS_PUBLICS → null (no TMDB data)`)
        } else if (newRating !== "TOUS_PUBLICS") {
          // TMDB now has a real cert different from TP
          if (!dryRun) {
            await prisma.mediaItem.update({
              where: { id: item.id },
              data: { officialRating: newRating },
            })
          }
          updatedToReal++
          changes.push(`${item.title}: TOUS_PUBLICS → ${newRating}`)
        } else {
          // TMDB confirms it's actually Tous publics
          keptAsTP++
        }
      } catch (err) {
        errors++
        changes.push(`${item.title}: ERROR — ${err instanceof Error ? err.message : "unknown"}`)
      }

      // Rate limiting
      if ((i + 1) % BATCH_SIZE === 0) {
        await sleep(TMDB_DELAY_MS * BATCH_SIZE)
      } else {
        await sleep(TMDB_DELAY_MS)
      }
    }

    // After processing, check if there are more TP items left
    const remainingTP = await prisma.mediaItem.count({
      where: { type: { in: ["MOVIE", "TV"] }, officialRating: "TOUS_PUBLICS", tmdbId: { not: null } },
    })
    const done = remainingTP === 0 || items.length < limit

    return NextResponse.json({
      success: true,
      dryRun,
      processed: items.length,
      totalTP,
      remainingTP,
      resetToNull,
      updatedToReal,
      keptAsTP,
      errors,
      done,
      changes: changes.slice(0, 50),
    })
  } catch (error) {
    console.error("Fix default TP error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    )
  }
}
