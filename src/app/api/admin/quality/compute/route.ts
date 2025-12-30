import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Extend Vercel serverless timeout
export const maxDuration = 60 // seconds

/**
 * Compute data quality scores for all media items using raw SQL for speed
 *
 * Quality score (0-100) is based on:
 * - Has title: +10
 * - Has poster: +10
 * - Has synopsis (>50 chars): +15, (1-50 chars): +7
 * - Has release date: +5
 * - Has genres: +10
 * - Has expert age recommendation: +15
 * - Has content metrics: +15
 * - Has streaming availability: +10
 * - Has credits: +10
 */
export async function POST() {
  try {
    console.log("Starting quality score computation with raw SQL...")

    // Use raw SQL for much faster bulk update
    const result = await prisma.$executeRaw`
      UPDATE "MediaItem"
      SET
        "data_quality_score" = (
          CASE WHEN title IS NOT NULL AND title != '' THEN 10 ELSE 0 END +
          CASE WHEN poster_url IS NOT NULL THEN 10 ELSE 0 END +
          CASE WHEN synopsis_fr IS NOT NULL AND LENGTH(synopsis_fr) > 50 THEN 15
               WHEN synopsis_fr IS NOT NULL AND LENGTH(synopsis_fr) > 0 THEN 7
               ELSE 0 END +
          CASE WHEN release_date IS NOT NULL THEN 5 ELSE 0 END +
          CASE WHEN genres IS NOT NULL AND array_length(genres, 1) > 0 THEN 10 ELSE 0 END +
          CASE WHEN expert_age_rec IS NOT NULL THEN 15 ELSE 0 END +
          CASE WHEN EXISTS (SELECT 1 FROM "ContentMetrics" cm WHERE cm."media_item_id" = "MediaItem".id) THEN 15 ELSE 0 END +
          CASE WHEN EXISTS (SELECT 1 FROM "StreamingAvailability" sa WHERE sa."media_item_id" = "MediaItem".id) THEN 10 ELSE 0 END +
          CASE WHEN EXISTS (SELECT 1 FROM "Credit" c WHERE c."media_item_id" = "MediaItem".id) THEN 10 ELSE 0 END
        ),
        "is_enriched" = (
          expert_age_rec IS NOT NULL AND
          EXISTS (SELECT 1 FROM "ContentMetrics" cm WHERE cm."media_item_id" = "MediaItem".id)
        ),
        "last_verified_at" = NOW()
    `

    console.log(`Updated ${result} media items`)

    // Get the score distribution for reporting
    const distribution = await prisma.$queryRaw<Array<{ score: number; count: bigint }>>`
      SELECT "data_quality_score" as score, COUNT(*) as count
      FROM "MediaItem"
      GROUP BY "data_quality_score"
      ORDER BY "data_quality_score"
    `

    const scoreDistribution: Record<number, number> = {}
    for (const row of distribution) {
      scoreDistribution[row.score ?? 0] = Number(row.count)
    }

    // Get summary stats
    const stats = await prisma.$queryRaw<Array<{ total: bigint; high: bigint; medium: bigint; low: bigint; avg: number }>>`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE "data_quality_score" >= 70) as high,
        COUNT(*) FILTER (WHERE "data_quality_score" >= 30 AND "data_quality_score" < 70) as medium,
        COUNT(*) FILTER (WHERE "data_quality_score" < 30) as low,
        ROUND(AVG("data_quality_score")::numeric, 1) as avg
      FROM "MediaItem"
    `

    const summary = stats[0]

    return NextResponse.json({
      success: true,
      processed: Number(summary.total),
      updated: result,
      errors: 0,
      scoreDistribution,
      summary: {
        total: Number(summary.total),
        highQuality: Number(summary.high),
        mediumQuality: Number(summary.medium),
        lowQuality: Number(summary.low),
        avgScore: summary.avg,
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
