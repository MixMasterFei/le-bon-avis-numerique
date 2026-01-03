import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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
    const streamingEntries = await prisma.streamingAvailability.findMany({
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
      take: limit,
      orderBy: {
        lastChecked: "desc",
      },
    })

    // Transform results
    const movies = streamingEntries.map((entry) => ({
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

    // Get total count for this provider
    const total = await prisma.streamingAvailability.count({
      where: {
        provider: { contains: provider, mode: "insensitive" },
        country: "FR",
        type: type as any,
        media: mediaWhere,
      },
    })

    return NextResponse.json({
      provider,
      movies,
      total,
      lastUpdated: streamingEntries[0]?.lastChecked || null,
    })
  } catch (error) {
    console.error("Streaming query error:", error)
    return NextResponse.json(
      { error: "Failed to fetch streaming availability" },
      { status: 500 }
    )
  }
}
