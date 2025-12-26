/**
 * TMDB (The Movie Database) API Integration
 * 
 * Get your free API key at: https://www.themoviedb.org/settings/api
 * - Create an account
 * - Go to Settings → API
 * - Request an API key (free for non-commercial use)
 * 
 * TMDB has excellent French support:
 * - French titles (title vs original_title)
 * - French synopses (overview)
 * - French release dates
 * - French certifications (CSA ratings)
 */

const TMDB_BASE_URL = "https://api.themoviedb.org/3"
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p"

// Image sizes available
export const ImageSize = {
  poster: {
    small: "w185",
    medium: "w342",
    large: "w500",
    original: "original",
  },
  backdrop: {
    small: "w300",
    medium: "w780",
    large: "w1280",
    original: "original",
  },
} as const

interface TMDBConfig {
  apiKey: string
  language?: string
  region?: string
}

const defaultConfig: Omit<TMDBConfig, "apiKey"> = {
  language: "fr-FR", // French language for all content
  region: "FR", // France region for release dates & certifications
}

// Helper to build image URLs
export function getImageUrl(
  path: string | null,
  size: string = ImageSize.poster.medium
): string {
  if (!path) return "/placeholder-poster.jpg"
  return `${TMDB_IMAGE_BASE}/${size}${path}`
}

// Generic fetch helper
async function tmdbFetch<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const apiKey = process.env.TMDB_API_KEY
  
  if (!apiKey) {
    throw new Error("TMDB_API_KEY is not configured. Get one at https://www.themoviedb.org/settings/api")
  }

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`)
  url.searchParams.set("api_key", apiKey)
  url.searchParams.set("language", defaultConfig.language!)
  url.searchParams.set("region", defaultConfig.region!)
  
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  const response = await fetch(url.toString(), {
    next: { revalidate: 3600 }, // Cache for 1 hour
  })

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// ============================================
// MOVIE TYPES
// ============================================

export interface TMDBMovie {
  id: number
  title: string // French title
  original_title: string
  overview: string // French synopsis
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  vote_average: number
  vote_count: number
  genre_ids: number[]
  adult: boolean
  popularity: number
}

export interface TMDBMovieDetails extends Omit<TMDBMovie, "genre_ids"> {
  genres: { id: number; name: string }[]
  runtime: number // minutes
  status: string
  tagline: string
  budget: number
  revenue: number
  production_countries: { iso_3166_1: string; name: string }[]
  spoken_languages: { iso_639_1: string; name: string }[]
  credits?: {
    cast: TMDBCastMember[]
    crew: TMDBCrewMember[]
  }
  release_dates?: {
    results: {
      iso_3166_1: string
      release_dates: {
        certification: string // CSA rating for FR
        release_date: string
        type: number
      }[]
    }[]
  }
}

export interface TMDBCastMember {
  id: number
  name: string
  character: string
  profile_path: string | null
  order: number
}

export interface TMDBCrewMember {
  id: number
  name: string
  job: string
  department: string
  profile_path: string | null
}

export interface TMDBSearchResult<T> {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}

// ============================================
// TV SHOW TYPES
// ============================================

export interface TMDBTVShow {
  id: number
  name: string // French title
  original_name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string
  vote_average: number
  vote_count: number
  genre_ids: number[]
  popularity: number
}

export interface TMDBTVDetails extends Omit<TMDBTVShow, "genre_ids"> {
  genres: { id: number; name: string }[]
  episode_run_time: number[]
  number_of_episodes: number
  number_of_seasons: number
  status: string
  type: string
  created_by: { id: number; name: string }[]
  networks: { id: number; name: string; logo_path: string }[]
  content_ratings?: {
    results: {
      iso_3166_1: string
      rating: string // CSA rating for FR
    }[]
  }
}

// ============================================
// API FUNCTIONS - MOVIES
// ============================================

/**
 * Search for movies in French
 */
export async function searchMovies(query: string, page = 1) {
  return tmdbFetch<TMDBSearchResult<TMDBMovie>>("/search/movie", {
    query,
    page: page.toString(),
    include_adult: "false",
  })
}

/**
 * Get movie details with French content and CSA certification
 */
export async function getMovieDetails(movieId: number): Promise<TMDBMovieDetails> {
  return tmdbFetch<TMDBMovieDetails>(`/movie/${movieId}`, {
    append_to_response: "credits,release_dates",
  })
}

/**
 * Get popular movies in France
 */
export async function getPopularMovies(page = 1) {
  return tmdbFetch<TMDBSearchResult<TMDBMovie>>("/movie/popular", {
    page: page.toString(),
  })
}

/**
 * Get movies now playing in French cinemas
 */
export async function getNowPlayingMovies(page = 1) {
  return tmdbFetch<TMDBSearchResult<TMDBMovie>>("/movie/now_playing", {
    page: page.toString(),
  })
}

/**
 * Get upcoming movies in France
 */
export async function getUpcomingMovies(page = 1) {
  return tmdbFetch<TMDBSearchResult<TMDBMovie>>("/movie/upcoming", {
    page: page.toString(),
  })
}

/**
 * Get top rated movies
 */
export async function getTopRatedMovies(page = 1) {
  return tmdbFetch<TMDBSearchResult<TMDBMovie>>("/movie/top_rated", {
    page: page.toString(),
  })
}

/**
 * Discover movies with filters (great for family-friendly content)
 */
export async function discoverMovies(options: {
  page?: number
  with_genres?: string // comma-separated genre IDs
  certification_country?: string
  certification?: string // e.g., "U" for all audiences
  "certification.lte"?: string
  sort_by?: string
  "vote_average.gte"?: string
  year?: string
}) {
  const params: Record<string, string> = {}
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      params[key] = value.toString()
    }
  })
  
  return tmdbFetch<TMDBSearchResult<TMDBMovie>>("/discover/movie", params)
}

// ============================================
// API FUNCTIONS - TV SHOWS
// ============================================

/**
 * Search for TV shows in French
 */
export async function searchTVShows(query: string, page = 1) {
  return tmdbFetch<TMDBSearchResult<TMDBTVShow>>("/search/tv", {
    query,
    page: page.toString(),
  })
}

/**
 * Get TV show details with French content
 */
export async function getTVDetails(tvId: number): Promise<TMDBTVDetails> {
  return tmdbFetch<TMDBTVDetails>(`/tv/${tvId}`, {
    append_to_response: "content_ratings,credits",
  })
}

/**
 * Get popular TV shows
 */
export async function getPopularTVShows(page = 1) {
  return tmdbFetch<TMDBSearchResult<TMDBTVShow>>("/tv/popular", {
    page: page.toString(),
  })
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract French CSA certification from movie release dates
 */
export function getFrenchCertification(
  releaseDates?: TMDBMovieDetails["release_dates"]
): string | null {
  if (!releaseDates) return null
  
  const frRelease = releaseDates.results.find((r) => r.iso_3166_1 === "FR")
  if (!frRelease) return null
  
  // Find theatrical or general release
  const certification = frRelease.release_dates.find(
    (rd) => rd.certification && rd.certification !== ""
  )
  
  return certification?.certification || null
}

/**
 * Extract French CSA rating from TV content ratings
 */
export function getTVFrenchRating(
  contentRatings?: TMDBTVDetails["content_ratings"]
): string | null {
  if (!contentRatings) return null
  
  const frRating = contentRatings.results.find((r) => r.iso_3166_1 === "FR")
  return frRating?.rating || null
}

/**
 * Get director from crew
 */
export function getDirector(credits?: TMDBMovieDetails["credits"]): string | null {
  if (!credits) return null
  
  const director = credits.crew.find((c) => c.job === "Director")
  return director?.name || null
}

/**
 * Convert TMDB certification to our internal format
 */
export function mapCertificationToInternal(cert: string | null): string {
  if (!cert) return "TOUS_PUBLICS"
  
  const certMap: Record<string, string> = {
    "U": "TOUS_PUBLICS",
    "TP": "TOUS_PUBLICS",
    "10": "CSA_10",
    "12": "CSA_12",
    "16": "CSA_16",
    "18": "CSA_18",
  }
  
  return certMap[cert] || "TOUS_PUBLICS"
}

/**
 * Movie genre IDs (for filtering)
 * These are TMDB's standard genre IDs
 */
export const MovieGenres = {
  ACTION: 28,
  ADVENTURE: 12,
  ANIMATION: 16,
  COMEDY: 35,
  CRIME: 80,
  DOCUMENTARY: 99,
  DRAMA: 18,
  FAMILY: 10751,
  FANTASY: 14,
  HISTORY: 36,
  HORROR: 27,
  MUSIC: 10402,
  MYSTERY: 9648,
  ROMANCE: 10749,
  SCIENCE_FICTION: 878,
  TV_MOVIE: 10770,
  THRILLER: 53,
  WAR: 10752,
  WESTERN: 37,
} as const

/**
 * TV genre IDs
 */
export const TVGenres = {
  ACTION_ADVENTURE: 10759,
  ANIMATION: 16,
  COMEDY: 35,
  CRIME: 80,
  DOCUMENTARY: 99,
  DRAMA: 18,
  FAMILY: 10751,
  KIDS: 10762,
  MYSTERY: 9648,
  NEWS: 10763,
  REALITY: 10764,
  SCIFI_FANTASY: 10765,
  SOAP: 10766,
  TALK: 10767,
  WAR_POLITICS: 10768,
  WESTERN: 37,
} as const

// ============================================
// WATCH PROVIDERS TYPES
// ============================================

export interface TMDBWatchProvider {
  logo_path: string
  provider_id: number
  provider_name: string
  display_priority: number
}

export interface TMDBWatchProviderResult {
  link?: string // JustWatch link
  flatrate?: TMDBWatchProvider[] // Subscription (Netflix, Disney+, etc.)
  rent?: TMDBWatchProvider[] // Rent (Google Play, Apple TV, etc.)
  buy?: TMDBWatchProvider[] // Buy (Google Play, Apple TV, etc.)
  free?: TMDBWatchProvider[] // Free with ads
}

export interface TMDBWatchProvidersResponse {
  id: number
  results: Record<string, TMDBWatchProviderResult>
}

// ============================================
// VIDEOS TYPES
// ============================================

export interface TMDBVideo {
  id: string
  iso_639_1: string
  iso_3166_1: string
  key: string // YouTube key
  name: string
  site: string // "YouTube" or "Vimeo"
  size: number
  type: string // "Trailer", "Teaser", "Clip", "Featurette", etc.
  official: boolean
  published_at: string
}

export interface TMDBVideosResponse {
  id: number
  results: TMDBVideo[]
}

// ============================================
// API FUNCTIONS - WATCH PROVIDERS & VIDEOS
// ============================================

/**
 * Get watch providers for a movie (streaming platforms in France)
 * Data is provided by JustWatch
 */
export async function getMovieWatchProviders(movieId: number): Promise<TMDBWatchProviderResult | null> {
  try {
    const response = await tmdbFetch<TMDBWatchProvidersResponse>(`/movie/${movieId}/watch/providers`)
    // Return French providers or null
    return response.results?.FR || null
  } catch {
    return null
  }
}

/**
 * Get watch providers for a TV show (streaming platforms in France)
 */
export async function getTVWatchProviders(tvId: number): Promise<TMDBWatchProviderResult | null> {
  try {
    const response = await tmdbFetch<TMDBWatchProvidersResponse>(`/tv/${tvId}/watch/providers`)
    return response.results?.FR || null
  } catch {
    return null
  }
}

/**
 * Get videos for a movie (trailers, teasers, etc.)
 * Prioritizes French videos, falls back to English
 */
export async function getMovieVideos(movieId: number): Promise<TMDBVideo[]> {
  try {
    // First try French videos
    const frResponse = await tmdbFetch<TMDBVideosResponse>(`/movie/${movieId}/videos`)
    let videos = frResponse.results || []

    // If no French trailers, try English
    if (!videos.some(v => v.type === "Trailer")) {
      const enResponse = await tmdbFetch<TMDBVideosResponse>(`/movie/${movieId}/videos`, {
        language: "en-US"
      })
      // Add English videos that aren't duplicates
      const existingKeys = new Set(videos.map(v => v.key))
      const newVideos = (enResponse.results || []).filter(v => !existingKeys.has(v.key))
      videos = [...videos, ...newVideos]
    }

    return videos
  } catch {
    return []
  }
}

/**
 * Get videos for a TV show
 */
export async function getTVVideos(tvId: number): Promise<TMDBVideo[]> {
  try {
    const frResponse = await tmdbFetch<TMDBVideosResponse>(`/tv/${tvId}/videos`)
    let videos = frResponse.results || []

    if (!videos.some(v => v.type === "Trailer")) {
      const enResponse = await tmdbFetch<TMDBVideosResponse>(`/tv/${tvId}/videos`, {
        language: "en-US"
      })
      const existingKeys = new Set(videos.map(v => v.key))
      const newVideos = (enResponse.results || []).filter(v => !existingKeys.has(v.key))
      videos = [...videos, ...newVideos]
    }

    return videos
  } catch {
    return []
  }
}

/**
 * Get the best trailer from a list of videos
 * Prioritizes: Official Trailer > Trailer > Teaser
 */
export function getBestTrailer(videos: TMDBVideo[]): TMDBVideo | null {
  if (!videos.length) return null

  // Prefer official trailers
  const officialTrailer = videos.find(v => v.type === "Trailer" && v.official && v.site === "YouTube")
  if (officialTrailer) return officialTrailer

  // Then any trailer
  const anyTrailer = videos.find(v => v.type === "Trailer" && v.site === "YouTube")
  if (anyTrailer) return anyTrailer

  // Then teaser
  const teaser = videos.find(v => v.type === "Teaser" && v.site === "YouTube")
  if (teaser) return teaser

  // Fallback to first YouTube video
  return videos.find(v => v.site === "YouTube") || null
}

/**
 * Get provider logo URL
 */
export function getProviderLogoUrl(logoPath: string, size: "w45" | "w92" | "w154" | "original" = "w92"): string {
  return `${TMDB_IMAGE_BASE}/${size}${logoPath}`
}



