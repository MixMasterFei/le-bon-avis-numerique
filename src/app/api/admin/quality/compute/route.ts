import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Extend Vercel serverless timeout
export const maxDuration = 60 // seconds

/**
 * Compute data quality scores for media items
 * Processes in chunks to avoid timeout - call multiple times if needed
 *
 * Quality score (0-80) is based on:
 * - Has title: +10
 * - Has poster: +10
 * - Has synopsis (>50 chars): +15, (1-50 chars): +7
 * - Has release date: +5
 * - Has genres: +10
 * - Has expert age recommendation: +15
 * - Has content metrics: +15
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const limit = body.limit || 1000 // Process max 1000 items per call
    const offset = body.offset || 0

    console.log(`Starting quality score computation (offset: ${offset}, limit: ${limit})...`)

    // Get items that need updating (score is null or 0, or force refresh all)
    const mediaItems = await prisma.mediaItem.findMany({
      skip: offset,
      take: limit,
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

    console.log(`Fetched ${mediaItems.length} media items`)

    if (mediaItems.length === 0) {
      // Get final stats
      const stats = await prisma.mediaItem.groupBy({
        by: ["dataQualityScore"],
        _count: true,
      })

      const scoreDistribution: Record<number, number> = {}
      let total = 0
      for (const row of stats) {
        scoreDistribution[row.dataQualityScore ?? 0] = row._count
        total += row._count
      }

      return NextResponse.json({
        success: true,
        done: true,
        processed: 0,
        message: "All items already processed",
        scoreDistribution,
      })
    }

    const scoreDistribution: Record<number, number> = {}
    let updated = 0

    // Process in small batches
    const batchSize = 100
    for (let i = 0; i < mediaItems.length; i += batchSize) {
      const batch = mediaItems.slice(i, i + batchSize)

      // Process sequentially to avoid connection pool issues
      for (const item of batch) {
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

        await prisma.mediaItem.update({
          where: { id: item.id },
          data: {
            dataQualityScore: score,
            isEnriched,
            lastVerifiedAt: new Date(),
          },
        })
        updated++
      }

      console.log(`Progress: ${Math.min(i + batchSize, mediaItems.length)}/${mediaItems.length}`)
    }

    // Check if there are more items
    const remaining = await prisma.mediaItem.count({
      where: { id: { notIn: mediaItems.map(m => m.id) } },
    })

    const hasMore = remaining > 0 && mediaItems.length === limit

    return NextResponse.json({
      success: true,
      done: !hasMore,
      processed: updated,
      nextOffset: hasMore ? offset + limit : null,
      remaining: hasMore ? remaining : 0,
      scoreDistribution,
    })
  } catch (error) {
    console.error("Quality compute error:", error)
    return NextResponse.json(
      {
        error: "Failed to compute quality scores",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
