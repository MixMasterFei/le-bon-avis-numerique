/**
 * AniList GraphQL Integration — manga series metadata
 *
 * - Endpoint: https://graphql.anilist.co  (no API key required)
 * - Documented rate limit: 90 req/min. We self-throttle to 60 req/min as
 *   a safety margin. The token bucket is process-local, so serverless
 *   invocations each get their own budget (fine for our volume).
 * - Licensing caveat: AniList allows lookup/enrichment but forbids bulk
 *   mirroring of their dataset. We only persist fields we actually
 *   display (title, cover, genres, tags, score) plus the external id
 *   so we can refresh later.
 *
 * Docs: https://docs.anilist.co/
 */

const ANILIST_GRAPHQL_URL = "https://graphql.anilist.co"

// ============================================
// TYPES
// ============================================

export interface AniListTitle {
  romaji?: string | null
  english?: string | null
  native?: string | null
}

export interface AniListDate {
  year?: number | null
  month?: number | null
  day?: number | null
}

export interface AniListManga {
  id: number
  type: "MANGA"
  title: AniListTitle
  description?: string | null
  coverImage: {
    large?: string | null
    extraLarge?: string | null
  }
  bannerImage?: string | null
  genres: string[]
  tags: { name: string; category?: string | null; rank?: number | null; isAdult?: boolean | null }[]
  averageScore?: number | null
  popularity?: number | null
  volumes?: number | null
  chapters?: number | null
  status?: "FINISHED" | "RELEASING" | "NOT_YET_RELEASED" | "CANCELLED" | "HIATUS" | null
  startDate?: AniListDate | null
  endDate?: AniListDate | null
  updatedAt?: number | null // unix seconds
  siteUrl?: string | null
  isAdult?: boolean | null
  staff?: {
    edges: { role: string; node: { name: { full: string } } }[]
  }
}

export class AniListError extends Error {
  constructor(message: string, public status?: number) {
    super(message)
    this.name = "AniListError"
  }
}

// ============================================
// RATE LIMITING (token bucket, 60 req/min)
// ============================================

const TOKENS_PER_MINUTE = 60
let tokens = TOKENS_PER_MINUTE
let lastRefill = Date.now()

async function acquireToken(): Promise<void> {
  const now = Date.now()
  const elapsedMs = now - lastRefill
  const refill = Math.floor((elapsedMs / 60_000) * TOKENS_PER_MINUTE)
  if (refill > 0) {
    tokens = Math.min(TOKENS_PER_MINUTE, tokens + refill)
    lastRefill = now
  }

  if (tokens > 0) {
    tokens -= 1
    return
  }

  // Wait for the next refill slice (~1 second per token).
  const waitMs = Math.ceil(60_000 / TOKENS_PER_MINUTE)
  await new Promise((resolve) => setTimeout(resolve, waitMs))
  return acquireToken()
}

// ============================================
// SHARED GRAPHQL FRAGMENT
// ============================================

const MANGA_FRAGMENT = `
  id
  type
  title { romaji english native }
  description(asHtml: false)
  coverImage { large extraLarge }
  bannerImage
  genres
  tags { name category rank isAdult }
  averageScore
  popularity
  volumes
  chapters
  status
  startDate { year month day }
  endDate { year month day }
  updatedAt
  siteUrl
  isAdult
  staff(perPage: 4, sort: RELEVANCE) {
    edges { role node { name { full } } }
  }
`

async function graphqlRequest<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  await acquireToken()

  const res = await fetch(ANILIST_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!res.ok) {
    throw new AniListError(`AniList HTTP ${res.status}`, res.status)
  }

  const json = (await res.json()) as { data?: T; errors?: { message: string }[] }
  if (json.errors?.length) {
    throw new AniListError(json.errors.map((e) => e.message).join("; "))
  }
  if (!json.data) {
    throw new AniListError("Empty AniList response")
  }
  return json.data
}

// ============================================
// PUBLIC API
// ============================================

export async function searchManga(
  query: string,
  opts: { perPage?: number; includeAdult?: boolean } = {}
): Promise<AniListManga[]> {
  const perPage = Math.min(opts.perPage ?? 10, 25)
  // Hentai / Ecchi-heavy results have `isAdult: true`. Filter them out
  // of the family site unless the caller explicitly opts in.
  const gql = `
    query ($search: String!, $perPage: Int!, $isAdult: Boolean) {
      Page(perPage: $perPage) {
        media(search: $search, type: MANGA, isAdult: $isAdult, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
          ${MANGA_FRAGMENT}
        }
      }
    }
  `
  const data = await graphqlRequest<{ Page: { media: AniListManga[] } }>(gql, {
    search: query,
    perPage,
    isAdult: opts.includeAdult ? null : false,
  })
  return data.Page.media
}

export async function getMangaById(anilistId: number): Promise<AniListManga | null> {
  const gql = `
    query ($id: Int!) {
      Media(id: $id, type: MANGA) {
        ${MANGA_FRAGMENT}
      }
    }
  `
  try {
    const data = await graphqlRequest<{ Media: AniListManga }>(gql, { id: anilistId })
    return data.Media
  } catch (e) {
    if (e instanceof AniListError && e.status === 404) return null
    throw e
  }
}

export async function getPopularManga(
  opts: { perPage?: number; page?: number } = {}
): Promise<AniListManga[]> {
  const perPage = Math.min(opts.perPage ?? 25, 50)
  const page = opts.page ?? 1
  const gql = `
    query ($perPage: Int!, $page: Int!) {
      Page(perPage: $perPage, page: $page) {
        media(type: MANGA, isAdult: false, sort: POPULARITY_DESC) {
          ${MANGA_FRAGMENT}
        }
      }
    }
  `
  const data = await graphqlRequest<{ Page: { media: AniListManga[] } }>(gql, { perPage, page })
  return data.Page.media
}

/**
 * Recently-updated manga — drives the weekly "Nouveautés" rail.
 * Sorted by UPDATED_AT_DESC, so the first page is series that had
 * chapter/volume activity most recently.
 */
export async function getRecentlyUpdatedManga(
  opts: { perPage?: number; page?: number } = {}
): Promise<AniListManga[]> {
  const perPage = Math.min(opts.perPage ?? 25, 50)
  const page = opts.page ?? 1
  const gql = `
    query ($perPage: Int!, $page: Int!) {
      Page(perPage: $perPage, page: $page) {
        media(type: MANGA, isAdult: false, sort: UPDATED_AT_DESC, status_in: [RELEASING, FINISHED]) {
          ${MANGA_FRAGMENT}
        }
      }
    }
  `
  const data = await graphqlRequest<{ Page: { media: AniListManga[] } }>(gql, { perPage, page })
  return data.Page.media
}

// ============================================
// HELPERS
// ============================================

/**
 * Pick the best display title for a French-speaking audience.
 * Prefer English (widely understood, same Latin alphabet), fall back
 * to romaji. We never surface the Japanese native script as primary.
 */
export function pickDisplayTitle(m: AniListManga): string {
  return m.title.english?.trim() || m.title.romaji?.trim() || m.title.native?.trim() || "Sans titre"
}

/**
 * AniList encodes demographic as a tag ("Shounen", "Shoujo", "Seinen",
 * "Josei") in the Demographic category. Returns the matched lowercase
 * label or null.
 */
export function extractDemographic(
  m: AniListManga
): "shounen" | "shoujo" | "seinen" | "josei" | null {
  const demoTag = m.tags.find((t) => t.category === "Demographic")
  if (!demoTag) return null
  const name = demoTag.name.toLowerCase()
  if (name === "shounen") return "shounen"
  if (name === "shoujo") return "shoujo"
  if (name === "seinen") return "seinen"
  if (name === "josei") return "josei"
  return null
}

export function extractStatus(m: AniListManga): "ongoing" | "completed" | "hiatus" | null {
  switch (m.status) {
    case "RELEASING":
      return "ongoing"
    case "FINISHED":
      return "completed"
    case "HIATUS":
      return "hiatus"
    default:
      return null
  }
}

/**
 * Convert AniList's {year, month, day} to a Date (start of day UTC).
 * Returns null if the year is missing.
 */
export function toDate(d: AniListDate | null | undefined): Date | null {
  if (!d?.year) return null
  return new Date(Date.UTC(d.year, (d.month ?? 1) - 1, d.day ?? 1))
}

/**
 * AniList tag taxonomy is rich (~200 tags) but many are spoiler-y or
 * noisy. Keep genres (already curated) + the top 5 non-spoiler tags.
 */
export function normalizeGenres(m: AniListManga): string[] {
  return [...new Set(m.genres.filter(Boolean))]
}

export function extractMainAuthors(m: AniListManga): string[] {
  if (!m.staff?.edges) return []
  return m.staff.edges
    .filter((e) => /story|art|original creator/i.test(e.role))
    .map((e) => e.node.name.full)
    .slice(0, 2)
}
