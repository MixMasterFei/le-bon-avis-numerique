import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import { Prisma } from "@prisma/client"
import { seededShuffle, getWeekSeed } from "@/lib/seeded-shuffle"
import { FAMILY_VIP_BRAND_TOPICS } from "@/lib/family-vip-brands"

// ── Types ────────────────────────────────────────────────────────────────

export interface MediaQueryFilters {
  page?: number
  limit?: number
  minAge?: number
  maxAge?: number
  genres?: string[]
  excludeGenres?: string[]
  requireAllGenres?: boolean
  topics?: string[]
  tones?: string[]
  platforms?: string[]
  search?: string
  sortBy?: string
  requirePoster?: boolean
  minQuality?: number
  featured?: boolean
  language?: string
  frenchOnly?: boolean
  shuffle?: string
  nowPlaying?: boolean
  // Content-metric caps (0-5 scale, values from ContentMetrics table).
  // Each filter excludes items whose metric exceeds the cap AND items
  // without a ContentMetrics row (safer default for family-friendly URLs).
  maxViolence?: number
  maxSexual?: number
  maxLanguage?: number
  maxSubstance?: number
  maxConsumerism?: number
  // Games-specific
  consoleOnly?: boolean
  includeAll?: boolean
}

export interface MediaQueryResult {
  items: TransformedMediaItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface TransformedMediaItem {
  id: string
  tmdbId?: number | null
  igdbId?: number | null
  title: string
  originalTitle?: string | null
  type: string
  synopsisFr?: string | null
  posterUrl?: string | null
  backdropUrl?: string | null
  releaseDate: string | null
  duration?: number | null
  numberOfSeasons?: number | null
  director?: string | null
  genres: string[]
  platforms: string[]
  topics: string[]
  officialRating?: string | null
  expertAgeRec: number | null
  communityAgeRec?: number | null
  contentMetrics: Record<string, unknown> | null
  originalLanguage?: string | null
  dataQualityScore?: number | null
  reviewCount: number
  reviewAvgRating: number | null
  tmdbRating?: number | null
  tmdbVoteCount?: number | null
  toneTags?: string[]
  pacing?: string | null
  enrichmentSource?: string | null
}

// ── European languages (default filter for French audience) ──────────

const EUROPEAN_LANGUAGES = [
  "fr", "en", "es", "it", "de", "pt", "nl", "da", "sv", "no",
  "fi", "pl", "cs", "ro", "hu", "el", "tr", "ru",
]

// Console platforms for games
const CONSOLE_PLATFORMS = [
  "Switch", "PS5", "PS4", "Xbox Series", "Xbox One",
  "Nintendo Switch", "PlayStation 5", "PlayStation 4",
]

const DEFAULT_GAME_MIN_QUALITY = 60

// ── Shared where-clause builders ─────────────────────────────────────

function appendAnd(where: Prisma.MediaItemWhereInput, ...conditions: Prisma.MediaItemWhereInput[]) {
  where.AND = [
    ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
    ...conditions,
  ]
}

function applyPosterFilter(where: Prisma.MediaItemWhereInput) {
  appendAnd(where,
    { posterUrl: { not: null } },
    { posterUrl: { not: "" } },
    { posterUrl: { startsWith: "http" } },
  )
}

function applyLanguageFilter(
  where: Prisma.MediaItemWhereInput,
  language?: string,
  frenchOnly?: boolean,
) {
  if (frenchOnly) {
    where.originalLanguage = "fr"
  } else if (language === "all") {
    // No filter
  } else if (language) {
    const languages = language.split(",").map(l => l.trim())
    if (languages.length === 1) {
      where.originalLanguage = languages[0]
    } else {
      appendAnd(where, { originalLanguage: { in: languages } })
    }
  } else {
    appendAnd(where, { originalLanguage: { in: EUROPEAN_LANGUAGES } })
  }
}

function applyAgeFilter(where: Prisma.MediaItemWhereInput, minAge?: number, maxAge?: number) {
  if (!minAge && !maxAge) return

  const ageFilter: Record<string, unknown> = { not: null }
  if (minAge) ageFilter.gte = minAge
  if (maxAge) ageFilter.lte = maxAge

  // Family VIP brands (Ghibli, Nintendo, Pixar, etc.) bypass the age
  // band: their content is designed for all ages, so a Totoro rated
  // 5+ should still surface when the filter is centered on a 10-year-
  // old. Wrap age + VIP as an OR so other filters (genres, platforms)
  // still AND cleanly with the rest of the where clause.
  appendAnd(where, {
    OR: [
      { expertAgeRec: ageFilter },
      { topics: { hasSome: [...FAMILY_VIP_BRAND_TOPICS] } },
    ],
  })
}

function applyContentMetricCaps(
  where: Prisma.MediaItemWhereInput,
  filters: Pick<
    MediaQueryFilters,
    "maxViolence" | "maxSexual" | "maxLanguage" | "maxSubstance" | "maxConsumerism"
  >,
) {
  const metricFilter: Record<string, { lte: number }> = {}
  if (typeof filters.maxViolence === "number") metricFilter.violence = { lte: filters.maxViolence }
  if (typeof filters.maxSexual === "number") metricFilter.sexNudity = { lte: filters.maxSexual }
  if (typeof filters.maxLanguage === "number") metricFilter.language = { lte: filters.maxLanguage }
  if (typeof filters.maxSubstance === "number") metricFilter.substanceUse = { lte: filters.maxSubstance }
  if (typeof filters.maxConsumerism === "number") metricFilter.consumerism = { lte: filters.maxConsumerism }
  if (Object.keys(metricFilter).length === 0) return
  // Filtering on a 1:1 optional relation implicitly excludes items whose
  // ContentMetrics row is missing — intentional for safety-focused filters.
  appendAnd(where, { contentMetrics: metricFilter })
}

function applySearchFilter(where: Prisma.MediaItemWhereInput, search?: string, includeOriginalTitle = true) {
  if (!search) return
  const orConditions: Prisma.MediaItemWhereInput[] = [
    { title: { contains: search, mode: "insensitive" } },
  ]
  if (includeOriginalTitle) {
    orConditions.push({ originalTitle: { contains: search, mode: "insensitive" } })
  }
  appendAnd(where, { OR: orConditions })
}

// ── Transform Prisma result to API-compatible format ─────────────────

type PrismaMediaWithRelations = Prisma.MediaItemGetPayload<{
  include: { contentMetrics: true; reviews: { select: { rating: true } } }
}> & { _count?: { reviews: number } }

function transformItem(item: PrismaMediaWithRelations): TransformedMediaItem {
  const ratings = item.reviews.map(r => r.rating)
  const reviewCount = item._count?.reviews ?? ratings.length
  const reviewAvgRating = ratings.length > 0
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
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
    numberOfSeasons: item.numberOfSeasons,
    director: item.director,
    genres: item.genres,
    platforms: item.platforms,
    topics: item.topics,
    officialRating: item.officialRating,
    expertAgeRec: item.expertAgeRec,
    communityAgeRec: item.communityAgeRec,
    contentMetrics: item.contentMetrics as Record<string, unknown> | null,
    originalLanguage: item.originalLanguage,
    dataQualityScore: item.dataQualityScore,
    reviewCount,
    reviewAvgRating,
    tmdbRating: item.tmdbRating,
    tmdbVoteCount: item.tmdbVoteCount,
    toneTags: (item.contentMetrics as { toneTags?: string[] } | null)?.toneTags || [],
    pacing: (item.contentMetrics as { pacing?: string } | null)?.pacing || null,
    enrichmentSource: (item.contentMetrics as { enrichmentSource?: string } | null)?.enrichmentSource || null,
  }
}

// ── fetchMovies ──────────────────────────────────────────────────────

export async function fetchMovies(filters: MediaQueryFilters = {}): Promise<MediaQueryResult> {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20
  const skip = (page - 1) * limit
  const useWeeklyShuffle = filters.shuffle === "weekly" && page === 1

  const where: Prisma.MediaItemWhereInput = {
    type: "MOVIE",
    isEnriched: true,
    expertAgeRec: { not: null },
  }

  // Release date filter
  if (filters.nowPlaying) {
    const eightWeeksAgo = new Date()
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)
    where.releaseDate = { gte: eightWeeksAgo, lte: new Date() }
  } else {
    where.releaseDate = { lte: new Date() }
  }

  // Poster
  if (filters.requirePoster || filters.featured) {
    applyPosterFilter(where)
  }

  // Quality
  if (filters.minQuality) {
    where.dataQualityScore = { gte: filters.minQuality }
  }

  // Featured
  if (filters.featured) {
    where.dataQualityScore = { gte: 50 }
    appendAnd(where,
      { tmdbRating: { gte: 6.5 } },
      { tmdbVoteCount: { gte: 200 } },
      { expertAgeRec: { not: null } },
      { originalLanguage: { in: ["fr", "en"] } },
    )
  }

  // Language
  applyLanguageFilter(where, filters.language, filters.frenchOnly)

  // Age
  applyAgeFilter(where, filters.minAge, filters.maxAge)

  // Content-metric caps (violence, sexual, language, substance, consumerism)
  applyContentMetricCaps(where, filters)

  // Genres
  if (filters.genres && filters.genres.length > 0) {
    if (filters.requireAllGenres) {
      appendAnd(where, ...filters.genres.map(genre => ({ genres: { has: genre } })))
    } else {
      where.genres = { hasSome: filters.genres }
    }
  }

  // Exclude genres
  if (filters.excludeGenres && filters.excludeGenres.length > 0) {
    appendAnd(where, { NOT: { genres: { hasSome: filters.excludeGenres } } })
  }

  // Topics (search in both topics and genres arrays)
  if (filters.topics && filters.topics.length > 0) {
    appendAnd(where, {
      OR: [
        { topics: { hasSome: filters.topics } },
        { genres: { hasSome: filters.topics } },
      ],
    })
  }

  // Tone tags
  if (filters.tones && filters.tones.length > 0) {
    appendAnd(where, { contentMetrics: { toneTags: { hasSome: filters.tones } } })
  }

  // Platforms
  if (filters.platforms && filters.platforms.length > 0) {
    where.platforms = { hasSome: filters.platforms }
  }

  // Search
  applySearchFilter(where, filters.search)

  // Sort
  let orderBy: Prisma.MediaItemOrderByWithRelationInput | Prisma.MediaItemOrderByWithRelationInput[] = { releaseDate: "desc" }
  if (filters.sortBy === "title") {
    orderBy = { title: "asc" }
  } else if (filters.sortBy === "quality") {
    appendAnd(where, { tmdbVoteCount: { gte: 50 } })
    orderBy = [{ tmdbRating: { sort: "desc", nulls: "last" } }, { dataQualityScore: "desc" }]
  }

  const fetchLimit = useWeeklyShuffle ? limit * 5 : limit

  const [rawItems, total] = await Promise.all([
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
    withPrismaRetry(() => prisma.mediaItem.count({ where })).catch(() => skip + fetchLimit),
  ])

  let items = rawItems
  if (useWeeklyShuffle && items.length > limit) {
    items = seededShuffle(items, getWeekSeed()).slice(0, limit)
  }

  return {
    items: items.map(item => transformItem(item as PrismaMediaWithRelations)),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

// ── fetchSeries ──────────────────────────────────────────────────────

export async function fetchSeries(filters: MediaQueryFilters = {}): Promise<MediaQueryResult> {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20
  const skip = (page - 1) * limit

  const where: Prisma.MediaItemWhereInput = {
    type: "TV",
    isEnriched: true,
    expertAgeRec: { not: null },
    releaseDate: { lte: new Date() },
  }

  if (filters.requirePoster || filters.featured) {
    applyPosterFilter(where)
  }

  if (filters.minQuality) {
    where.dataQualityScore = { gte: filters.minQuality }
  }

  if (filters.featured) {
    where.dataQualityScore = { gte: 50 }
    appendAnd(where, { originalLanguage: { in: ["fr", "en"] } })
  }

  applyLanguageFilter(where, filters.language, filters.frenchOnly)
  applyAgeFilter(where, filters.minAge, filters.maxAge)
  applyContentMetricCaps(where, filters)

  // Series uses single-genre `has` for backward compat, plus hasSome for multi-genre
  if (filters.genres && filters.genres.length > 0) {
    if (filters.genres.length === 1) {
      where.genres = { has: filters.genres[0] }
    } else {
      where.genres = { hasSome: filters.genres }
    }
  }

  // Topics (search in both topics and genres — fixing missing feature in series API)
  if (filters.topics && filters.topics.length > 0) {
    appendAnd(where, {
      OR: [
        { topics: { hasSome: filters.topics } },
        { genres: { hasSome: filters.topics } },
      ],
    })
  }

  // Platforms
  if (filters.platforms && filters.platforms.length > 0) {
    where.platforms = { hasSome: filters.platforms }
  }

  applySearchFilter(where, filters.search)

  let orderBy: Prisma.MediaItemOrderByWithRelationInput | Prisma.MediaItemOrderByWithRelationInput[] = { releaseDate: "desc" }
  if (filters.sortBy === "title") {
    orderBy = { title: "asc" }
  } else if (filters.sortBy === "quality") {
    orderBy = { dataQualityScore: "desc" }
  }

  const [rawItems, total] = await Promise.all([
    withPrismaRetry(() =>
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
    ),
    withPrismaRetry(() => prisma.mediaItem.count({ where })).catch(() => skip + limit),
  ])

  return {
    items: rawItems.map(item => transformItem(item as PrismaMediaWithRelations)),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

// ── fetchGames ───────────────────────────────────────────────────────

export async function fetchGames(filters: MediaQueryFilters = {}): Promise<MediaQueryResult> {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20
  const skip = (page - 1) * limit
  const consoleOnly = filters.consoleOnly !== false

  const where: Prisma.MediaItemWhereInput = {
    type: "GAME",
    isEnriched: true,
    expertAgeRec: { not: null },
    releaseDate: { lte: new Date() },
  }

  if (filters.requirePoster || filters.featured) {
    applyPosterFilter(where)
  }

  // Higher default quality threshold for games
  if (!filters.includeAll) {
    const qualityThreshold = filters.minQuality ?? DEFAULT_GAME_MIN_QUALITY
    where.dataQualityScore = { gte: qualityThreshold }
  } else if (filters.minQuality) {
    where.dataQualityScore = { gte: filters.minQuality }
  }

  if (filters.featured) {
    where.dataQualityScore = { gte: 50 }
  }

  // Console platform filter (default: on)
  if (consoleOnly && !filters.platforms?.length) {
    appendAnd(where, {
      OR: CONSOLE_PLATFORMS.map(p => ({ platforms: { has: p } })),
    })
  }

  applyAgeFilter(where, filters.minAge, filters.maxAge)
  applyContentMetricCaps(where, filters)

  // Platform filter
  if (filters.platforms && filters.platforms.length > 0) {
    where.platforms = { hasSome: filters.platforms }
  }

  applySearchFilter(where, filters.search, false) // Games: title only

  // Default sort: popularity (vote count + rating)
  let orderBy: Prisma.MediaItemOrderByWithRelationInput | Prisma.MediaItemOrderByWithRelationInput[] = [
    { tmdbVoteCount: { sort: "desc", nulls: "last" } },
    { tmdbRating: { sort: "desc", nulls: "last" } },
    { dataQualityScore: "desc" },
  ]
  if (filters.sortBy === "releaseDate") {
    orderBy = { releaseDate: "desc" }
  } else if (filters.sortBy === "title") {
    orderBy = { title: "asc" }
  } else if (filters.sortBy === "quality") {
    orderBy = { dataQualityScore: "desc" }
  }

  const [rawItems, total] = await Promise.all([
    withPrismaRetry(() =>
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
    ),
    withPrismaRetry(() => prisma.mediaItem.count({ where })).catch(() => skip + limit),
  ])

  return {
    items: rawItems.map(item => transformItem(item as PrismaMediaWithRelations)),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}
