import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const [
      movieCount,
      gameCount,
      tvCount,
      bookCount,
      reviewCount,
      recentMovies,
      recentGames,
      moviesWithAgeRec,
      gamesWithAgeRec,
      // Data quality metrics
      enrichedCount,
      highQualityCount,
      mediumQualityCount,
      lowQualityCount,
      withStreamingCount,
      withCreditsCount,
      avgQualityScore,
    ] = await Promise.all([
      prisma.mediaItem.count({ where: { type: "MOVIE" } }),
      prisma.mediaItem.count({ where: { type: "GAME" } }),
      prisma.mediaItem.count({ where: { type: "TV" } }),
      prisma.mediaItem.count({ where: { type: "BOOK" } }),
      prisma.review.count(),
      prisma.mediaItem.findMany({
        where: { type: "MOVIE" },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          title: true,
          posterUrl: true,
          expertAgeRec: true,
          tmdbId: true,
        },
      }),
      prisma.mediaItem.findMany({
        where: { type: "GAME" },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          title: true,
          posterUrl: true,
          expertAgeRec: true,
          igdbId: true,
        },
      }),
      prisma.mediaItem.count({
        where: { type: "MOVIE", expertAgeRec: { not: null } },
      }),
      prisma.mediaItem.count({
        where: { type: "GAME", expertAgeRec: { not: null } },
      }),
      // Enriched items (has expert content)
      prisma.mediaItem.count({
        where: { isEnriched: true },
      }),
      // High quality (score >= 70)
      prisma.mediaItem.count({
        where: { dataQualityScore: { gte: 70 } },
      }),
      // Medium quality (30-69)
      prisma.mediaItem.count({
        where: { dataQualityScore: { gte: 30, lt: 70 } },
      }),
      // Low quality (< 30)
      prisma.mediaItem.count({
        where: { dataQualityScore: { lt: 30 } },
      }),
      // Items with streaming availability
      prisma.mediaItem.count({
        where: {
          streamingAvailability: { some: {} },
        },
      }),
      // Items with credits
      prisma.mediaItem.count({
        where: {
          credits: { some: {} },
        },
      }),
      // Average quality score
      prisma.mediaItem.aggregate({
        _avg: { dataQualityScore: true },
      }),
    ])

    const total = movieCount + gameCount + tvCount + bookCount

    return NextResponse.json({
      counts: {
        movies: movieCount,
        games: gameCount,
        tv: tvCount,
        books: bookCount,
        reviews: reviewCount,
        total,
      },
      coverage: {
        moviesWithAgeRec,
        gamesWithAgeRec,
        moviesPercent: movieCount > 0 ? Math.round((moviesWithAgeRec / movieCount) * 100) : 0,
        gamesPercent: gameCount > 0 ? Math.round((gamesWithAgeRec / gameCount) * 100) : 0,
      },
      quality: {
        enriched: enrichedCount,
        enrichedPercent: total > 0 ? Math.round((enrichedCount / total) * 100) : 0,
        highQuality: highQualityCount,
        mediumQuality: mediumQualityCount,
        lowQuality: lowQualityCount,
        avgScore: Math.round(avgQualityScore._avg.dataQualityScore || 0),
        withStreaming: withStreamingCount,
        withCredits: withCreditsCount,
      },
      recent: {
        movies: recentMovies,
        games: recentGames,
      },
    })
  } catch (error) {
    console.error("Stats error:", error)
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    )
  }
}
