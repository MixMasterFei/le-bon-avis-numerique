/**
 * IGDB (Internet Game Database) API Integration
 * Owned by Twitch/Amazon - Free with attribution
 *
 * Setup:
 * 1. Create a Twitch account: https://dev.twitch.tv/console
 * 2. Register an application
 * 3. Get Client ID and Client Secret
 * 4. Add to environment variables:
 *    - IGDB_CLIENT_ID
 *    - IGDB_CLIENT_SECRET
 *
 * Documentation: https://api-docs.igdb.com/
 */

import { escapeIGDBQuery, sanitizeNumber } from "./security"
import { isUnreleasedStatus } from "./release-status"
import { normalizeGameGenres } from "./igdb-genres"
import { extractPegiDescriptors, type IGDBAgeRatingEntry } from "./pegi-descriptors"

const IGDB_BASE_URL = "https://api.igdb.com/v4"
const TWITCH_AUTH_URL = "https://id.twitch.tv/oauth2/token"

// Cache for access token
let accessToken: string | null = null
let tokenExpiry: number = 0

/**
 * Get OAuth2 access token from Twitch
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken
  }

  const clientId = process.env.IGDB_CLIENT_ID
  const clientSecret = process.env.IGDB_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      "IGDB credentials not configured. Get them at https://dev.twitch.tv/console"
    )
  }

  const response = await fetch(
    `${TWITCH_AUTH_URL}?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  )

  if (!response.ok) {
    throw new Error("Failed to authenticate with Twitch/IGDB")
  }

  const data = await response.json()
  accessToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000 // Refresh 1 min early

  return accessToken!
}

/**
 * Make authenticated request to IGDB with timeout
 */
async function igdbFetch<T>(endpoint: string, body: string): Promise<T> {
  const token = await getAccessToken()
  const clientId = process.env.IGDB_CLIENT_ID!

  // Add timeout using AbortController
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

  try {
    const response = await fetch(`${IGDB_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`IGDB API error: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("IGDB request timeout")
    }
    throw error
  }
}

// ============================================
// TYPES
// ============================================

export interface IGDBGame {
  id: number
  name: string
  summary?: string
  storyline?: string
  cover?: {
    id: number
    url: string
    image_id: string
  }
  first_release_date?: number // Unix timestamp
  genres?: { id: number; name: string }[]
  platforms?: { id: number; name: string; abbreviation: string }[]
  age_ratings?: IGDBAgeRatingEntry[]
  involved_companies?: {
    id: number
    company: { id: number; name: string }
    developer: boolean
    publisher: boolean
  }[]
  total_rating?: number
  total_rating_count?: number
  themes?: { id: number; name: string }[]
  game_modes?: { id: number; name: string }[]
  player_perspectives?: { id: number; name: string }[]
  keywords?: { id: number; name: string }[]
  url?: string
}

export interface IGDBSearchResult {
  id: number
  name: string
  cover?: { url: string; image_id: string }
  first_release_date?: number
  total_rating?: number
}

// ============================================
// PEGI RATING MAPPING
// ============================================

/**
 * Shared IGDB fields fragment for PEGI age + content descriptors.
 *
 * NOTE: `age_ratings.rating_content_descriptions` resolves to IGDB's
 * AgeRatingContentDescriptionV2 object, which has NO `category` field (only
 * `description`/`organization`) — requesting `.category` made IGDB reject the
 * whole query with HTTP 400, breaking every game fetch (import cron, search,
 * detail). We read the `description` text and map it in `extractPegiDescriptors`.
 * The legacy `category`/`rating` enum fields are deprecated but still queryable.
 */
const IGDB_AGE_RATING_FIELDS =
  "age_ratings.category, age_ratings.rating, age_ratings.organization, age_ratings.rating_category, age_ratings.rating_content_descriptions.description"

type PegiBand = { label: string; age: number; internal: string }

const PEGI_3: PegiBand = { label: "PEGI 3", age: 3, internal: "PEGI_3" }
const PEGI_7: PegiBand = { label: "PEGI 7", age: 7, internal: "PEGI_7" }
const PEGI_12: PegiBand = { label: "PEGI 12", age: 12, internal: "PEGI_12" }
const PEGI_16: PegiBand = { label: "PEGI 16", age: 16, internal: "PEGI_16" }
const PEGI_18: PegiBand = { label: "PEGI 18", age: 18, internal: "PEGI_18" }

// Legacy `rating` enum (used with the old `category === 2` PEGI marker): 1–5.
const PEGI_LEGACY_RATING: Record<number, PegiBand> = {
  1: PEGI_3,
  2: PEGI_7,
  3: PEGI_12,
  4: PEGI_16,
  5: PEGI_18,
}

// Post-2025 migration: IGDB replaced the per-org `rating` enum with a GLOBAL
// `rating_category` (AgeRatingCategory) enum where each organization owns a
// contiguous block. PEGI's block is 8–12. Verified against live IGDB data
// (e.g. The Witcher 3 = organization 2 / rating_category 12 = PEGI 18, with
// ESRB M = 6, USK 18 = 22, CERO Z = 17 all consistent with this layout).
const PEGI_RATING_CATEGORY: Record<number, PegiBand> = {
  8: PEGI_3,
  9: PEGI_7,
  10: PEGI_12,
  11: PEGI_16,
  12: PEGI_18,
}

function pegiFromEntry(entry: IGDBAgeRatingEntry): PegiBand | null {
  // Legacy: category 2 (= PEGI org) + rating 1–5
  if (entry.category === 2 && entry.rating) {
    return PEGI_LEGACY_RATING[entry.rating] ?? null
  }
  // v4: organization 2 (PEGI) + rating_category in the global 8–12 PEGI block
  if (entry.organization === 2 && entry.rating_category) {
    return PEGI_RATING_CATEGORY[entry.rating_category] ?? null
  }
  return null
}

export interface PegiInfo {
  label: string
  age: number
  internal: string
  descriptors: string[]
}

/**
 * Full PEGI info: age band + French content-descriptor labels.
 */
export function getPegiInfo(ageRatings?: IGDBAgeRatingEntry[] | null): PegiInfo | null {
  if (!ageRatings?.length) return null
  const pegiEntry = ageRatings.find(
    (r) => r.category === 2 || r.organization === 2,
  )
  if (!pegiEntry) return null
  const base = pegiFromEntry(pegiEntry)
  if (!base) return null
  return {
    ...base,
    descriptors: extractPegiDescriptors(ageRatings),
  }
}

/**
 * Extract PEGI rating from age_ratings array (age band only).
 */
export function getPegiRating(ageRatings?: IGDBAgeRatingEntry[] | null): {
  label: string
  age: number
  internal: string
} | null {
  return getPegiInfo(ageRatings)
}

// ============================================
// IMAGE HELPERS
// ============================================

export const IGDBImageSize = {
  thumb: "t_thumb", // 90x90
  small: "t_cover_small", // 90x128
  medium: "t_cover_big", // 264x374
  large: "t_720p", // 720p
  hd: "t_1080p", // 1080p
} as const

/**
 * Get full image URL from IGDB image_id
 */
export function getIGDBImageUrl(
  imageId: string | undefined,
  size: keyof typeof IGDBImageSize = "medium"
): string {
  if (!imageId) return "/placeholder-game.jpg"
  return `https://images.igdb.com/igdb/image/upload/${IGDBImageSize[size]}/${imageId}.jpg`
}

// ============================================
// PLATFORM PRIORITIES
// ============================================

// Priority 1: Console platforms only (no PC/Mac to avoid indie flood)
// Platform IDs from IGDB
const CONSOLE_PLATFORM_IDS = [
  130, // Nintendo Switch
  167, // PlayStation 5
  48,  // PlayStation 4
  169, // Xbox Series X|S
  49,  // Xbox One
]

// All modern platforms including PC/Mac (for search only)
const ALL_PLATFORM_IDS = [
  ...CONSOLE_PLATFORM_IDS,
  6,   // PC (Windows)
  14,  // Mac
]

// Minimum rating count to filter out obscure/indie games
const MIN_RATING_COUNT = 100

// Platform filter for queries - consoles only for browsing
const CONSOLE_FILTER = `(${CONSOLE_PLATFORM_IDS.join(",")})`
// All platforms for search (includes PC/Mac)
const ALL_PLATFORM_FILTER = `(${ALL_PLATFORM_IDS.join(",")})`

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Search for games
 * Query is escaped to prevent IGDB query injection
 * No rating filter to allow finding new/recent games (FIFA 25, etc.)
 */
export async function searchGames(query: string, limit = 50): Promise<IGDBGame[]> {
  // Sanitize and escape user input
  const safeQuery = escapeIGDBQuery(query)
  const safeLimit = sanitizeNumber(limit, 1, 500) || 50

  if (!safeQuery) {
    return []
  }

  // No rating filter - allows finding new games that haven't been rated yet
  const body = `
    search "${safeQuery}";
    fields name, summary, cover.url, cover.image_id, first_release_date,
           genres.name, platforms.name, platforms.abbreviation,
           ${IGDB_AGE_RATING_FIELDS},
           involved_companies.company.name, involved_companies.developer,
           total_rating, total_rating_count;
    where platforms = ${ALL_PLATFORM_FILTER};
    limit ${safeLimit};
  `

  return igdbFetch<IGDBGame[]>("/games", body)
}

/**
 * Get game details by ID
 * ID is validated to prevent injection
 */
export async function getGameDetails(gameId: number): Promise<IGDBGame | null> {
  // Validate gameId is a positive integer
  const safeId = sanitizeNumber(gameId, 1)
  if (!safeId) {
    return null
  }

  const body = `
    fields name, summary, storyline, url,
           cover.url, cover.image_id,
           first_release_date,
           genres.name,
           platforms.name, platforms.abbreviation,
           ${IGDB_AGE_RATING_FIELDS},
           involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
           themes.name,
           game_modes.name,
           player_perspectives.name,
           keywords.name,
           total_rating, total_rating_count;
    where id = ${safeId};
  `

  const results = await igdbFetch<IGDBGame[]>("/games", body)
  return results[0] || null
}

/**
 * IGDB lifecycle values (`GameStatusEnum`) that mean "the public cannot play
 * this yet" — the game equivalent of TMDB's Planned / In Production.
 *
 * Deliberately NARROW. `early_access` (4) is excluded: an early-access game is
 * publicly purchasable and played by thousands (Voices of the Void is in our
 * catalogue), so gating its content analysis would hide a review of something
 * people are actively playing. `offline` (5), `cancelled` (6) and `delisted`
 * (8) are excluded for the opposite reason — they describe a game that WAS
 * released. Only alpha, beta and rumored mean "not yet playable".
 */
export const IGDB_UNRELEASED_STATUSES: Record<number, string> = {
  2: "alpha",
  3: "beta",
  7: "rumored",
}

// The values written here land in `releaseStatus`, which the display gate
// reads via `isUnreleasedStatus` (see UNRELEASED_IGDB_STATUSES in
// release-status.ts). If the two lists ever drift, a game would be marked
// unreleased and still show its content analysis — pinned by a test.

/**
 * Fetch a game's release lifecycle, or null if unknown.
 *
 * Runs as its OWN request rather than joining `game_status` onto the existing
 * field lists, and swallows every error. That is the whole point: IGDB rejects
 * an ENTIRE query when it contains one unrecognised field — the same failure
 * this file already documents for `age_ratings.category`. `status` is
 * deprecated in favour of `game_status`, and which one a given API version
 * accepts is not something we can assume. Isolating the call means a wrong or
 * withdrawn field name costs us this one lookup instead of taking down every
 * game import.
 *
 * Tries `game_status` first, falls back to the legacy `status`.
 */
export async function getGameReleaseStatus(gameId: number): Promise<string | null> {
  const safeId = sanitizeNumber(gameId, 1)
  if (!safeId) return null

  for (const field of ["game_status", "status"] as const) {
    try {
      const results = await igdbFetch<Array<Record<string, unknown>>>(
        "/games",
        `fields ${field}; where id = ${safeId};`,
      )
      const raw = results?.[0]?.[field]
      // `game_status` may come back as a bare enum id or as an expanded
      // object; the legacy `status` is always a number.
      const code =
        typeof raw === "number"
          ? raw
          : typeof raw === "object" && raw !== null && typeof (raw as { id?: unknown }).id === "number"
            ? (raw as { id: number }).id
            : null
      if (code === null) continue
      return IGDB_UNRELEASED_STATUSES[code] ?? "released"
    } catch {
      // Unknown field / transport error — try the next spelling.
    }
  }
  return null
}

/** True when a value from `getGameReleaseStatus` means "not playable yet". */
export function isUnreleasedGameStatus(status?: string | null): boolean {
  return isUnreleasedStatus(status)
}

/**
 * Get popular games on console platforms (Switch, PS4/5, Xbox One/Series)
 * Excludes PC/Mac indie games, requires high rating count for mainstream appeal
 */
export async function getPopularGames(limit = 100): Promise<IGDBGame[]> {
  const safeLimit = sanitizeNumber(limit, 1, 500) || 100

  const body = `
    fields name, summary, cover.url, cover.image_id, first_release_date,
           genres.name, platforms.name, platforms.abbreviation,
           ${IGDB_AGE_RATING_FIELDS},
           total_rating, total_rating_count;
    where total_rating_count > ${MIN_RATING_COUNT} & cover != null & platforms = ${CONSOLE_FILTER};
    sort total_rating desc;
    limit ${safeLimit};
  `

  return igdbFetch<IGDBGame[]>("/games", body)
}

/**
 * Get family-friendly games (PEGI 3 or PEGI 7) on console platforms
 * Requires minimum rating count to ensure mainstream games only
 */
export async function getFamilyGames(limit = 100): Promise<IGDBGame[]> {
  const safeLimit = sanitizeNumber(limit, 1, 500) || 100

  const body = `
    fields name, summary, cover.url, cover.image_id, first_release_date,
           genres.name, platforms.name, platforms.abbreviation,
           ${IGDB_AGE_RATING_FIELDS},
           total_rating, total_rating_count;
    where age_ratings.organization = 2 & age_ratings.rating_category = (8,9) & cover != null & platforms = ${CONSOLE_FILTER} & total_rating_count > 50;
    sort total_rating desc;
    limit ${safeLimit};
  `

  return igdbFetch<IGDBGame[]>("/games", body)
}

/**
 * Get recently released games on console platforms
 * Requires minimum rating count to filter out obscure releases
 */
export async function getRecentGames(limit = 100): Promise<IGDBGame[]> {
  const safeLimit = sanitizeNumber(limit, 1, 500) || 100
  const now = Math.floor(Date.now() / 1000)
  const sixMonthsAgo = now - 6 * 30 * 24 * 60 * 60

  const body = `
    fields name, summary, cover.url, cover.image_id, first_release_date,
           genres.name, platforms.name, platforms.abbreviation,
           ${IGDB_AGE_RATING_FIELDS},
           total_rating, total_rating_count;
    where first_release_date > ${sixMonthsAgo} & first_release_date < ${now} & cover != null & platforms = ${CONSOLE_FILTER} & total_rating_count > 20;
    sort first_release_date desc;
    limit ${safeLimit};
  `

  return igdbFetch<IGDBGame[]>("/games", body)
}

/**
 * Just-released console games, with a LOW popularity floor.
 *
 * `getRecentGames` requires `total_rating_count > 20` over a 6-month window,
 * which is the right gate for the catalogue at large but structurally blind to
 * the newest releases: IGDB rating counts accumulate over weeks, so a game
 * that shipped this month has almost none. That is why the daily import
 * reported "0 jeux importés (99 déjà en base)" for a month straight while
 * genuinely new titles piled up outside the catalogue.
 *
 * The window is deliberately tight (default 90 days) and the floor is a token
 * one: a handful of ratings is still enough to separate a real release from a
 * zero-signal asset flip, and `cover != null` + the console-platform filter do
 * most of the shovelware filtering already.
 */
export async function getFreshReleases(
  limit = 60,
  { days = 90, minRatingCount = 3 }: { days?: number; minRatingCount?: number } = {},
): Promise<IGDBGame[]> {
  const safeLimit = sanitizeNumber(limit, 1, 500) || 60
  const safeDays = sanitizeNumber(days, 1, 365) || 90
  const safeMin = sanitizeNumber(minRatingCount, 0, 1000) ?? 3
  const now = Math.floor(Date.now() / 1000)
  const since = now - safeDays * 24 * 60 * 60

  const body = `
    fields name, summary, cover.url, cover.image_id, first_release_date,
           genres.name, platforms.name, platforms.abbreviation,
           ${IGDB_AGE_RATING_FIELDS},
           involved_companies.company.name, involved_companies.developer,
           themes.name,
           total_rating, total_rating_count;
    where first_release_date > ${since} & first_release_date < ${now} & cover != null & platforms = ${CONSOLE_FILTER} & total_rating_count > ${safeMin};
    sort first_release_date desc;
    limit ${safeLimit};
  `

  return igdbFetch<IGDBGame[]>("/games", body)
}

// Platform IDs for specific platform queries
const PLATFORM_IDS = {
  SWITCH: 130,
  PS5: 167,
  PS4: 48,
  XBOX_SERIES: 169,
  XBOX_ONE: 49,
  PC: 6,
  MAC: 14,
}

/**
 * Get games for a specific platform
 * Requires higher rating count for mainstream games only
 */
export async function getGamesByPlatform(platformId: number, limit = 100): Promise<IGDBGame[]> {
  const safeLimit = sanitizeNumber(limit, 1, 500) || 100
  const safePlatformId = sanitizeNumber(platformId, 1)

  if (!safePlatformId) return []

  const body = `
    fields name, summary, cover.url, cover.image_id, first_release_date,
           genres.name, platforms.name, platforms.abbreviation,
           ${IGDB_AGE_RATING_FIELDS},
           involved_companies.company.name, involved_companies.developer,
           themes.name,
           total_rating, total_rating_count;
    where platforms = ${safePlatformId} & cover != null & total_rating_count > ${MIN_RATING_COUNT};
    sort total_rating desc;
    limit ${safeLimit};
  `

  return igdbFetch<IGDBGame[]>("/games", body)
}

/**
 * Get Nintendo Switch exclusives and popular Switch games
 */
export async function getSwitchGames(limit = 100): Promise<IGDBGame[]> {
  return getGamesByPlatform(PLATFORM_IDS.SWITCH, limit)
}

/**
 * Get PlayStation 5 games
 */
export async function getPS5Games(limit = 100): Promise<IGDBGame[]> {
  return getGamesByPlatform(PLATFORM_IDS.PS5, limit)
}

/**
 * Get PlayStation 4 games
 */
export async function getPS4Games(limit = 100): Promise<IGDBGame[]> {
  return getGamesByPlatform(PLATFORM_IDS.PS4, limit)
}

/**
 * Get Xbox Series X|S games
 */
export async function getXboxSeriesGames(limit = 100): Promise<IGDBGame[]> {
  return getGamesByPlatform(PLATFORM_IDS.XBOX_SERIES, limit)
}

/**
 * Get PC games
 */
export async function getPCGames(limit = 100): Promise<IGDBGame[]> {
  return getGamesByPlatform(PLATFORM_IDS.PC, limit)
}

/**
 * Search games by franchise/collection name (e.g., "Zelda", "Mario", "Pokemon")
 */
export async function getGamesByFranchise(franchiseName: string, limit = 100): Promise<IGDBGame[]> {
  const safeName = escapeIGDBQuery(franchiseName)
  const safeLimit = sanitizeNumber(limit, 1, 500) || 100

  if (!safeName) return []

  // First search for the franchise/collection
  const franchiseBody = `
    search "${safeName}";
    fields id, name, games;
    limit 5;
  `

  try {
    // Try franchises first
    const franchises = await igdbFetch<{ id: number; name: string; games?: number[] }[]>("/franchises", franchiseBody)

    if (franchises.length > 0 && franchises[0].games && franchises[0].games.length > 0) {
      const gameIds = franchises[0].games.slice(0, safeLimit)

      const gamesBody = `
        fields name, summary, cover.url, cover.image_id, first_release_date,
               genres.name, platforms.name, platforms.abbreviation,
               ${IGDB_AGE_RATING_FIELDS},
               involved_companies.company.name, involved_companies.developer,
               themes.name,
               total_rating, total_rating_count;
        where id = (${gameIds.join(",")}) & platforms = ${CONSOLE_FILTER};
        sort first_release_date desc;
        limit ${safeLimit};
      `

      return igdbFetch<IGDBGame[]>("/games", gamesBody)
    }

    // Fallback: search games directly with the name
    const searchBody = `
      search "${safeName}";
      fields name, summary, cover.url, cover.image_id, first_release_date,
             genres.name, platforms.name, platforms.abbreviation,
             ${IGDB_AGE_RATING_FIELDS},
             involved_companies.company.name, involved_companies.developer,
             themes.name,
             total_rating, total_rating_count;
      where platforms = ${CONSOLE_FILTER} & cover != null & total_rating_count > 20;
      limit ${safeLimit};
    `

    return igdbFetch<IGDBGame[]>("/games", searchBody)
  } catch {
    // If franchise search fails, fall back to regular search
    return searchGames(franchiseName, limit)
  }
}

/**
 * Get highly-rated games across console platforms
 * Stricter filters for mainstream appeal
 */
export async function getTopRatedGames(limit = 100): Promise<IGDBGame[]> {
  const safeLimit = sanitizeNumber(limit, 1, 500) || 100

  const body = `
    fields name, summary, cover.url, cover.image_id, first_release_date,
           genres.name, platforms.name, platforms.abbreviation,
           ${IGDB_AGE_RATING_FIELDS},
           involved_companies.company.name, involved_companies.developer,
           themes.name,
           total_rating, total_rating_count;
    where total_rating > 85 & total_rating_count > 200 & cover != null & platforms = ${CONSOLE_FILTER};
    sort total_rating desc;
    limit ${safeLimit};
  `

  return igdbFetch<IGDBGame[]>("/games", body)
}

// ============================================
// POPULARITY ("TENDANCE DU MOMENT")
// ============================================

// IGDB popularity_type IDs we treat as "trending right now". These are
// IGDB's own primitives:
//   2 = Want to Play, 3 = Playing.
// (1 = Visits and 4 = Played are noisier / lagging, so we skip them.)
// Each type's `value` is normalized within that type, so we merge by
// taking the max across types per game rather than summing.
const IGDB_TRENDING_TYPES = [2, 3] as const

/**
 * Returns IGDB game IDs trending right now, ordered most→least, paired
 * with a raw popularity value. Unlike `total_rating_count` (lifetime
 * notoriety) this reflects current activity, mirroring TMDB /trending.
 *
 * Hits the `/popularity_primitives` endpoint per type and merges by
 * game_id (max value wins). Resilient: a failing type is skipped, and an
 * empty result just yields `[]` so the caller can fall back gracefully.
 */
export async function getTrendingGameIds(
  limit = 100
): Promise<Array<{ gameId: number; value: number }>> {
  const safeLimit = sanitizeNumber(limit, 1, 500) || 100
  const best = new Map<number, number>()

  for (const type of IGDB_TRENDING_TYPES) {
    try {
      const body = `
        fields game_id, value, popularity_type;
        where popularity_type = ${type};
        sort value desc;
        limit ${safeLimit};
      `
      const rows = await igdbFetch<Array<{ game_id: number; value: number }>>(
        "/popularity_primitives",
        body
      )
      for (const r of rows) {
        if (typeof r.game_id !== "number" || typeof r.value !== "number") continue
        const prev = best.get(r.game_id)
        if (prev === undefined || r.value > prev) best.set(r.game_id, r.value)
      }
    } catch {
      // Skip this popularity type on error; other types still contribute.
    }
  }

  return [...best.entries()]
    .map(([gameId, value]) => ({ gameId, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, safeLimit)
}

// Export platform IDs for use in route
export { PLATFORM_IDS }

// ============================================
// SCREENSHOT HELPERS
// ============================================

export interface IGDBScreenshot {
  id: number
  game?: number
  url: string
  image_id: string
  width?: number
  height?: number
}

export const IGDBScreenshotSize = {
  thumb: "t_thumb",           // 90x90
  small: "t_screenshot_med",  // 569x320
  medium: "t_720p",           // 1280x720
  large: "t_1080p",           // 1920x1080
  original: "t_original",     // Original size
} as const

/**
 * Get full screenshot URL from IGDB image_id
 */
export function getIGDBScreenshotUrl(
  imageId: string | undefined,
  size: keyof typeof IGDBScreenshotSize = "medium"
): string {
  if (!imageId) return "/placeholder-game.jpg"
  return `https://images.igdb.com/igdb/image/upload/${IGDBScreenshotSize[size]}/${imageId}.jpg`
}

/**
 * Get screenshots for a game by IGDB game ID
 */
export async function getGameScreenshots(gameId: number, limit = 6): Promise<IGDBScreenshot[]> {
  const safeId = sanitizeNumber(gameId, 1)
  if (!safeId) return []

  const safeLimit = sanitizeNumber(limit, 1, 20) || 6

  const body = `
    fields game, url, image_id, width, height;
    where game = ${safeId};
    limit ${safeLimit};
  `

  const screenshots = await igdbFetch<IGDBScreenshot[]>("/screenshots", body)
  return screenshots
}

// ============================================
// COMPANY TYPES & API
// ============================================

export interface IGDBCompany {
  id: number
  name: string
  logo?: {
    id: number
    url: string
    image_id: string
  }
  developed?: number[] // Game IDs
  published?: number[] // Game IDs
  description?: string
  url?: string
}

/**
 * Search for game companies/studios (e.g., FromSoftware, Nintendo, Ubisoft)
 */
export async function searchCompanies(query: string, limit = 10): Promise<IGDBCompany[]> {
  const safeName = escapeIGDBQuery(query)
  const safeLimit = sanitizeNumber(limit, 1, 50) || 10

  if (!safeName) return []

  const body = `
    search "${safeName}";
    fields id, name, logo.image_id, logo.url, description, url;
    limit ${safeLimit};
  `

  return igdbFetch<IGDBCompany[]>("/companies", body)
}

/**
 * Get all games developed by a specific company
 */
export async function getGamesByCompany(companyId: number, limit = 50): Promise<IGDBGame[]> {
  const safeId = sanitizeNumber(companyId, 1)
  const safeLimit = sanitizeNumber(limit, 1, 100) || 50

  if (!safeId) return []

  const body = `
    fields name, summary, cover.url, cover.image_id, first_release_date,
           genres.name, platforms.name, platforms.abbreviation,
           ${IGDB_AGE_RATING_FIELDS},
           involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
           themes.name,
           total_rating, total_rating_count;
    where involved_companies.company = ${safeId} & involved_companies.developer = true & cover != null;
    sort first_release_date desc;
    limit ${safeLimit};
  `

  return igdbFetch<IGDBGame[]>("/games", body)
}

/**
 * Get company logo URL
 */
export function getCompanyLogoUrl(imageId: string | undefined, size: keyof typeof IGDBImageSize = "medium"): string {
  if (!imageId) return "/placeholder-company.png"
  return `https://images.igdb.com/igdb/image/upload/${IGDBImageSize[size]}/${imageId}.png`
}

// ============================================
// TRANSFORM HELPERS
// ============================================

// Normalize platform names for cleaner display
const PLATFORM_NAMES: Record<string, string> = {
  "Nintendo Switch": "Switch",
  "Nintendo Switch 2": "Switch 2",
  "PC (Microsoft Windows)": "PC",
  "PlayStation 4": "PS4",
  "PlayStation 5": "PS5",
  "Xbox One": "Xbox One",
  "Xbox Series X|S": "Xbox Series",
  "Mac": "Mac",
}

// Priority platforms to keep (modern consoles only - no mobile/Linux)
const PRIORITY_PLATFORMS = new Set([
  "Nintendo Switch",
  "Nintendo Switch 2",
  "PC (Microsoft Windows)",
  "PlayStation 4",
  "PlayStation 5",
  "Xbox One",
  "Xbox Series X|S",
  "Mac",
])

/**
 * Normalize and filter platforms to only modern ones
 */
export function normalizePlatforms(platforms: { name: string }[] | undefined): string[] {
  if (!platforms) return []

  return platforms
    .filter(p => PRIORITY_PLATFORMS.has(p.name))
    .map(p => PLATFORM_NAMES[p.name] || p.name)
}

/**
 * Transform IGDB game to our internal format
 */
export function transformGame(game: IGDBGame) {
  const pegi = getPegiInfo(game.age_ratings)
  const developer = game.involved_companies?.find((c) => c.developer)
  const publisher = game.involved_companies?.find((c) => c.publisher)

  return {
    id: game.id.toString(),
    igdbId: game.id,
    title: game.name,
    type: "GAME" as const,
    synopsisFr: game.summary || game.storyline || null,
    posterUrl: getIGDBImageUrl(game.cover?.image_id, "large"),
    releaseDate: game.first_release_date
      ? new Date(game.first_release_date * 1000).toISOString().split("T")[0]
      : null,
    officialRating: pegi?.internal || null,
    pegiDescriptors: pegi?.descriptors ?? [],
    expertAgeRec: pegi?.age || null,
    genres: normalizeGameGenres(game.genres?.map((g) => g.name) || []),
    platforms: normalizePlatforms(game.platforms),
    developer: developer?.company.name || null,
    publisher: publisher?.company.name || null,
    themes: game.themes?.map((t) => t.name) || [],
    gameModes: game.game_modes?.map((m) => m.name) || [],
    rating: game.total_rating ? game.total_rating / 20 : null, // Convert 0-100 to 0-5
    ratingCount: game.total_rating_count || 0,
  }
}

