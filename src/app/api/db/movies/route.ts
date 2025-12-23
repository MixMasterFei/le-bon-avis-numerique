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
      type: "MOVIE",
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

    const [movies, total] = await Promise.all([
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
    const transformedMovies = movies.map((movie) => ({
      id: movie.id,
      tmdbId: movie.tmdbId,
      title: movie.title,
      originalTitle: movie.originalTitle,
      type: movie.type,
      synopsisFr: movie.synopsisFr,
      posterUrl: movie.posterUrl,
      backdropUrl: movie.backdropUrl,
      releaseDate: movie.releaseDate?.toISOString().split("T")[0] || null,
      duration: movie.duration,
      director: movie.director,
      genres: movie.genres,
      platforms: movie.platforms,
      officialRating: movie.officialRating,
      expertAgeRec: movie.expertAgeRec,
      communityAgeRec: movie.communityAgeRec,
      contentMetrics: movie.contentMetrics,
    }))

    return NextResponse.json({
      movies: transformedMovies,
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
      { error: "Failed to fetch movies from database" },
      { status: 500 }
    )
  }
}
