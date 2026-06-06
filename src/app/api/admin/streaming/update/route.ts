import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMovieWatchProviders, getTVWatchProviders } from "@/lib/tmdb"
import { extractProviders } from "@/lib/streaming-providers"
import { logCronRun } from "@/lib/cron-log"

export const maxDuration = 60 // seconds

// POST /api/admin/streaming/update - Update streaming platforms for movies
export async function POST(request: Request) {
  const startTime = Date.now()
  try {
    const body = await request.json()
    const {
      limit = 50, // How many movies to update per request
      offset = 0, // Skip this many movies (for pagination)
      onlyEmpty = true, // Only update movies with no platforms
      mediaType = "MOVIE", // MOVIE or TV
    } = body

    // Build query
    const whereClause: Record<string, unknown> = {
      type: mediaType,
      tmdbId: { not: null },
    }

    if (onlyEmpty) {
      whereClause.platforms = { isEmpty: true }
    }

    // Get movies that need updating
    const mediaItems = await prisma.mediaItem.findMany({
      where: whereClause,
      select: {
        id: true,
        tmdbId: true,
        title: true,
        type: true,
        platforms: true,
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    })

    const stats = {
      total: mediaItems.length,
      updated: 0,
      noProviders: 0,
      errors: 0,
      details: [] as string[],
    }

    for (const item of mediaItems) {
      try {
        // Fetch watch providers from TMDB (which uses JustWatch data)
        const watchData = item.type === "MOVIE"
          ? await getMovieWatchProviders(item.tmdbId!)
          : await getTVWatchProviders(item.tmdbId!)

        const providers = extractProviders(watchData)

        if (providers.length > 0) {
          await prisma.mediaItem.update({
            where: { id: item.id },
            data: { platforms: providers },
          })
          stats.updated++
          stats.details.push(`${item.title}: ${providers.join(", ")}`)
        } else {
          stats.noProviders++
        }

        // Small delay to respect TMDB rate limits
        await new Promise(resolve => setTimeout(resolve, 150))
      } catch (error) {
        stats.errors++
        stats.details.push(`Error for ${item.title}: ${error instanceof Error ? error.message : "Unknown"}`)
      }
    }

    // Get total count for pagination info
    const totalCount = await prisma.mediaItem.count({ where: whereClause })

    await logCronRun({
      task: "streaming",
      status: stats.errors > 0 ? "partial" : "success",
      summary: `${stats.updated} plateformes MAJ (${mediaType}), ${stats.noProviders} sans provider`,
      details: { ...stats, mediaType, offset },
      startTime,
    })

    return NextResponse.json({
      success: true,
      stats,
      pagination: {
        total: totalCount,
        processed: offset + mediaItems.length,
        hasMore: offset + mediaItems.length < totalCount,
        nextOffset: offset + limit,
      },
    })
  } catch (error) {
    console.error("Streaming update error:", error)

    await logCronRun({
      task: "streaming",
      status: "error",
      summary: error instanceof Error ? error.message : "Streaming update failed",
      startTime,
    })

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    )
  }
}

// GET /api/admin/streaming/update - Get stats on platforms
export async function GET() {
  const stats = await prisma.mediaItem.groupBy({
    by: ["type"],
    _count: true,
  })

  const withPlatforms = await prisma.mediaItem.count({
    where: {
      platforms: { isEmpty: false },
    },
  })

  const withoutPlatforms = await prisma.mediaItem.count({
    where: {
      platforms: { isEmpty: true },
      tmdbId: { not: null },
    },
  })

  // Get platform distribution
  const allMedia = await prisma.mediaItem.findMany({
    where: { platforms: { isEmpty: false } },
    select: { platforms: true },
  })

  const platformCounts: Record<string, number> = {}
  for (const item of allMedia) {
    for (const platform of item.platforms) {
      platformCounts[platform] = (platformCounts[platform] || 0) + 1
    }
  }

  return NextResponse.json({
    stats,
    withPlatforms,
    withoutPlatforms,
    platformDistribution: Object.entries(platformCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([platform, count]) => ({ platform, count })),
  })
}
