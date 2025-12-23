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
 * Make authenticated request to IGDB
 */
async function igdbFetch<T>(endpoint: string, body: string): Promise<T> {
  const token = await getAccessToken()
  const clientId = process.env.IGDB_CLIENT_ID!

  const response = await fetch(`${IGDB_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body,
  })

  if (!response.ok) {
    throw new Error(`IGDB API error: ${response.status}`)
  }

  return response.json()
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
// API FUNCTIONS
// ============================================

/**
 * Search for games
 * Query is escaped to prevent IGDB query injection
 */
export async function searchGames(query: string, limit = 50): Promise<IGDBGame[]> {
  // Sanitize and escape user input
  const safeQuery = escapeIGDBQuery(query)
  const safeLimit = sanitizeNumber(limit, 1, 500) || 50

  if (!safeQuery) {
    return []
  }

  const body = `
    search "${safeQuery}";
    fields name, summary, cover.url, cover.image_id, first_release_date,
           genres.name, platforms.name, platforms.abbreviation,
           age_ratings.category, age_ratings.rating,
           total_rating, total_rating_count;
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
 * Get popular games
 */
export async function getPopularGames(limit = 100): Promise<IGDBGame[]> {
  const safeLimit = sanitizeNumber(limit, 1, 500) || 100

  const body = `
    fields name, summary, cover.url, cover.image_id, first_release_date,
           genres.name, platforms.name, platforms.abbreviation,
           age_ratings.category, age_ratings.rating,
           total_rating, total_rating_count;
    where total_rating_count > 50 & cover != null;
    sort total_rating desc;
    limit ${safeLimit};
  `

  return igdbFetch<IGDBGame[]>("/games", body)
}

/**
 * Get family-friendly games (PEGI 3 or PEGI 7)
 */
export async function getFamilyGames(limit = 100): Promise<IGDBGame[]> {
  const safeLimit = sanitizeNumber(limit, 1, 500) || 100

  const body = `
    fields name, summary, cover.url, cover.image_id, first_release_date,
           genres.name, platforms.name, platforms.abbreviation,
           age_ratings.category, age_ratings.rating,
           total_rating, total_rating_count;
    where age_ratings.category = 2 & age_ratings.rating = (1,2) & cover != null;
    sort total_rating desc;
    limit ${safeLimit};
  `

  return igdbFetch<IGDBGame[]>("/games", body)
}

/**
 * Get recently released games
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
    where first_release_date > ${sixMonthsAgo} & first_release_date < ${now} & cover != null;
    sort first_release_date desc;
    limit ${safeLimit};
  `

  return igdbFetch<IGDBGame[]>("/games", body)
}

// ============================================
// TRANSFORM HELPERS
// ============================================

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
    posterUrl: getIGDBImageUrl(game.cover?.image_id, "medium"),
    releaseDate: game.first_release_date
      ? new Date(game.first_release_date * 1000).toISOString().split("T")[0]
      : null,
    officialRating: pegi?.internal || null,
    expertAgeRec: pegi?.age || null,
    genres: game.genres?.map((g) => g.name) || [],
    platforms: game.platforms?.map((p) => p.name) || [],
    developer: developer?.company.name || null,
    publisher: publisher?.company.name || null,
    themes: game.themes?.map((t) => t.name) || [],
    gameModes: game.game_modes?.map((m) => m.name) || [],
    rating: game.total_rating ? game.total_rating / 20 : null, // Convert 0-100 to 0-5
    ratingCount: game.total_rating_count || 0,
  }
}

