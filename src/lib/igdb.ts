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
  age_ratings?: {
    id: number
    category: number // 1 = ESRB, 2 = PEGI
    rating: number
  }[]
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

// IGDB PEGI rating values
const PEGI_RATINGS: Record<number, { label: string; age: number; internal: string }> = {
  1: { label: "PEGI 3", age: 3, internal: "PEGI_3" },
  2: { label: "PEGI 7", age: 7, internal: "PEGI_7" },
  3: { label: "PEGI 12", age: 12, internal: "PEGI_12" },
  4: { label: "PEGI 16", age: 16, internal: "PEGI_16" },
  5: { label: "PEGI 18", age: 18, internal: "PEGI_18" },
}

/**
 * Extract PEGI rating from age_ratings array
 */
export function getPegiRating(ageRatings?: IGDBGame["age_ratings"]): {
  label: string
  age: number
  internal: string
} | null {
  if (!ageRatings) return null

  // Category 2 = PEGI
  const pegi = ageRatings.find((r) => r.category === 2)
  if (!pegi) return null

  return PEGI_RATINGS[pegi.rating] || null
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
           age_ratings.category, age_ratings.rating,
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
           age_ratings.category, age_ratings.rating,
           involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
           themes.name,
           game_modes.name,
           total_rating, total_rating_count;
    where id = ${safeId};
  `

  const results = await igdbFetch<IGDBGame[]>("/games", body)
  return results[0] || null
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
           age_ratings.category, age_ratings.rating,
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
           age_ratings.category, age_ratings.rating,
           total_rating, total_rating_count;
    where age_ratings.category = 2 & age_ratings.rating = (1,2) & cover != null & platforms = ${CONSOLE_FILTER} & total_rating_count > 50;
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
           age_ratings.category, age_ratings.rating,
           total_rating, total_rating_count;
    where first_release_date > ${sixMonthsAgo} & first_release_date < ${now} & cover != null & platforms = ${CONSOLE_FILTER} & total_rating_count > 20;
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
           age_ratings.category, age_ratings.rating,
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
               age_ratings.category, age_ratings.rating,
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
             age_ratings.category, age_ratings.rating,
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
           age_ratings.category, age_ratings.rating,
           involved_companies.company.name, involved_companies.developer,
           themes.name,
           total_rating, total_rating_count;
    where total_rating > 85 & total_rating_count > 200 & cover != null & platforms = ${CONSOLE_FILTER};
    sort total_rating desc;
    limit ${safeLimit};
  `

  return igdbFetch<IGDBGame[]>("/games", body)
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
           age_ratings.category, age_ratings.rating,
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
  const pegi = getPegiRating(game.age_ratings)
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
    expertAgeRec: pegi?.age || null,
    genres: game.genres?.map((g) => g.name) || [],
    platforms: normalizePlatforms(game.platforms),
    developer: developer?.company.name || null,
    publisher: publisher?.company.name || null,
    themes: game.themes?.map((t) => t.name) || [],
    gameModes: game.game_modes?.map((m) => m.name) || [],
    rating: game.total_rating ? game.total_rating / 20 : null, // Convert 0-100 to 0-5
    ratingCount: game.total_rating_count || 0,
  }
}

