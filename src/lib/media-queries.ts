import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import { Prisma } from "@prisma/client"
import { seededShuffle, getWeekSeed } from "@/lib/seeded-shuffle"
import { FAMILY_VIP_BRAND_TOPICS, FAMILY_VIP_AGE_CEILING } from "@/lib/family-vip-brands"

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
  // Include provisional (imported-but-not-yet-AI-enriched) films that have an
  // estimated age. OFF by default so curated surfaces stay expert-only; ON only
  // for search / cinema / "nouveautés" (see CLAUDE.md provisional-ratings note).
  includeProvisional?: boolean
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
  // Minimum IGDB rating count required (stored as `tmdbVoteCount` for
  // games — see /api/admin/import/games/route.ts:53). Used by the
  // homepage rail and the /jeux releaseDate sort to keep obscure
  // sub-100-rating shovelware out of "recent releases" surfaces.
  // Null/undefined = no filter (default browse stays inclusive).
  minVoteCount?: number
  // Manga-specific: "shounen" | "shoujo" | "seinen" | "josei"
  demographic?: string
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
  // True for imported films shown with an estimated age before AI enrichment.
  // Drives the "Âge provisoire · à confirmer" badge.
  isProvisional?: boolean
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

// Recency exemption for the games popularity floor — see fetchGames below.
// Mirrors MIN_FRESH_VOTE_COUNT / FRESH_WINDOW_DAYS in the games import cron:
// what we let INTO the catalogue as a fresh release must also be allowed OUT
// onto the "sortis récemment" rail, or the import change is invisible.
const GAME_FRESH_MIN_VOTES = 3
const GAME_FRESH_WINDOW_DAYS = 90

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
  //
  // The VIP bypass is CEILED at FAMILY_VIP_AGE_CEILING: the tag lifts a title
  // above a stricter filter only within family range. Without this ceiling,
  // "Nintendo" (which tags PEGI-18 first-party games like Bayonetta) and a
  // thematic "Disney" tag (on adult films like The Florida Project) would let
  // genuinely mature titles bypass every age cap — the leak that put Bayonetta
  // in the default family games rail.
  appendAnd(where, {
    OR: [
      { expertAgeRec: ageFilter },
      {
        AND: [
          { topics: { hasSome: [...FAMILY_VIP_BRAND_TOPICS] } },
          { expertAgeRec: { not: null, lte: FAMILY_VIP_AGE_CEILING } },
        ],
      },
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

/**
 * Pre-publish trust gate for FEATURED surfaces (homepage rails, expert picks):
 * only surface titles whose ratings are trustworthy — enriched, and NOT
 * explicitly low-confidence. null confidence (legacy "non noté") is allowed;
 * only an explicit < 0.6 is excluded. Keeps the riskiest data off the
 * highest-visibility cards. Not applied to plain browse/search.
 */
function applyTrustGate(where: Prisma.MediaItemWhereInput) {
  appendAnd(
    where,
    { isEnriched: true },
    { NOT: { contentMetrics: { enrichmentConfidence: { lt: 0.6 } } } },
  )
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
    // Has an (estimated) age but hasn't been through AI enrichment yet.
    isProvisional: !item.isEnriched && item.expertAgeRec != null,
  }
}

// ── fetchMovies ──────────────────────────────────────────────────────

/**
 * Total ANALYZED items of a type — the honest "catalogue scale" number for the
 * listing headline ("X films analysés"). Deliberately UNFILTERED by the browse
 * gates the listing applies (language fr/en, requirePoster, min-quality): those
 * shrink the visible page but don't change how many titles we've actually
 * analyzed. Using the filtered pagination total here undersold the catalog
 * (e.g. 4,180 shown vs ~7,200 films analyzed). "Analysé" = enriched (8 content
 * dimensions computed), which is exactly what the headline claims.
 */
export async function countAnalyzedMedia(
  type: "MOVIE" | "TV" | "GAME" | "MANGA",
): Promise<number> {
  return withPrismaRetry(() =>
    prisma.mediaItem.count({
      where: { type, isEnriched: true, expertAgeRec: { not: null } },
    }),
  )
}

export async function fetchMovies(filters: MediaQueryFilters = {}): Promise<MediaQueryResult> {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20
  const skip = (page - 1) * limit
  const useWeeklyShuffle = filters.shuffle === "weekly" && page === 1

  // Default: only AI-enriched films (curated). When includeProvisional is set
  // (search / cinema / nouveautés), also surface imported films that carry an
  // estimated age — they're badged "provisoire" in the UI.
  const where: Prisma.MediaItemWhereInput = {
    type: "MOVIE",
    expertAgeRec: { not: null },
    ...(filters.includeProvisional ? {} : { isEnriched: true }),
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
    applyTrustGate(where)
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
    expertAgeRec: { not: null },
    releaseDate: { lte: new Date() },
    ...(filters.includeProvisional ? {} : { isEnriched: true }),
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
    applyTrustGate(where)
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
    applyTrustGate(where)
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

  // Topics / genres filter — was MISSING for games, so `/jeux?topics=Aventure`
  // never filtered. Mirrors fetchMovies/fetchSeries: a topic matches either
  // topics[] or genres[]. Game genres are normalized to French at import
  // (see src/lib/igdb-genres.ts), so the French UI labels now match.
  if (filters.genres && filters.genres.length > 0) {
    where.genres = { hasSome: filters.genres }
  }
  if (filters.topics && filters.topics.length > 0) {
    appendAnd(where, {
      OR: [
        { topics: { hasSome: filters.topics } },
        { genres: { hasSome: filters.topics } },
      ],
    })
  }

  // Popularity floor — IGDB rating count, stored as tmdbVoteCount.
  // Keeps obscure indie shovelware out of recency-sorted surfaces
  // (homepage rail + /jeux?sort=releaseDate).
  //
  // The floor is relaxed for JUST-RELEASED games. IGDB rating counts accumulate
  // over weeks, so a full-price console release that shipped this month sits
  // well under 20 and was invisible on the very rail meant to show it — the
  // homepage "sortis récemment" rail could go a month without its newest card
  // changing. A brand-new title still needs a real signal (GAME_FRESH_MIN_VOTES
  // ratings), which is what separates it from a zero-signal asset flip.
  if (typeof filters.minVoteCount === "number" && filters.minVoteCount > 0) {
    if (filters.minVoteCount > GAME_FRESH_MIN_VOTES) {
      const freshSince = new Date(Date.now() - GAME_FRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000)
      appendAnd(where, {
        OR: [
          { tmdbVoteCount: { gte: filters.minVoteCount } },
          {
            AND: [
              { releaseDate: { gte: freshSince } },
              { tmdbVoteCount: { gte: GAME_FRESH_MIN_VOTES } },
            ],
          },
        ],
      })
    } else {
      where.tmdbVoteCount = { gte: filters.minVoteCount }
    }
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

// ── fetchMangas ──────────────────────────────────────────────────────

export async function fetchMangas(filters: MediaQueryFilters = {}): Promise<MediaQueryResult> {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20
  const skip = (page - 1) * limit

  const where: Prisma.MediaItemWhereInput = {
    type: "MANGA",
    // Don't require enrichment — manga pipeline is new and we want
    // imported-but-unanalyzed series to still show while enrichment
    // catches up. Keep the releaseDate gate so future-dated imports
    // stay out.
    releaseDate: { lte: new Date() },
  }

  if (filters.requirePoster || filters.featured) {
    applyPosterFilter(where)
  }

  if (filters.minQuality) {
    where.dataQualityScore = { gte: filters.minQuality }
  }

  if (filters.demographic) {
    where.demographic = filters.demographic.toLowerCase()
  }

  applyAgeFilter(where, filters.minAge, filters.maxAge)
  applyContentMetricCaps(where, filters)

  if (filters.genres && filters.genres.length > 0) {
    where.genres = { hasSome: filters.genres }
  }

  if (filters.topics && filters.topics.length > 0) {
    appendAnd(where, {
      OR: [
        { topics: { hasSome: filters.topics } },
        { genres: { hasSome: filters.topics } },
      ],
    })
  }

  applySearchFilter(where, filters.search)

  // Default sort: most recent tome (drives "Nouveautés manga" behavior).
  // Falls back to releaseDate for series without a French-edition date yet.
  let orderBy: Prisma.MediaItemOrderByWithRelationInput | Prisma.MediaItemOrderByWithRelationInput[] = [
    { latestVolumeDate: { sort: "desc", nulls: "last" } },
    { releaseDate: { sort: "desc", nulls: "last" } },
  ]
  if (filters.sortBy === "title") {
    orderBy = { title: "asc" }
  } else if (filters.sortBy === "popularity") {
    orderBy = [
      { tmdbRating: { sort: "desc", nulls: "last" } },
      { dataQualityScore: "desc" },
    ]
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
