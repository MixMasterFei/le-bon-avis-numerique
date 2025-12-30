import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Extend Vercel serverless timeout
export const maxDuration = 60 // seconds

/**
 * Compute data quality scores for all media items
 * Uses batched Prisma updates for compatibility with PgBouncer
 *
 * Quality score (0-100) is based on:
 * - Has title: +10
 * - Has poster: +10
 * - Has synopsis (>50 chars): +15, (1-50 chars): +7
 * - Has release date: +5
 * - Has genres: +10
 * - Has expert age recommendation: +15
 * - Has content metrics: +15
 */
export async function POST() {
  try {
    console.log("Starting quality score computation...")

    // Get all media items with content metrics (simplified - no streaming/credits for speed)
    const mediaItems = await prisma.mediaItem.findMany({
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

    const scoreDistribution: Record<number, number> = {}
    let updated = 0

    // Process in larger batches using transaction
    const batchSize = 500
    for (let i = 0; i < mediaItems.length; i += batchSize) {
      const batch = mediaItems.slice(i, i + batchSize)

      // Build batch update operations
      const updates = batch.map((item) => {
        let score = 0

        // Has title (+10)
        if (item.title && item.title.trim()) score += 10

        // Has poster (+10)
        if (item.posterUrl) score += 10

        // Has synopsis (+15 or +7)
        if (item.synopsisFr && item.synopsisFr.length > 50) score += 15
        else if (item.synopsisFr && item.synopsisFr.length > 0) score += 7

        // Has release date (+5)
        if (item.releaseDate) score += 5

        // Has genres (+10)
        if (item.genres && item.genres.length > 0) score += 10

        // Has expert age recommendation (+15)
        if (item.expertAgeRec !== null) score += 15

        // Has content metrics (+15)
        if (item.contentMetrics) score += 15

        // Track distribution
        scoreDistribution[score] = (scoreDistribution[score] || 0) + 1

        const isEnriched = item.expertAgeRec !== null && item.contentMetrics !== null

        return prisma.mediaItem.update({
          where: { id: item.id },
          data: {
            dataQualityScore: score,
            isEnriched,
            lastVerifiedAt: new Date(),
          },
        })
      })

      // Execute batch in transaction
      await prisma.$transaction(updates)
      updated += batch.length

      console.log(`Progress: ${Math.min(i + batchSize, mediaItems.length)}/${mediaItems.length}`)
    }

    // Calculate summary
    const total = mediaItems.length
    const highQuality = Object.entries(scoreDistribution)
      .filter(([score]) => Number(score) >= 70)
      .reduce((sum, [, count]) => sum + count, 0)
    const mediumQuality = Object.entries(scoreDistribution)
      .filter(([score]) => Number(score) >= 30 && Number(score) < 70)
      .reduce((sum, [, count]) => sum + count, 0)
    const lowQuality = Object.entries(scoreDistribution)
      .filter(([score]) => Number(score) < 30)
      .reduce((sum, [, count]) => sum + count, 0)
    const avgScore = Math.round(
      Object.entries(scoreDistribution).reduce(
        (sum, [score, count]) => sum + Number(score) * count,
        0
      ) / total
    )

    console.log("Quality computation complete:", { updated, scoreDistribution })

    return NextResponse.json({
      success: true,
      processed: total,
      updated,
      errors: 0,
      scoreDistribution,
      summary: {
        total,
        highQuality,
        mediumQuality,
        lowQuality,
        avgScore,
      },
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
