import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMovieWatchProviders, getTVWatchProviders } from "@/lib/tmdb"
import { logCronRun } from "@/lib/cron-log"

export const maxDuration = 60 // seconds

// Map TMDB provider names to our simplified names
const PROVIDER_NAME_MAP: Record<string, string> = {
  "Netflix": "Netflix",
  "Netflix basic with Ads": "Netflix",
  "Amazon Prime Video": "Prime Video",
  "Disney Plus": "Disney+",
  "Canal+": "Canal+",
  "Canal+ Cinema": "Canal+",
  "myCANAL": "Canal+",
  "Apple TV Plus": "Apple TV+",
  "Apple TV": "Apple TV+",
  "France TV": "France TV",
  "france.tv": "France TV",
  "Arte": "Arte",
  "ARTE": "Arte",
  "OCS Go": "OCS",
  "OCS": "OCS",
  "Paramount Plus": "Paramount+",
  "Paramount+ Amazon Channel": "Paramount+",
  "Max": "Max",
  "Max Amazon Channel": "Max",
  "Crunchyroll": "Crunchyroll",
  "ADN": "ADN",
  "Anime Digital Network": "ADN",
  "Salto": "Salto",
  "YouTube Premium": "YouTube",
  "Google Play Movies": "Google Play",
  "Microsoft Store": "Microsoft",
}

// Providers we care about (French market)
const RELEVANT_PROVIDERS = new Set([
  "Netflix",
  "Prime Video",
  "Disney+",
  "Canal+",
  "Apple TV+",
  "France TV",
  "Arte",
  "OCS",
  "Paramount+",
  "Max",
  "Crunchyroll",
  "ADN",
])

function normalizeProviderName(name: string): string | null {
  // Check direct mapping
  if (PROVIDER_NAME_MAP[name]) {
    return PROVIDER_NAME_MAP[name]
  }
  // Check if it's already a relevant provider
  if (RELEVANT_PROVIDERS.has(name)) {
    return name
  }
  return null
}

function extractProviders(watchData: Awaited<ReturnType<typeof getMovieWatchProviders>>): string[] {
  if (!watchData) return []

  const providers = new Set<string>()

  // Flatrate = subscription services (Netflix, Disney+, etc.)
  if (watchData.flatrate) {
    for (const provider of watchData.flatrate) {
      const normalized = normalizeProviderName(provider.provider_name)
      if (normalized) providers.add(normalized)
    }
  }

  // Also include free streaming
  if (watchData.free) {
    for (const provider of watchData.free) {
      const normalized = normalizeProviderName(provider.provider_name)
      if (normalized) providers.add(normalized)
    }
  }

  return Array.from(providers)
}

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
