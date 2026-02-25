import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMovieWatchProviders, getTVWatchProviders } from "@/lib/tmdb"

export const maxDuration = 60

const VALID_CSA_RATINGS = [
  "TOUS_PUBLICS", "CSA_10", "CSA_12", "CSA_16", "CSA_18",
]

/**
 * Cleanup items that have no French relevance:
 * - No French CSA certification
 * - No French streaming availability
 * - Not French language
 *
 * Before deleting, rechecks TMDB for French streaming providers.
 *
 * POST body: { limit?: number }
 * Query: ?afterId=<cursor>
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const limit = body.limit || 30
    const afterId = request.nextUrl.searchParams.get("afterId")

    const whereClause = {
      type: { in: ["MOVIE", "TV"] as ("MOVIE" | "TV")[] },
      officialRating: { notIn: VALID_CSA_RATINGS },
      streamingAvailability: { none: {} },
      originalLanguage: { not: "fr" },
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
        originalLanguage: true,
      },
    })

    const remaining = await prisma.mediaItem.count({
      where: {
        type: { in: ["MOVIE", "TV"] as ("MOVIE" | "TV")[] },
        officialRating: { notIn: VALID_CSA_RATINGS },
        streamingAvailability: { none: {} },
        originalLanguage: { not: "fr" },
        ...(items.length > 0 ? { id: { gt: items[items.length - 1].id } } : {}),
      },
    })

    let deleted = 0
    let kept = 0
    let errors = 0

    for (const item of items) {
      try {
        // Recheck TMDB for French streaming providers before deleting
        if (item.tmdbId) {
          const frProviders = item.type === "MOVIE"
            ? await getMovieWatchProviders(item.tmdbId)
            : await getTVWatchProviders(item.tmdbId)

          if (frProviders) {
            // Item now has FR streaming — keep it
            kept++
            await new Promise((r) => setTimeout(r, 200))
            continue
          }
        }

        // No French relevance confirmed — delete (cascades to related records)
        await prisma.mediaItem.delete({ where: { id: item.id } })
        deleted++

        await new Promise((r) => setTimeout(r, 200))
      } catch {
        errors++
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
      deleted,
      kept,
      errors,
    })
  } catch (error) {
    console.error("[cleanup-non-french] Error:", error)
    return NextResponse.json(
      { error: "Cleanup failed", details: String(error) },
      { status: 500 },
    )
  }
}

/**
 * GET — Preview: count items that would be candidates for cleanup
 */
export async function GET() {
  const candidates = await prisma.mediaItem.count({
    where: {
      type: { in: ["MOVIE", "TV"] },
      officialRating: { notIn: VALID_CSA_RATINGS },
      streamingAvailability: { none: {} },
      originalLanguage: { not: "fr" },
    },
  })

  const total = await prisma.mediaItem.count({
    where: { type: { in: ["MOVIE", "TV"] } },
  })

  return NextResponse.json({
    candidates,
    total,
    pct: total > 0 ? Math.round((candidates / total) * 100) : 0,
    message: candidates > 0
      ? `${candidates} éléments sans pertinence française (${Math.round((candidates / total) * 100)}% du catalogue). POST pour lancer le nettoyage.`
      : "Tous les éléments sont pertinents pour le public français.",
  })
}
