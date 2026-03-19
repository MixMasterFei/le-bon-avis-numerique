import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "20")
  const minAge = searchParams.get("minAge")
  const maxAge = searchParams.get("maxAge")
  const genre = searchParams.get("genre")
  const search = searchParams.get("q")
  const sortBy = searchParams.get("sortBy") || "releaseDate" // releaseDate, quality, title
  const requirePoster = searchParams.get("requirePoster") === "true"
  const minQuality = searchParams.get("minQuality")
  const featured = searchParams.get("featured") === "true" // Get featured/popular series
  const language = searchParams.get("language") // Filter by original language (fr, en, etc.)
  const frenchOnly = searchParams.get("frenchOnly") === "true" // Only show French content

  const skip = (page - 1) * limit

  try {
    const where: Prisma.MediaItemWhereInput = {
      type: "TV",
      // Exclude future content (not yet released)
      releaseDate: { lte: new Date() },
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

    // Language filtering:
    // - language=all → no filter (admin use)
    // - language=fr,en → only those languages
    // - frenchOnly=true → only French
    // - (default) → European languages only
    if (frenchOnly) {
      where.originalLanguage = "fr"
    } else if (language === "all") {
      // No language filter
    } else if (language) {
      const languages = language.split(",").map(l => l.trim())
      if (languages.length === 1) {
        where.originalLanguage = languages[0]
      } else {
        where.AND = [
          ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
          { originalLanguage: { in: languages } },
        ]
      }
    } else {
      // Default: only European-language content for French audience
      where.AND = [
        ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
        { originalLanguage: { in: ["fr", "en", "es", "it", "de", "pt", "nl", "da", "sv", "no", "fi", "pl", "cs", "ro", "hu", "el", "tr", "ru"] } },
      ]
    }

    // Filter by age recommendation (min and/or max)
    if (minAge || maxAge) {
      const ageFilter: Record<string, unknown> = { not: null }
      if (minAge) ageFilter.gte = parseInt(minAge)
      if (maxAge) ageFilter.lte = parseInt(maxAge)
      where.expertAgeRec = ageFilter
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
    let orderBy: Prisma.MediaItemOrderByWithRelationInput | Prisma.MediaItemOrderByWithRelationInput[] = { releaseDate: "desc" }
    if (sortBy === "title") {
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
          reviews: { select: { rating: true } },
        },
      }),
      prisma.mediaItem.count({ where }),
    ])

    // Transform to API format
    const transformedSeries = series.map((item) => {
      const ratings = item.reviews.map((r) => r.rating)
      const reviewCount = ratings.length
      const reviewAvgRating = reviewCount > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / reviewCount) * 10) / 10
        : null

      return {
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
        reviewCount,
        reviewAvgRating,
        tmdbRating: item.tmdbRating,
        tmdbVoteCount: item.tmdbVoteCount,
      }
    })

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
