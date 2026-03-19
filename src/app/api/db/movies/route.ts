import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import { Prisma } from "@prisma/client"
import { seededShuffle, getWeekSeed } from "@/lib/seeded-shuffle"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "20")
  const minAge = searchParams.get("minAge")
  const maxAge = searchParams.get("maxAge")
  const genres = searchParams.get("genres")
  const excludeGenres = searchParams.get("excludeGenres")
  const topics = searchParams.get("topics")
  const platforms = searchParams.get("platforms")
  const search = searchParams.get("q")
  const requirePoster = searchParams.get("requirePoster") === "true"
  const minQuality = searchParams.get("minQuality")
  const sortBy = searchParams.get("sortBy") || "releaseDate" // releaseDate, title, quality
  const featured = searchParams.get("featured") === "true" // Featured/popular movies
  const language = searchParams.get("language") // Filter by original language
  const frenchOnly = searchParams.get("frenchOnly") === "true"
  const shuffle = searchParams.get("shuffle") // "weekly" for week-seeded rotation
  const nowPlaying = searchParams.get("nowPlaying") === "true" // Currently in theaters (~8 weeks)

  const skip = (page - 1) * limit
  const useWeeklyShuffle = shuffle === "weekly" && page === 1

  try {
    const where: Prisma.MediaItemWhereInput = {
      type: "MOVIE",
    }

    // Now playing: movies released in the last ~8 weeks (typical French theatrical window)
    if (nowPlaying) {
      const eightWeeksAgo = new Date()
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)
      where.releaseDate = { gte: eightWeeksAgo, lte: new Date() }
    } else {
      // Exclude future movies (not yet released)
      where.releaseDate = { lte: new Date() }
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

    // Featured movies: genuinely well-rated, well-known, family-appropriate
    if (featured) {
      where.dataQualityScore = { gte: 50 }
      where.AND = [
        ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
        // Must have a good TMDB rating (6.5+ out of 10) with meaningful vote count
        { tmdbRating: { gte: 6.5 } },
        { tmdbVoteCount: { gte: 200 } },
        // Must have an expert age rating
        { expertAgeRec: { not: null } },
        // Only French/English content
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
      // Search in both topics and genres arrays only (not synopsis - too many false positives)
      where.AND = [
        ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
        {
          OR: [
            { topics: { hasSome: topicList } },
            { genres: { hasSome: topicList } },
          ]
        }
      ]
    }

    // Filter by tone tags (ambiance browsing)
    const tones = searchParams.get("tones")
    if (tones) {
      const toneList = tones.split(",").map(t => t.trim())
      where.AND = [
        ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
        { contentMetrics: { toneTags: { hasSome: toneList } } }
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
    let orderBy: Prisma.MediaItemOrderByWithRelationInput | Prisma.MediaItemOrderByWithRelationInput[] = { releaseDate: "desc" }
    if (sortBy === "title") {
      orderBy = { title: "asc" }
    } else if (sortBy === "quality") {
      // Sort by TMDB audience rating (actual movie quality), then data completeness as tiebreaker
      orderBy = [{ tmdbRating: { sort: "desc", nulls: "last" } }, { dataQualityScore: "desc" }]
    }

    // When weekly shuffle is active, fetch a larger pool then shuffle deterministically
    const fetchLimit = useWeeklyShuffle ? limit * 5 : limit

    // Run findMany and count in parallel for better performance
    const [rawMovies, total] = await Promise.all([
      withPrismaRetry(() =>
        prisma.mediaItem.findMany({
          where,
          orderBy,
          skip,
          take: fetchLimit,
          include: {
            contentMetrics: true,
            reviews: { select: { rating: true }, take: 50 },
            _count: { select: { reviews: true } },
          },
        })
      ),
      withPrismaRetry(() => prisma.mediaItem.count({ where })).catch((countError) => {
        console.warn("Movies count failed, using fallback total:", countError)
        return skip + fetchLimit
      }),
    ])

    let movies = rawMovies

    // Apply weekly shuffle: deterministic reorder based on ISO week number
    if (useWeeklyShuffle && movies.length > limit) {
      movies = seededShuffle(movies, getWeekSeed()).slice(0, limit)
    }

    // Transform to API format
    const transformedMovies = movies.map((movie) => {
      const ratings = movie.reviews.map((r) => r.rating)
      const reviewCount = movie._count.reviews
      const reviewAvgRating = ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null

      return {
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
        reviewCount,
        reviewAvgRating,
        tmdbRating: movie.tmdbRating,
        tmdbVoteCount: movie.tmdbVoteCount,
        toneTags: movie.contentMetrics?.toneTags || [],
        pacing: movie.contentMetrics?.pacing || null,
        enrichmentSource: movie.contentMetrics?.enrichmentSource || null,
      }
    })

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
    // Degraded mode: return simple movie payload without joins/count.
    try {
      const fallbackMovies = await withPrismaRetry(() =>
        prisma.mediaItem.findMany({
          where: {
            type: "MOVIE",
            releaseDate: { lte: new Date() },
            ...(requirePoster
              ? {
                  posterUrl: {
                    not: null,
                    startsWith: "http",
                  },
                }
              : {}),
          },
          orderBy: { releaseDate: "desc" },
          skip,
          take: limit,
        })
      )

      return NextResponse.json({
        movies: fallbackMovies.map((movie) => ({
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
          contentMetrics: null,
          originalLanguage: movie.originalLanguage,
          dataQualityScore: movie.dataQualityScore,
        })),
        pagination: {
          page,
          limit,
          total: skip + fallbackMovies.length,
          totalPages: fallbackMovies.length === 0 ? 0 : page,
        },
        degraded: true,
      })
    } catch (fallbackError) {
      console.error("Movies fallback failed:", fallbackError)
      return NextResponse.json(
        { error: "Failed to fetch movies from database" },
        { status: 500 }
      )
    }
  }
}
