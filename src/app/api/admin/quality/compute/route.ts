import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logCronRun } from "@/lib/cron-log"
import { computeQuality, qualityUpdateFor } from "@/lib/quality-score"

// Extend Vercel serverless timeout
export const maxDuration = 60 // seconds

const DEFAULT_LIMIT = 200
const MAX_LIMIT = 500

function nonNegativeInt(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value
  return typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : null
}

/**
 * Compute data quality scores for media items.
 * Processes in small chunks to avoid timeout; callers loop on `nextOffset`.
 *
 * Writes ONLY the rows whose score or isEnriched flag actually changes. It
 * used to rewrite every row (and stamp lastVerifiedAt) on every run, which —
 * through Prisma's @updatedAt — marked all ~12 000 fiches as "updated today"
 * every night. See src/lib/quality-score.ts.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  try {
    const body = await request.json().catch(() => ({}))
    // The admin UI pages with ?offset= (useOperation getNextParams); the cron
    // loop sends it in the body. The query string wins when both are present.
    const url = new URL(request.url)
    const offset = nonNegativeInt(url.searchParams.get("offset")) ?? nonNegativeInt(body.offset) ?? 0
    const limit = Math.min(nonNegativeInt(body.limit) || DEFAULT_LIMIT, MAX_LIMIT)
    // Running total carried across batches by the cron loop, so the final log
    // can say how many rows the whole run really rewrote.
    const updatedSoFar = nonNegativeInt(body.updatedSoFar) ?? 0

    console.log(`Quality compute: offset=${offset}, limit=${limit}`)

    // Get total count first
    const totalCount = await prisma.mediaItem.count()

    // Get batch of items - select all fields needed for scoring + the stored values
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
        dataQualityScore: true,
        isEnriched: true,
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
        updated: 0,
        updatedTotal: updatedSoFar,
        total: totalCount,
      })
    }

    const scoreDistribution: Record<number, number> = {}
    const updates = []

    for (const item of mediaItems) {
      const computed = computeQuality({
        title: item.title,
        posterUrl: item.posterUrl,
        backdropUrl: item.backdropUrl,
        synopsisFr: item.synopsisFr,
        releaseDate: item.releaseDate,
        genres: item.genres,
        officialRating: item.officialRating,
        expertAgeRec: item.expertAgeRec,
        director: item.director,
        originalLanguage: item.originalLanguage,
        hasContentMetrics: item.contentMetrics !== null,
        hasScreenshots: item.screenshots.length > 0,
        hasStreaming: item.streamingAvailability.length > 0,
      })
      scoreDistribution[computed.dataQualityScore] = (scoreDistribution[computed.dataQualityScore] || 0) + 1

      const patch = qualityUpdateFor(item, computed)
      if (patch) {
        updates.push(prisma.mediaItem.update({ where: { id: item.id }, data: patch }))
      }
    }

    // Only the rows that changed, in a single transaction.
    if (updates.length > 0) {
      await prisma.$transaction(updates)
    }

    const updated = updates.length
    const updatedTotal = updatedSoFar + updated
    const hasMore = offset + mediaItems.length < totalCount

    // Log only on the last batch (when done)
    if (!hasMore) {
      await logCronRun({
        task: "quality",
        status: "success",
        summary: `Scores recalcules pour ${offset + mediaItems.length} items (${updatedTotal} modifies)`,
        details: { total: totalCount, updatedTotal, scoreDistribution },
        startTime,
      })
    }

    return NextResponse.json({
      success: true,
      done: !hasMore,
      processed: mediaItems.length,
      updated,
      unchanged: mediaItems.length - updated,
      updatedTotal,
      nextOffset: hasMore ? offset + mediaItems.length : null,
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
