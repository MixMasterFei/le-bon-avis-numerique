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

// Generic fetch helper with timeout
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

  // Let callers opt OUT of the language filter (e.g. to fetch images in ANY
  // language) by passing language:"" — without this it would send an empty
  // param. Used by getBestPosterPath's last-resort fallback.
  if (params.language === "") {
    url.searchParams.delete("language")
  }

  // Retry logic for rate limits (429)
  const maxRetries = 2

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const response = await fetch(url.toString(), {
        next: { revalidate: 3600 },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.status === 429) {
        // TMDB rate limit — wait and retry
        const retryAfter = parseInt(response.headers.get("Retry-After") || "2")
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, retryAfter * 1000))
          continue
        }
        throw new Error("TMDB rate limit exceeded after retries")
      }

      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status} ${response.statusText}`)
      }

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("TMDB request timeout after 10 seconds")
      }
      // On last attempt, throw; otherwise retry
      if (attempt >= maxRetries) throw error
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  throw new Error("TMDB fetch failed after retries")
}

// ============================================
// MOVIE TYPES
// ============================================

export interface TMDBMovie {
  id: number
  title: string // French title
  original_title: string
  original_language: string // ISO 639-1 code (en, fr, de, etc.)
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
  original_language: string // ISO 639-1 code (en, fr, de, etc.)
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
 * Get the movies trending RIGHT NOW (TMDB /trending, weekly window).
 *
 * Unlike `/movie/popular` (a slow-moving all-time-ish ranking) or our
 * stored `tmdbVoteCount` (lifetime accumulation), `/trending` reflects
 * what people are actually engaging with this week. This is the "du
 * moment" signal feeding the homepage hero rail. Trending is a global
 * endpoint (no `region` param), but `tmdbFetch` still sends `language`
 * so titles come back in French. `window` is "week" (steadier) or "day".
 */
export async function getTrendingMovies(window: "day" | "week" = "week", page = 1) {
  return tmdbFetch<TMDBSearchResult<TMDBMovie>>(`/trending/movie/${window}`, {
    page: page.toString(),
  })
}

/**
 * Get the TV shows trending RIGHT NOW. See `getTrendingMovies`.
 */
export async function getTrendingTVShows(window: "day" | "week" = "week", page = 1) {
  return tmdbFetch<TMDBSearchResult<TMDBTVShow>>(`/trending/tv/${window}`, {
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
 * Get upcoming movies for a region (default France). `region=FR` makes TMDB
 * return titles by their French theatrical window — the forward-looking slate
 * we want fiches ranking for before the première.
 */
export async function getUpcomingMovies(page = 1, region = "FR") {
  return tmdbFetch<TMDBSearchResult<TMDBMovie>>("/movie/upcoming", {
    page: page.toString(),
    region,
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
  "vote_count.gte"?: string
  year?: string
  primary_release_year?: number
  "primary_release_date.gte"?: string
  "primary_release_date.lte"?: string
  with_original_language?: string
}) {
  const params: Record<string, string> = {}
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      params[key] = value.toString()
    }
  })
  // Family-guide guard: never surface adult titles from discover (TMDB defaults
  // to false, but pin it so a future param change can't flip it on).
  params.include_adult = "false"

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

/**
 * Discover TV shows with filters (e.g. the Kids genre for pre-school series).
 */
export async function discoverTVShows(options: {
  page?: number
  with_genres?: string // comma-separated genre IDs
  sort_by?: string
  "vote_count.gte"?: string
  with_original_language?: string
  "first_air_date.gte"?: string
}) {
  const params: Record<string, string> = {}
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) params[key] = value.toString()
  })
  params.include_adult = "false"
  return tmdbFetch<TMDBSearchResult<TMDBTVShow>>("/discover/tv", params)
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
export function mapCertificationToInternal(cert: string | null): string | null {
  if (!cert) return null

  const certMap: Record<string, string> = {
    "U": "TOUS_PUBLICS",
    "TP": "TOUS_PUBLICS",
    "10": "CSA_10",
    "12": "CSA_12",
    "16": "CSA_16",
    "18": "CSA_18",
  }

  return certMap[cert] || null
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
 * Get TMDB keywords for a movie. Used as a best-effort GROUNDING HINT for AI
 * enrichment (e.g. "death of mother", "child in peril") — never surfaced to
 * users. Returns [] on any error so enrichment never blocks on TMDB.
 * Note: the movie endpoint nests them under `keywords`.
 */
export async function getMovieKeywords(movieId: number): Promise<string[]> {
  try {
    const response = await tmdbFetch<{ keywords?: { id: number; name: string }[] }>(
      `/movie/${movieId}/keywords`,
    )
    return (response.keywords || []).map((k) => k.name)
  } catch {
    return []
  }
}

/**
 * Get TMDB keywords for a TV show. Same grounding-hint use as the movie variant.
 * Note: the TV endpoint nests them under `results` (different shape from movies).
 */
export async function getTVKeywords(tvId: number): Promise<string[]> {
  try {
    const response = await tmdbFetch<{ results?: { id: number; name: string }[] }>(
      `/tv/${tvId}/keywords`,
    )
    return (response.results || []).map((k) => k.name)
  } catch {
    return []
  }
}

// Language tiers tried, in order, until a Trailer turns up. fr-FR is the
// tmdbFetch default and satisfies most of the catalogue; en-US covers the
// international slate.
//
// fr-CA is deliberately LAST, not second: Québécois titles tag their
// trailers fr-CA, and without this tier their fiches show no trailer at
// all (their fr-FR *and* en-US video lists are both empty). Putting it
// after en-US means every title that already resolves keeps its current
// request count — the extra call only fires for titles that would
// otherwise have shown nothing, which is exactly the Québécois case.
// This runs inside the 5s budget of /api/media/[id]/extras.
const VIDEO_LANGUAGE_FALLBACKS = ["en-US", "fr-CA"] as const

async function fetchVideosWithLanguageFallback(path: string): Promise<TMDBVideo[]> {
  const seen = new Set<string>()
  const videos: TMDBVideo[] = []

  const collect = (results: TMDBVideo[] | undefined) => {
    for (const v of results ?? []) {
      if (seen.has(v.key)) continue
      seen.add(v.key)
      videos.push(v)
    }
  }

  collect((await tmdbFetch<TMDBVideosResponse>(path)).results)

  for (const language of VIDEO_LANGUAGE_FALLBACKS) {
    if (videos.some((v) => v.type === "Trailer")) break
    collect((await tmdbFetch<TMDBVideosResponse>(path, { language })).results)
  }

  return videos
}

/**
 * Get videos for a movie (trailers, teasers, etc.)
 * Prioritizes French videos, falls back to English then Québécois French.
 */
export async function getMovieVideos(movieId: number): Promise<TMDBVideo[]> {
  try {
    return await fetchVideosWithLanguageFallback(`/movie/${movieId}/videos`)
  } catch {
    return []
  }
}

/**
 * Get videos for a TV show
 */
export async function getTVVideos(tvId: number): Promise<TMDBVideo[]> {
  try {
    return await fetchVideosWithLanguageFallback(`/tv/${tvId}/videos`)
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

// ============================================
// PERSON TYPES & API
// ============================================

export interface TMDBPerson {
  id: number
  name: string
  known_for_department: string
  profile_path: string | null
  popularity: number
  known_for: TMDBMovie[]
}

export interface TMDBPersonDetails {
  id: number
  name: string
  biography: string
  birthday: string | null
  deathday: string | null
  place_of_birth: string | null
  profile_path: string | null
  known_for_department: string
}

export interface TMDBPersonCredits {
  id: number
  cast: (TMDBMovie & { character: string })[]
  crew: (TMDBMovie & { job: string; department: string })[]
}

/**
 * Search for people (actors, directors, etc.)
 */
export async function searchPerson(query: string, page = 1) {
  return tmdbFetch<TMDBSearchResult<TMDBPerson>>("/search/person", {
    query,
    page: page.toString(),
  })
}

/**
 * Get person details
 */
export async function getPersonDetails(personId: number): Promise<TMDBPersonDetails> {
  return tmdbFetch<TMDBPersonDetails>(`/person/${personId}`)
}

/**
 * Get person's movie credits (films they directed or acted in)
 */
export async function getPersonMovieCredits(personId: number): Promise<TMDBPersonCredits> {
  return tmdbFetch<TMDBPersonCredits>(`/person/${personId}/movie_credits`)
}

// ============================================
// IMAGES API
// ============================================

export interface TMDBImage {
  aspect_ratio: number
  height: number
  width: number
  file_path: string
  vote_average: number
  vote_count: number
  iso_639_1?: string | null
}

export interface TMDBImagesResponse {
  id: number
  backdrops: TMDBImage[]
  posters: TMDBImage[]
  logos?: TMDBImage[]
}

/**
 * Deduplicate TMDB backdrops: the API returns the same scene with different
 * language overlays (fr, en, null). We prefer null (text-free) images first,
 * then fill remaining slots with language-specific ones that aren't duplicates.
 */
function deduplicateBackdrops(backdrops: TMDBImage[], limit: number): TMDBImage[] {
  // Separate text-free (null language) from language-specific images
  const textFree = backdrops
    .filter(img => !img.iso_639_1)
    .sort((a, b) => b.vote_average - a.vote_average)
  const withText = backdrops
    .filter(img => img.iso_639_1)
    .sort((a, b) => b.vote_average - a.vote_average)

  const result: TMDBImage[] = []

  // First: add all text-free backdrops (unique scenes)
  for (const img of textFree) {
    if (result.length >= limit) break
    result.push(img)
  }

  // Second: fill remaining slots with language images, but skip likely duplicates.
  // Language variants of the same scene share identical width×height, so skip
  // any image whose exact dimensions already appear in our results.
  if (result.length < limit) {
    const seenSizes = new Set(result.map(img => `${img.width}x${img.height}`))
    for (const img of withText) {
      if (result.length >= limit) break
      const sizeKey = `${img.width}x${img.height}`
      // If all backdrops share the same resolution, the size check won't help,
      // so we also compare file_path prefixes (TMDB often uses similar base paths)
      if (!seenSizes.has(sizeKey)) {
        seenSizes.add(sizeKey)
        result.push(img)
      }
    }
  }

  // If still not enough (all same resolution, only null-lang available), just fill
  if (result.length < limit) {
    const usedPaths = new Set(result.map(img => img.file_path))
    for (const img of [...textFree, ...withText]) {
      if (result.length >= limit) break
      if (!usedPaths.has(img.file_path)) {
        usedPaths.add(img.file_path)
        result.push(img)
      }
    }
  }

  return result
}

/**
 * Get images (backdrops, posters) for a movie
 * Returns deduplicated, highest rated backdrops first
 */
export async function getMovieImages(movieId: number, limit = 6): Promise<TMDBImage[]> {
  const response = await tmdbFetch<TMDBImagesResponse>(`/movie/${movieId}/images`, {
    include_image_language: "fr,en,null"
  })

  return deduplicateBackdrops(response.backdrops || [], limit)
}

/**
 * Get images for a TV show
 */
export async function getTVImages(tvId: number, limit = 6): Promise<TMDBImage[]> {
  const response = await tmdbFetch<TMDBImagesResponse>(`/tv/${tvId}/images`, {
    include_image_language: "fr,en,null"
  })

  return deduplicateBackdrops(response.backdrops || [], limit)
}

/**
 * Best available POSTER path for a movie/TV, independent of the UI language.
 *
 * Why this exists: the localized details endpoint (`/movie/{id}` with
 * `language=fr-FR`) returns `poster_path: null` whenever TMDB has no
 * French-tagged poster — even when a perfectly good English/no-language poster
 * exists. Relying on it made ~88% of poster-less films look like "no poster on
 * TMDB". This pulls the full poster set (`fr,en,null`) and picks the best by
 * language preference (fr → en → language-neutral) then community rating.
 */
export async function getBestPosterPath(
  id: number,
  type: "MOVIE" | "TV",
): Promise<string | null> {
  const path = type === "TV" ? `/tv/${id}/images` : `/movie/${id}/images`
  // 1) Preferred: French, English, or language-neutral posters.
  let posters = (
    await tmdbFetch<TMDBImagesResponse>(path, { include_image_language: "fr,en,null" })
  ).posters || []
  // 2) Last resort: ANY language. Obscure foreign titles (e.g. a Czech short)
  //    often only have a poster tagged in their original language, which the
  //    fr/en/null filter drops — better a native-language poster than none.
  if (posters.length === 0) {
    posters = (await tmdbFetch<TMDBImagesResponse>(path, { language: "" })).posters || []
  }
  if (posters.length === 0) return null
  const langRank = (lang?: string | null) =>
    lang === "fr" ? 0 : lang === "en" ? 1 : lang == null || lang === "" ? 2 : 3
  const best = [...posters].sort(
    (a, b) => langRank(a.iso_639_1) - langRank(b.iso_639_1) || b.vote_average - a.vote_average,
  )[0]
  return best?.file_path ?? null
}

/**
 * Get backdrop URL with size
 */
export function getBackdropUrl(path: string | null, size: keyof typeof ImageSize.backdrop = "medium"): string {
  if (!path) return "/placeholder-backdrop.jpg"
  return `${TMDB_IMAGE_BASE}/${ImageSize.backdrop[size]}${path}`
}
















