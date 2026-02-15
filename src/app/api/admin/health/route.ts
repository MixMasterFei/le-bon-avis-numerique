import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const maxDuration = 60

export async function GET() {
  try {
    const movieTvFilter = { type: { in: ["MOVIE", "TV"] as ("MOVIE" | "TV")[] } }

    const [
      total,
      withRating,
      withScreenshots,
      withMetrics,
      withStreaming,
      avgQuality,
    ] = await Promise.all([
      prisma.mediaItem.count({ where: movieTvFilter }),
      prisma.mediaItem.count({
        where: { ...movieTvFilter, officialRating: { not: null } },
      }),
      prisma.mediaItem.count({
        where: { screenshots: { some: {} } },
      }),
      prisma.mediaItem.count({
        where: { contentMetrics: { isNot: null } },
      }),
      prisma.mediaItem.count({
        where: { streamingAvailability: { some: {} } },
      }),
      prisma.mediaItem.aggregate({
        _avg: { dataQualityScore: true },
        where: movieTvFilter,
      }),
    ])

    const pct = (count: number) =>
      total > 0 ? Math.round((count / total) * 100) : 0

    return NextResponse.json({
      total,
      ratings: { count: withRating, pct: pct(withRating) },
      screenshots: { count: withScreenshots, pct: pct(withScreenshots) },
      enriched: { count: withMetrics, pct: pct(withMetrics) },
      streaming: { count: withStreaming, pct: pct(withStreaming) },
      quality: { avg: Math.round(avgQuality._avg.dataQualityScore || 0) },
    })
  } catch (error) {
    console.error("Health check error:", error)
    return NextResponse.json(
      { error: "Failed to fetch health data" },
      { status: 500 }
    )
  }
}
