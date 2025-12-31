import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const maxDuration = 60

// Backfill originalLanguage for existing records from TMDB
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type = "all", limit = 50, offset = 0 } = body

    // Find records missing originalLanguage
    const whereClause: any = {
      originalLanguage: null,
      tmdbId: { not: null },
    }

    if (type === "MOVIE") {
      whereClause.type = "MOVIE"
    } else if (type === "TV") {
      whereClause.type = "TV"
    }

    const items = await prisma.mediaItem.findMany({
      where: whereClause,
      select: { id: true, tmdbId: true, type: true, title: true },
      skip: offset,
      take: limit,
      orderBy: { createdAt: "desc" },
    })

    const totalMissing = await prisma.mediaItem.count({ where: whereClause })

    if (items.length === 0) {
      return NextResponse.json({
        success: true,
        done: true,
        message: "All records have originalLanguage",
        processed: 0,
        remaining: 0,
      })
    }

    let processed = 0
    let errors = 0
    const details: string[] = []

    for (const item of items) {
      try {
        // Fetch from TMDB using api_key query parameter (v3 API)
        const baseEndpoint = item.type === "MOVIE"
          ? `https://api.themoviedb.org/3/movie/${item.tmdbId}`
          : `https://api.themoviedb.org/3/tv/${item.tmdbId}`

        const endpoint = `${baseEndpoint}?api_key=${process.env.TMDB_API_KEY}`

        const res = await fetch(endpoint)

        if (res.ok) {
          const data = await res.json()
          const originalLanguage = data.original_language

          if (originalLanguage) {
            await prisma.mediaItem.update({
              where: { id: item.id },
              data: { originalLanguage },
            })
            processed++
            details.push(`${item.title}: ${originalLanguage}`)
          }
        } else {
          errors++
          details.push(`${item.title}: TMDB error ${res.status}`)
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        errors++
        details.push(`${item.title}: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }

    return NextResponse.json({
      success: true,
      done: items.length < limit,
      processed,
      errors,
      remaining: totalMissing - processed,
      nextOffset: offset + limit,
      details: details.slice(0, 20), // First 20 details
    })
  } catch (error) {
    console.error("Backfill error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Backfill failed",
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Get count of records missing originalLanguage
  const counts = await prisma.mediaItem.groupBy({
    by: ["type"],
    where: {
      originalLanguage: null,
      tmdbId: { not: null },
    },
    _count: true,
  })

  const languageDistribution = await prisma.mediaItem.groupBy({
    by: ["originalLanguage"],
    where: {
      originalLanguage: { not: null },
    },
    _count: true,
    orderBy: {
      _count: {
        originalLanguage: "desc",
      },
    },
    take: 20,
  })

  return NextResponse.json({
    missingByType: counts.reduce((acc, c) => {
      acc[c.type] = c._count
      return acc
    }, {} as Record<string, number>),
    languageDistribution: languageDistribution.map(l => ({
      language: l.originalLanguage,
      count: l._count,
    })),
  })
}
