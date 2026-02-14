import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import { seededShuffle, getWeekSeed } from "@/lib/seeded-shuffle"

/**
 * Get movies available on specific streaming platforms
 * Uses the StreamingAvailability table populated from TMDB/JustWatch
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const provider = searchParams.get("provider") // Netflix, Disney+, etc.
  const limit = parseInt(searchParams.get("limit") || "10")
  const maxAge = searchParams.get("maxAge")
  const type = searchParams.get("type") || "SUBSCRIPTION" // SUBSCRIPTION, RENT, BUY, FREE, ADS
  const shuffle = searchParams.get("shuffle") // "weekly" for week-seeded rotation

  if (!provider) {
    return NextResponse.json(
      { error: "provider parameter is required" },
      { status: 400 }
    )
  }

  try {
    // Build where clause for media items
    const mediaWhere: any = {
      type: "MOVIE",
      posterUrl: { not: null, startsWith: "http" },
    }

    if (maxAge) {
      mediaWhere.expertAgeRec = { lte: parseInt(maxAge), not: null }
    }

    // Find movies available on the specified streaming provider
    // Fetch extra to account for deduplication (same movie may have multiple provider variants)
    const useWeeklyShuffle = shuffle === "weekly"
    const fetchMultiplier = useWeeklyShuffle ? 5 : 3
    const streamingEntries = await withPrismaRetry(() =>
      prisma.streamingAvailability.findMany({
        where: {
          provider: { contains: provider, mode: "insensitive" },
          country: "FR",
          type: type as any,
          media: mediaWhere,
        },
        include: {
          media: {
            include: {
              contentMetrics: true,
            },
          },
        },
        take: limit * fetchMultiplier,
        orderBy: {
          lastChecked: "desc",
        },
      })
    )

    // Deduplicate by movie ID
    // (same movie can have multiple provider variants like "Netflix" and "Netflix Standard with Ads")
    const seenIds = new Set<string>()
    let dedupedEntries = streamingEntries.filter((entry) => {
      if (seenIds.has(entry.media.id)) return false
      seenIds.add(entry.media.id)
      return true
    })

    // Apply weekly shuffle for homepage rotation
    if (useWeeklyShuffle && dedupedEntries.length > limit) {
      dedupedEntries = seededShuffle(dedupedEntries, getWeekSeed())
    }

    const movies = dedupedEntries
      .slice(0, limit)
      .map((entry) => ({
        id: entry.media.id,
        tmdbId: entry.media.tmdbId,
        title: entry.media.title,
        originalTitle: entry.media.originalTitle,
        type: entry.media.type,
        synopsisFr: entry.media.synopsisFr,
        posterUrl: entry.media.posterUrl,
        backdropUrl: entry.media.backdropUrl,
        releaseDate: entry.media.releaseDate?.toISOString().split("T")[0] || null,
        expertAgeRec: entry.media.expertAgeRec,
        communityAgeRec: entry.media.communityAgeRec,
        genres: entry.media.genres,
        contentMetrics: entry.media.contentMetrics,
        streaming: {
          provider: entry.provider,
          type: entry.type,
          link: entry.link,
          lastChecked: entry.lastChecked,
        },
      }))

    // Get total count of unique movies for this provider
    let total = movies.length
    try {
      const uniqueMediaIds = await withPrismaRetry(() =>
        prisma.streamingAvailability.findMany({
          where: {
            provider: { contains: provider, mode: "insensitive" },
            country: "FR",
            type: type as any,
            media: mediaWhere,
          },
          select: { mediaId: true },
          distinct: ["mediaId"],
        })
      )
      total = uniqueMediaIds.length
    } catch (countError) {
      console.warn("Streaming distinct count failed, using fallback total:", countError)
      total = movies.length
    }

    return NextResponse.json({
      provider,
      movies,
      total,
      lastUpdated: streamingEntries[0]?.lastChecked || null,
    })
  } catch (error) {
    console.error("Streaming query error:", error)
    // Degraded mode: fallback to movie list so homepage section still renders.
    try {
      const fallbackMovies = await withPrismaRetry(() =>
        prisma.mediaItem.findMany({
          where: {
            type: "MOVIE",
            posterUrl: { not: null, startsWith: "http" },
            ...(maxAge ? { expertAgeRec: { lte: parseInt(maxAge), not: null } } : {}),
          },
          orderBy: { dataQualityScore: "desc" },
          take: limit,
        })
      )

      return NextResponse.json({
        provider,
        movies: fallbackMovies.map((movie) => ({
          id: movie.id,
          tmdbId: movie.tmdbId,
          title: movie.title,
          originalTitle: movie.originalTitle,
          type: movie.type,
          synopsisFr: movie.synopsisFr,
          posterUrl: movie.posterUrl,
          backdropUrl: movie.backdropUrl,
          releaseDate: movie.releaseDate?.toISOString().split("T")[0] || null,
          expertAgeRec: movie.expertAgeRec,
          communityAgeRec: movie.communityAgeRec,
          genres: movie.genres,
          contentMetrics: null,
          streaming: {
            provider,
            type,
            link: null,
            lastChecked: null,
          },
        })),
        total: fallbackMovies.length,
        lastUpdated: null,
        degraded: true,
      })
    } catch (fallbackError) {
      console.error("Streaming fallback failed:", fallbackError)
      return NextResponse.json(
        { error: "Failed to fetch streaming availability" },
        { status: 500 }
      )
    }
  }
}
