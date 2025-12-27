import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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
    // Get all media items with related data
    const mediaItems = await prisma.mediaItem.findMany({
      include: {
        contentMetrics: true,
        streamingAvailability: { take: 1 },
        credits: { take: 1 },
      },
    })

    let updated = 0
    const batchSize = 100

    // Process in batches
    for (let i = 0; i < mediaItems.length; i += batchSize) {
      const batch = mediaItems.slice(i, i + batchSize)

      await Promise.all(
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

          // Determine if enriched (has expert age rec AND content metrics)
          const isEnriched = item.expertAgeRec !== null && item.contentMetrics !== null

          // Only update if score changed
          if (item.dataQualityScore !== score || item.isEnriched !== isEnriched) {
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
        })
      )
    }

    return NextResponse.json({
      success: true,
      processed: mediaItems.length,
      updated,
    })
  } catch (error) {
    console.error("Quality compute error:", error)
    return NextResponse.json(
      { error: "Failed to compute quality scores" },
      { status: 500 }
    )
  }
}
