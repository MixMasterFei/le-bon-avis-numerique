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
  const sortBy = searchParams.get("sortBy") || "createdAt" // createdAt, releaseDate, quality, title
  const requirePoster = searchParams.get("requirePoster") === "true"
  const minQuality = searchParams.get("minQuality")
  const featured = searchParams.get("featured") === "true" // Get featured/popular series
  const language = searchParams.get("language") // Filter by original language (fr, en, etc.)
  const frenchOnly = searchParams.get("frenchOnly") === "true" // Only show French content

  const skip = (page - 1) * limit

  try {
    const where: Prisma.MediaItemWhereInput = {
      type: "TV",
    }

    // Require poster for featured sections
    if (requirePoster || featured) {
      where.AND = [
        ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
        { posterUrl: { not: null } },
        { posterUrl: { not: "" } },
        { posterUrl: { startsWith: "http" } },
      ]
    }

    // Minimum quality score filter
    if (minQuality) {
      where.dataQualityScore = { gte: parseInt(minQuality) }
    }

    // Featured series: high quality, with poster, prioritize French/English content
    if (featured) {
      where.dataQualityScore = { gte: 50 }
      // For featured, only show content relevant to French audience (French or English)
      where.AND = [
        ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
        { originalLanguage: { in: ["fr", "en"] } },
      ]
    }

    // Filter by specific language (supports comma-separated for multiple languages)
    if (language) {
      const languages = language.split(",").map(l => l.trim())
      if (languages.length === 1) {
        where.originalLanguage = languages[0]
      } else {
        where.AND = [
          ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
          { originalLanguage: { in: languages } },
        ]
      }
    }

    // Only French content
    if (frenchOnly) {
      where.originalLanguage = "fr"
    }

    // Filter by age recommendation
    if (maxAge) {
      const age = parseInt(maxAge)
      where.expertAgeRec = { lte: age, not: null }
    }

    // Filter by genre
    if (genre) {
      where.genres = { has: genre }
    }

    // Search by title
    if (search) {
      where.AND = [
        ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
        {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { originalTitle: { contains: search, mode: "insensitive" } },
          ],
        },
      ]
    }

    // Determine sort order
    let orderBy: any = { createdAt: "desc" }
    if (sortBy === "releaseDate") {
      orderBy = { releaseDate: "desc" }
    } else if (sortBy === "title") {
      orderBy = { title: "asc" }
    } else if (sortBy === "quality") {
      orderBy = { dataQualityScore: "desc" }
    }

    const [series, total] = await Promise.all([
      prisma.mediaItem.findMany({
        where,
        orderBy,
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
      numberOfSeasons: item.numberOfSeasons,
      director: item.director,
      genres: item.genres,
      platforms: item.platforms,
      officialRating: item.officialRating,
      expertAgeRec: item.expertAgeRec,
      communityAgeRec: item.communityAgeRec,
      contentMetrics: item.contentMetrics,
      dataQualityScore: item.dataQualityScore,
      originalLanguage: item.originalLanguage,
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
