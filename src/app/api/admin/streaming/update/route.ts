import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMovieWatchProviders, getTVWatchProviders } from "@/lib/tmdb"
import { extractProviders } from "@/lib/streaming-providers"
import { logCronRun } from "@/lib/cron-log"
import { syncPlatforms, clearPlatforms, touchStreamingChecked } from "@/lib/streaming-sync"

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
    } else {
      // Rotation pass: RE-verify existing assignments (a title that left
      // Netflix must lose its badge). Empty rows belong to the other pass.
      whereClause.platforms = { isEmpty: false }
    }

    // Least-recently-checked first, and every scanned row gets stamped below
    // — a stateless self-rotating queue. The old `createdAt desc` + offset
    // pagination re-scanned the same newest window on every Saturday run:
    // 6 consecutive runs logged "0 plateformes MAJ, 50 sans provider" while
    // rows carrying platforms went 4+ months unverified.
    //
    // streamingCheckedAt, NOT lastVerifiedAt: that other column gates the
    // weekly poster-refresh sweep (30 j) and the debt digest (90 j) — stamping
    // it here would defer poster checks and flatter the debt metric.
    const mediaItems = await prisma.mediaItem.findMany({
      where: whereClause,
      select: {
        id: true,
        tmdbId: true,
        title: true,
        type: true,
        platforms: true,
      },
      orderBy: { streamingCheckedAt: { sort: "asc", nulls: "first" } },
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
          await syncPlatforms(item.id, providers)
          stats.updated++
          stats.details.push(`${item.title}: ${providers.join(", ")}`)
        } else if (!onlyEmpty && item.platforms.length > 0) {
          // Successful fetch, zero FR providers: the title left streaming.
          // Keeping the stale badge is the exact failure this pass exists to
          // catch. (A TMDB error never lands here — it throws into the catch.)
          await clearPlatforms(item.id)
          stats.updated++
          stats.details.push(`${item.title}: plus aucune plateforme (retiré)`)
        } else {
          stats.noProviders++
          // Stamp anyway so the rotation moves past provider-less rows instead
          // of jamming on the same head window forever.
          await touchStreamingChecked(item.id)
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
