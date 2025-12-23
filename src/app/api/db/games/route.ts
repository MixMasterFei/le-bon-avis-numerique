import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "20")
  const maxAge = searchParams.get("maxAge")
  const platform = searchParams.get("platform")
  const search = searchParams.get("q")

  const skip = (page - 1) * limit

  try {
    const where: Prisma.MediaItemWhereInput = {
      type: "GAME",
    }

    // Filter by age recommendation
    if (maxAge) {
      const age = parseInt(maxAge)
      where.OR = [
        { expertAgeRec: { lte: age } },
        { expertAgeRec: null },
      ]
    }

    // Filter by platform
    if (platform) {
      where.platforms = { has: platform }
    }

    // Search by title
    if (search) {
      where.AND = [
        {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
          ],
        },
      ]
    }

    const [games, total] = await Promise.all([
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
    const transformedGames = games.map((game) => ({
      id: game.id,
      igdbId: game.igdbId,
      title: game.title,
      type: game.type,
      synopsisFr: game.synopsisFr,
      posterUrl: game.posterUrl,
      releaseDate: game.releaseDate?.toISOString().split("T")[0] || null,
      genres: game.genres,
      platforms: game.platforms,
      officialRating: game.officialRating,
      expertAgeRec: game.expertAgeRec,
      communityAgeRec: game.communityAgeRec,
      developer: game.director, // We stored developer in director field
      topics: game.topics,
      contentMetrics: game.contentMetrics,
    }))

    return NextResponse.json({
      games: transformedGames,
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
      { error: "Failed to fetch games from database" },
      { status: 500 }
    )
  }
}
