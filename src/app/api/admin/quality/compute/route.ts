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

    // Get batch of items - only select what we need
    const mediaItems = await prisma.mediaItem.findMany({
      skip: offset,
      take: limit,
      orderBy: { id: "asc" },
      select: {
        id: true,
        title: true,
        posterUrl: true,
        synopsisFr: true,
        releaseDate: true,
        genres: true,
        expertAgeRec: true,
        contentMetrics: { select: { id: true } },
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

    // Build all updates first, then execute in transaction
    const updates = mediaItems.map((item) => {
      let score = 0
      if (item.title && item.title.trim()) score += 10
      if (item.posterUrl) score += 10
      if (item.synopsisFr && item.synopsisFr.length > 50) score += 15
      else if (item.synopsisFr && item.synopsisFr.length > 0) score += 7
      if (item.releaseDate) score += 5
      if (item.genres && item.genres.length > 0) score += 10
      if (item.expertAgeRec !== null) score += 15
      if (item.contentMetrics) score += 15

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
