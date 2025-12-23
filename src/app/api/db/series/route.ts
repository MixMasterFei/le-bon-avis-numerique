import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "20")
  const maxAge = searchParams.get("maxAge")
  const genre = searchParams.get("genre")
  const search = searchParams.get("q")

  const skip = (page - 1) * limit

  try {
    const where: Prisma.MediaItemWhereInput = {
      type: "TV",
    }

    // Filter by age recommendation
    if (maxAge) {
      const age = parseInt(maxAge)
      where.OR = [
        { expertAgeRec: { lte: age } },
        { expertAgeRec: null },
      ]
    }

    // Filter by genre
    if (genre) {
      where.genres = { has: genre }
    }

    // Search by title
    if (search) {
      where.AND = [
        {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { originalTitle: { contains: search, mode: "insensitive" } },
          ],
        },
      ]
    }

    const [series, total] = await Promise.all([
      prisma.mediaItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          contentMetrics: true,
        },
      }),
      prisma.mediaItem.count({ where }),
    ])

    // Transform to API format
    const transformedSeries = series.map((item) => ({
      id: item.id,
      tmdbId: item.tmdbId,
      title: item.title,
      originalTitle: item.originalTitle,
      type: item.type,
      synopsisFr: item.synopsisFr,
      posterUrl: item.posterUrl,
      backdropUrl: item.backdropUrl,
      releaseDate: item.releaseDate?.toISOString().split("T")[0] || null,
      duration: item.duration,
      director: item.director,
      genres: item.genres,
      platforms: item.platforms,
      officialRating: item.officialRating,
      expertAgeRec: item.expertAgeRec,
      communityAgeRec: item.communityAgeRec,
      contentMetrics: item.contentMetrics,
    }))

    return NextResponse.json({
      series: transformedSeries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Database error:", error)
    return NextResponse.json(
      { error: "Failed to fetch series from database" },
      { status: 500 }
    )
  }
}
