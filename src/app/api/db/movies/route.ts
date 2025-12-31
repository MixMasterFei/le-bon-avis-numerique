import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "20")
  const maxAge = searchParams.get("maxAge")
  const genres = searchParams.get("genres")
  const excludeGenres = searchParams.get("excludeGenres")
  const topics = searchParams.get("topics")
  const platforms = searchParams.get("platforms")
  const search = searchParams.get("q")
  const requirePoster = searchParams.get("requirePoster") === "true"
  const minQuality = searchParams.get("minQuality")
  const sortBy = searchParams.get("sortBy") || "createdAt" // createdAt, releaseDate, title
  const featured = searchParams.get("featured") === "true" // Featured/popular movies
  const language = searchParams.get("language") // Filter by original language
  const frenchOnly = searchParams.get("frenchOnly") === "true"

  const skip = (page - 1) * limit

  try {
    const where: Prisma.MediaItemWhereInput = {
      type: "MOVIE",
    }

    // Require poster for homepage/featured sections
    // Must have a real poster URL (not null, not empty, must start with http)
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

    // Featured movies: high quality, with poster, French/English content only
    if (featured) {
      where.dataQualityScore = { gte: 50 }
      // Only show content relevant to French audience (French or English)
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
      // Only include films that have an age rating set (exclude nulls for strict filtering)
      where.expertAgeRec = { lte: age, not: null }
    }

    // Filter by genres
    // Use requireAllGenres=true to require ALL genres (AND logic), otherwise any match (OR logic)
    if (genres) {
      const genreList = genres.split(",").map(g => g.trim())
      const requireAll = searchParams.get("requireAllGenres") === "true"

      if (requireAll) {
        // Require ALL specified genres (AND logic)
        where.AND = [
          ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
          ...genreList.map(genre => ({
            genres: { has: genre }
          }))
        ]
      } else {
        // Any of the genres matches (OR logic) - default behavior
        where.genres = { hasSome: genreList }
      }
    }

    // Exclude certain genres (useful for family sections to exclude action, horror, etc.)
    if (excludeGenres) {
      const excludeList = excludeGenres.split(",").map(g => g.trim())
      // Use AND with NOT to exclude films that have ANY of these genres
      where.AND = [
        ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
        {
          NOT: {
            genres: { hasSome: excludeList }
          }
        }
      ]
    }

    // Filter by topics/themes (search in topics array AND in genres for flexibility)
    // This allows filtering by themes like "Aviation", "Famille", etc.
    if (topics) {
      const topicList = topics.split(",").map(t => t.trim())
      // Search in both topics and genres arrays, and also in synopsis for keyword matching
      where.AND = [
        ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
        {
          OR: [
            { topics: { hasSome: topicList } },
            { genres: { hasSome: topicList } },
            // Also search in synopsis for theme keywords
            ...topicList.map(topic => ({
              synopsisFr: { contains: topic, mode: "insensitive" as const }
            })),
          ]
        }
      ]
    }

    // Filter by platforms (any match)
    if (platforms) {
      const platformList = platforms.split(",").map(p => p.trim())
      where.platforms = { hasSome: platformList }
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

    const [movies, total] = await Promise.all([
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
      originalLanguage: movie.originalLanguage,
      dataQualityScore: movie.dataQualityScore,
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
