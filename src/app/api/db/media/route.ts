import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import { publicMediaWhere } from "@/lib/media-route"
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
  const sort = searchParams.get("sort") // "popularity" | "rating" | "newest" | "age" | default (age+date)
  const minVotes = searchParams.get("minVotes") // minimum tmdbVoteCount

  const skip = (page - 1) * limit

  try {
    // Public gate: poster + quality floor (≥30) + no manga — the SAME bar as
    // the sitemap and category pages. This endpoint feeds user-facing surfaces
    // (header search, recommendations), so it must not surface incomplete /
    // unvetted fiches (no poster, no age) that /films/recherche would exclude.
    // Quality ≥30 still includes provisional films (they carry an age estimate).
    // Admin tooling can still override `type` below (incl. ?type=MANGA).
    const where: Prisma.MediaItemWhereInput = { ...publicMediaWhere }

    // Filter by type — overrides the default MANGA exclusion when caller
    // explicitly asks for a type (including MANGA, e.g. /admin contexts).
    if (type && ["MOVIE", "TV", "GAME", "BOOK", "APP", "MANGA"].includes(type)) {
      where.type = type as "MOVIE" | "TV" | "GAME" | "BOOK" | "APP" | "MANGA"
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

    // Filter by minimum vote count (surfaces well-known titles)
    if (minVotes) {
      const votes = parseInt(minVotes)
      if (votes > 0) {
        where.tmdbVoteCount = { gte: votes }
      }
    }

    // Default: only show European-language content for movies/TV
    // Games and books don't have originalLanguage from TMDB
    if (!type || type === "MOVIE" || type === "TV") {
      where.AND = [
        ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
        {
          OR: [
            { originalLanguage: { in: ["fr", "en", "es", "it", "de", "pt", "nl", "da", "sv", "no", "fi", "pl", "cs", "ro", "hu", "el", "tr", "ru"] } },
            { type: { in: ["GAME", "BOOK", "APP"] } },
          ],
        },
      ]
    }

    // Determine sort order
    let orderBy: Prisma.MediaItemOrderByWithRelationInput[]
    switch (sort) {
      case "popularity":
        orderBy = [{ tmdbVoteCount: { sort: "desc", nulls: "last" } }, { tmdbRating: { sort: "desc", nulls: "last" } }]
        break
      case "rating":
        orderBy = [{ tmdbRating: { sort: "desc", nulls: "last" } }, { tmdbVoteCount: { sort: "desc", nulls: "last" } }]
        break
      case "newest":
        orderBy = [{ releaseDate: { sort: "desc", nulls: "last" } }]
        break
      case "age":
        // Age-first sort: youngest recommendations first, then most popular within each age
        orderBy = [{ expertAgeRec: "asc" }, { tmdbVoteCount: { sort: "desc", nulls: "last" } }]
        break
      default:
        orderBy = [{ expertAgeRec: "asc" }, { createdAt: "desc" }]
    }

    // Run sequentially for compatibility with pooled Postgres backends.
    const items = await withPrismaRetry(() =>
      prisma.mediaItem.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          contentMetrics: true,
          reviews: { select: { rating: true } },
        },
      })
    )
    let total = items.length
    try {
      total = await withPrismaRetry(() => prisma.mediaItem.count({ where }))
    } catch (countError) {
      console.warn("Media count failed, using fallback total:", countError)
      total = skip + items.length
    }

    // Transform to API format
    const transformedItems = items.map((item) => {
      const ratings = item.reviews.map((r) => r.rating)
      const reviewCount = ratings.length
      const reviewAvgRating = reviewCount > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / reviewCount) * 10) / 10
        : null

      return {
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
        reviewCount,
        reviewAvgRating,
        tmdbRating: item.tmdbRating,
        tmdbVoteCount: item.tmdbVoteCount,
      }
    })

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
    // Degraded mode: return basic media rows without joins/count to keep homepage usable.
    try {
      const fallbackItems = await withPrismaRetry(() =>
        prisma.mediaItem.findMany({
          where: {
            ...publicMediaWhere,
            ...(type && ["MOVIE", "TV", "GAME", "BOOK", "APP", "MANGA"].includes(type)
              ? { type: type as "MOVIE" | "TV" | "GAME" | "BOOK" | "APP" }
              : {}),
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        })
      )

      return NextResponse.json({
        items: fallbackItems.map((item) => ({
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
          contentMetrics: null,
        })),
        pagination: {
          page,
          limit,
          total: skip + fallbackItems.length,
          totalPages: fallbackItems.length === 0 ? 0 : page,
        },
        degraded: true,
      })
    } catch (fallbackError) {
      console.error("Media fallback failed:", fallbackError)
      return NextResponse.json(
        { error: "Failed to fetch media from database" },
        { status: 500 }
      )
    }
  }
}
