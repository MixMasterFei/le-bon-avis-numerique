import { parsePagination } from "@/lib/pagination"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import { publicMediaWhere } from "@/lib/media-route"
import { matchMediaIdsByTitle } from "@/lib/search-normalize"
import { Prisma } from "@prisma/client"

// Unified media endpoint - fetches all types with filtering
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const pagination = parsePagination(searchParams.get("page"), searchParams.get("limit"))
  if (!pagination) {
    return NextResponse.json({ error: "Pagination invalide (limite : 1 à 100)." }, { status: 400 })
  }
  const { page, limit, skip } = pagination
  const type = searchParams.get("type") // MOVIE, TV, GAME, or null for all
  const minAge = searchParams.get("minAge")
  const maxAge = searchParams.get("maxAge")
  const genre = searchParams.get("genre")
  const search = searchParams.get("q")
  const sort = searchParams.get("sort") // "popularity" | "rating" | "newest" | "age" | default (age+date)
  const minVotes = searchParams.get("minVotes") // minimum tmdbVoteCount

  try {
    // Keep lookup failures inside the same fail-closed response as query failures.
    let searchIds: string[] | null = null
    if (search && search.trim().length >= 1) {
      searchIds = await matchMediaIdsByTitle(search, { limit: 200 })
    }
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

    // Search by title — accent-insensitive via pre-resolved ids (see above).
    // An empty set (no match, or search failed) yields no rows, which is the
    // correct answer for a title that genuinely isn't in the catalog.
    if (searchIds !== null) {
      where.id = { in: searchIds }
    }

    // Filter by minimum vote count (surfaces well-known titles)
    if (minVotes) {
      const votes = parseInt(minVotes)
      if (votes > 0) {
        where.tmdbVoteCount = { gte: votes }
      }
    }

    // Default: only show European-language content for movies/TV.
    //
    // NOT applied when the caller is searching by title. If someone types a
    // title they want THAT title, whatever language it was shot in; a browse
    // heuristic has no business censoring an explicit lookup.
    //
    // And `originalLanguage` must be allowed to be NULL. `{ in: [...] }`
    // compiles to a SQL IN, which is UNKNOWN — not true — for NULL, so every
    // row missing the field was silently dropped from every listing. That is
    // 1 948 films/séries, 20.6 % of the catalogue, including "L'Odyssée"
    // (2026) and "Le Monde de Narnia : L'Odyssée du passeur d'aurore": the
    // reason searching "odyssée" from the mobile header returned nothing.
    // A missing language is missing metadata, not a foreign-language title.
    if (!searchIds && (!type || type === "MOVIE" || type === "TV")) {
      where.AND = [
        ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
        {
          OR: [
            { originalLanguage: { in: ["fr", "en", "es", "it", "de", "pt", "nl", "da", "sv", "no", "fi", "pl", "cs", "ro", "hu", "el", "tr", "ru"] } },
            { originalLanguage: null },
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

    // A title search must come back in RELEVANCE order — `matchMediaIdsByTitle`
    // already ranked the ids (exact title, then prefix, then in-cinemas-now,
    // then popularity). Falling through to the default `expertAgeRec asc` would
    // re-sort the matches by age, so searching "odyssée" listed whichever
    // Odyssée happens to suit the youngest audience first.
    //
    // The id set is capped at 200, so fetching it whole and paginating in
    // memory is cheap and keeps the ranking intact through the other filters
    // (type / age / genre), which a pre-sliced id list would break.
    const relevanceSearch = searchIds !== null && !sort
    const items = relevanceSearch
      ? await withPrismaRetry(async () => {
          const rank = new Map(searchIds!.map((id, i) => [id, i]))
          const all = await prisma.mediaItem.findMany({
            where,
            include: { contentMetrics: true, reviews: { select: { rating: true } } },
          })
          all.sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity))
          return all.slice(skip, skip + limit)
        })
      : await withPrismaRetry(() =>
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

    // CDN-cacheable — public catalogue data, no session reads (see /api/db/movies).
    return NextResponse.json({
      items: transformedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" } })
  } catch (error) {
    console.error("Database error:", error)
    // Never drop the age/search filters to manufacture successful results.
    return NextResponse.json(
      { error: "Le catalogue est temporairement indisponible. Veuillez réessayer." },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" } },
    )
  }
}
