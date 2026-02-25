import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const maxDuration = 60

export async function GET() {
  try {
    const movieTvFilter = { type: { in: ["MOVIE", "TV"] as ("MOVIE" | "TV")[] } }

    // Valid internal certification values (French CSA + PEGI for games)
    const validRatings = [
      "TOUS_PUBLICS", "CSA_10", "CSA_12", "CSA_16", "CSA_18",
      "PEGI_3", "PEGI_7", "PEGI_12", "PEGI_16", "PEGI_18",
    ]

    const [
      total,
      withAgeRec,
      withScreenshots,
      withMetrics,
      withStreaming,
      avgQuality,
    ] = await Promise.all([
      prisma.mediaItem.count({ where: movieTvFilter }),
      prisma.mediaItem.count({
        where: { ...movieTvFilter, expertAgeRec: { not: null } },
      }),
      prisma.mediaItem.count({
        where: { ...movieTvFilter, screenshots: { some: {} } },
      }),
      prisma.mediaItem.count({
        where: { ...movieTvFilter, contentMetrics: { isNot: null } },
      }),
      prisma.mediaItem.count({
        where: { ...movieTvFilter, streamingAvailability: { some: {} } },
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
      ratings: { count: withAgeRec, pct: pct(withAgeRec) },
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
