import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Extend Vercel serverless timeout
export const maxDuration = 60 // seconds

/**
 * Compute data quality scores for all media items
 *
 * Quality score (0-100) is based on:
 * - Has title: +10
 * - Has poster: +10
 * - Has synopsis: +15
 * - Has release date: +5
 * - Has genres: +10
 * - Has expert age recommendation: +15
 * - Has content metrics: +15
 * - Has streaming availability: +10
 * - Has credits: +10
 */
export async function POST() {
  try {
    console.log("Starting quality score computation...")

    // Get all media items with related data
    const mediaItems = await prisma.mediaItem.findMany({
      include: {
        contentMetrics: true,
        streamingAvailability: { take: 1 },
        credits: { take: 1 },
      },
    })

    console.log(`Fetched ${mediaItems.length} media items`)

    let updated = 0
    let errors = 0
    const batchSize = 50 // Smaller batches for reliability
    const scoreDistribution: Record<number, number> = {}

    // Process in batches
    for (let i = 0; i < mediaItems.length; i += batchSize) {
      const batch = mediaItems.slice(i, i + batchSize)

      const results = await Promise.allSettled(
        batch.map(async (item) => {
          let score = 0

          // Has title (+10)
          if (item.title && item.title.trim()) score += 10

          // Has poster (+10)
          if (item.posterUrl) score += 10

          // Has synopsis (+15)
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

          // Has streaming availability (+10)
          if (item.streamingAvailability && item.streamingAvailability.length > 0) score += 10

          // Has credits (+10)
          if (item.credits && item.credits.length > 0) score += 10

          // Track score distribution
          scoreDistribution[score] = (scoreDistribution[score] || 0) + 1

          // Determine if enriched (has expert age rec AND content metrics)
          const isEnriched = item.expertAgeRec !== null && item.contentMetrics !== null

          // Always update to ensure scores are set (don't skip based on current value)
          await prisma.mediaItem.update({
            where: { id: item.id },
            data: {
              dataQualityScore: score,
              isEnriched,
              lastVerifiedAt: new Date(),
            },
          })

          return { score, isEnriched }
        })
      )

      // Count successes and failures
      for (const result of results) {
        if (result.status === "fulfilled") {
          updated++
        } else {
          errors++
          console.error("Update failed:", result.reason)
        }
      }

      // Log progress every 500 items
      if ((i + batchSize) % 500 === 0 || i + batchSize >= mediaItems.length) {
        console.log(`Progress: ${Math.min(i + batchSize, mediaItems.length)}/${mediaItems.length}`)
      }
    }

    console.log("Quality computation complete:", { updated, errors, scoreDistribution })

    return NextResponse.json({
      success: true,
      processed: mediaItems.length,
      updated,
      errors,
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
