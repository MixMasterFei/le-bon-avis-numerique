import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logCronRun } from "@/lib/cron-log"

// Extend Vercel serverless timeout
export const maxDuration = 60 // seconds

/**
 * Compute data quality scores for media items
 * Processes in small chunks to avoid timeout
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  try {
    const body = await request.json().catch(() => ({}))
    const limit = body.limit || 200 // Small batch to fit in timeout
    const offset = body.offset || 0

    console.log(`Quality compute: offset=${offset}, limit=${limit}`)

    // Get total count first
    const totalCount = await prisma.mediaItem.count()

    // Get batch of items - select all fields needed for scoring
    const mediaItems = await prisma.mediaItem.findMany({
      skip: offset,
      take: limit,
      orderBy: { id: "asc" },
      select: {
        id: true,
        title: true,
        posterUrl: true,
        backdropUrl: true,
        synopsisFr: true,
        releaseDate: true,
        genres: true,
        officialRating: true,
        expertAgeRec: true,
        director: true,
        originalLanguage: true,
        contentMetrics: { select: { id: true } },
        screenshots: { select: { id: true }, take: 1 },
        streamingAvailability: { select: { id: true }, take: 1 },
      },
    })

    if (mediaItems.length === 0) {
      return NextResponse.json({
        success: true,
        done: true,
        processed: 0,
        total: totalCount,
      })
    }

    const scoreDistribution: Record<number, number> = {}
    const now = new Date()

    // Quality score formula — max 100 points
    // Essential fields (60 pts): title, poster, synopsis, rating, age rec, genres
    // Enrichment fields (25 pts): content metrics, screenshots, streaming
    // Bonus fields (15 pts): backdrop, director, language, release date
    const updates = mediaItems.map((item) => {
      let score = 0

      // Essential (60 pts)
      if (item.title && item.title.trim()) score += 5
      if (item.posterUrl) score += 10
      if (item.synopsisFr && item.synopsisFr.length > 50) score += 15
      else if (item.synopsisFr && item.synopsisFr.length > 0) score += 7
      if (item.officialRating) score += 10
      if (item.expertAgeRec !== null) score += 10
      if (item.genres && item.genres.length > 0) score += 10

      // Enrichment (25 pts)
      if (item.contentMetrics) score += 10
      if (item.screenshots.length > 0) score += 10
      if (item.streamingAvailability.length > 0) score += 5

      // Bonus (15 pts)
      if (item.backdropUrl) score += 5
      if (item.director) score += 3
      if (item.originalLanguage) score += 3
      if (item.releaseDate) score += 4

      scoreDistribution[score] = (scoreDistribution[score] || 0) + 1
      const isEnriched = item.expertAgeRec !== null && item.contentMetrics !== null

      return prisma.mediaItem.update({
        where: { id: item.id },
        data: { dataQualityScore: score, isEnriched, lastVerifiedAt: now },
      })
    })

    // Execute all updates in a single transaction
    await prisma.$transaction(updates)

    const hasMore = offset + mediaItems.length < totalCount

    // Log only on the last batch (when done)
    if (!hasMore) {
      await logCronRun({
        task: "quality",
        status: "success",
        summary: `Scores recalcules pour ${offset + mediaItems.length} items`,
        details: { total: totalCount, scoreDistribution },
        startTime,
      })
    }

    return NextResponse.json({
      success: true,
      done: !hasMore,
      processed: mediaItems.length,
      nextOffset: hasMore ? offset + limit : null,
      total: totalCount,
      progress: `${offset + mediaItems.length}/${totalCount}`,
      scoreDistribution,
    })
  } catch (error) {
    console.error("Quality compute error:", error)

    await logCronRun({
      task: "quality",
      status: "error",
      summary: error instanceof Error ? error.message : "Quality compute failed",
      startTime,
    })

    return NextResponse.json(
      {
        error: "Failed to compute quality scores",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
