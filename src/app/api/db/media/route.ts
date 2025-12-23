import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

// Unified media endpoint - fetches all types with filtering
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "20")
  const type = searchParams.get("type") // MOVIE, TV, GAME, or null for all
  const minAge = searchParams.get("minAge")
  const maxAge = searchParams.get("maxAge")
  const genre = searchParams.get("genre")
  const search = searchParams.get("q")

  const skip = (page - 1) * limit

  try {
    const where: Prisma.MediaItemWhereInput = {}

    // Filter by type
    if (type && ["MOVIE", "TV", "GAME", "BOOK", "APP"].includes(type)) {
      where.type = type as "MOVIE" | "TV" | "GAME" | "BOOK" | "APP"
    }

    // Filter by age range (for age-based pages)
    if (minAge || maxAge) {
      const min = minAge ? parseInt(minAge) : 0
      const max = maxAge ? parseInt(maxAge) : 99

      // Only include items with expertAgeRec within the range
      where.expertAgeRec = {
        gte: min,
        lte: max,
      }
    }

    // Filter by genre
    if (genre) {
      where.genres = { has: genre }
    }

    // Search by title
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { originalTitle: { contains: search, mode: "insensitive" } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.mediaItem.findMany({
        where,
        orderBy: [
          { expertAgeRec: "asc" }, // Sort by age first
          { createdAt: "desc" },
        ],
        skip,
        take: limit,
        include: {
          contentMetrics: true,
        },
      }),
      prisma.mediaItem.count({ where }),
    ])

    // Transform to API format
    const transformedItems = items.map((item) => ({
      id: item.id,
      tmdbId: item.tmdbId,
      igdbId: item.igdbId,
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
      topics: item.topics,
      officialRating: item.officialRating,
      expertAgeRec: item.expertAgeRec,
      communityAgeRec: item.communityAgeRec,
      contentMetrics: item.contentMetrics,
    }))

    return NextResponse.json({
      items: transformedItems,
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
      { error: "Failed to fetch media from database" },
      { status: 500 }
    )
  }
}
