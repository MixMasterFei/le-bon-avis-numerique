import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import { getNowPlayingMovies, getImageUrl, ImageSize, type TMDBMovie } from "@/lib/tmdb"
import { estimateAgeFromTmdbGenreIds } from "@/lib/import-helpers"
import {
  CINEMA_TMDB_PAGES,
  cinemaReleaseBucketPriority,
  getCinemaReleaseBucket,
  type CinemaReleaseBucket,
} from "@/lib/cinema-policy"

const EUROPEAN_LANGUAGES = new Set([
  "fr", "en", "es", "it", "de", "pt", "nl", "da", "sv", "no",
  "fi", "pl", "cs", "ro", "hu", "el", "tr", "ru",
])

export interface CinemaMovie {
  id: string
  tmdbId: number
  type: "MOVIE"
  title: string
  originalTitle: string
  posterUrl: string | null
  releaseDate: string | null
  cinemaReleaseBucket: CinemaReleaseBucket
  expertAgeRec: number | null
  communityAgeRec: number | null
  genres: string[]
  platforms: string[]
  topics: string[]
  toneTags: string[]
  contentMetrics: {
    violence: number | null
    sexNudity: number | null
    language: number | null
    substanceUse: number | null
  } | null
  inDatabase: boolean
  // Age is an estimate (not in DB, or in DB but not yet AI-enriched) → "âge provisoire".
  isProvisional: boolean
}

interface CinemaFilters {
  minAge?: number
  maxAge?: number
}

function uniqueEuropeanMovies(tmdbMovies: TMDBMovie[]): TMDBMovie[] {
  const seenTmdbIds = new Set<number>()
  return tmdbMovies.filter((movie) => {
    if (!EUROPEAN_LANGUAGES.has(movie.original_language)) return false
    if (seenTmdbIds.has(movie.id)) return false
    seenTmdbIds.add(movie.id)
    return true
  })
}

function sortCinemaMovies(movies: TMDBMovie[]): TMDBMovie[] {
  return movies
    .map((movie, index) => ({ movie, index }))
    .sort((a, b) => {
      const bucketDelta =
        cinemaReleaseBucketPriority(getCinemaReleaseBucket(a.movie.release_date)) -
        cinemaReleaseBucketPriority(getCinemaReleaseBucket(b.movie.release_date))
      if (bucketDelta !== 0) return bucketDelta
      return a.index - b.index
    })
    .map(({ movie }) => movie)
}

function matchesAgeFilter(movie: Pick<CinemaMovie, "expertAgeRec">, filters: CinemaFilters): boolean {
  if (typeof filters.minAge !== "number" && typeof filters.maxAge !== "number") return true
  if (typeof movie.expertAgeRec !== "number") return false
  if (typeof filters.minAge === "number" && movie.expertAgeRec < filters.minAge) return false
  if (typeof filters.maxAge === "number" && movie.expertAgeRec > filters.maxAge) return false
  return true
}

/**
 * Returns the set of TMDB movie ids currently playing in French cinemas.
 * Backed by TMDB's now_playing endpoint (region=FR), which is cached 1h, so
 * this is cheap to call per request. Do NOT use release date as a proxy —
 * a film can be months old and still in theaters (or recent and already gone).
 */
export async function getNowPlayingTmdbIds(): Promise<Set<number>> {
  try {
    const tmdbPages = await Promise.all(CINEMA_TMDB_PAGES.map((page) => getNowPlayingMovies(page)))
    return new Set(tmdbPages.flatMap((page) => page.results || []).map((movie) => movie.id))
  } catch {
    return new Set()
  }
}

/**
 * Whether a single movie (by TMDB id) is currently in French theaters.
 */
export async function isMovieNowPlaying(tmdbId: number | null | undefined): Promise<boolean> {
  if (!tmdbId) return false
  const ids = await getNowPlayingTmdbIds()
  return ids.has(tmdbId)
}

export async function getCinemaMovies(filters: CinemaFilters = {}): Promise<CinemaMovie[]> {
  const tmdbPages = await Promise.all(CINEMA_TMDB_PAGES.map((page) => getNowPlayingMovies(page)))
  const filteredMovies = sortCinemaMovies(
    uniqueEuropeanMovies(tmdbPages.flatMap((page) => page.results || [])),
  )

  if (filteredMovies.length === 0) return []

  const tmdbIds = filteredMovies.map((movie) => movie.id)
  let dbMovies: Array<{
    tmdbId: number | null
    id: string
    title: string
    posterUrl: string | null
    expertAgeRec: number | null
    communityAgeRec: number | null
    isEnriched: boolean
    genres: string[]
    platforms: string[]
    topics: string[]
    contentMetrics: {
      toneTags: string[]
      violence: number | null
      sexNudity: number | null
      language: number | null
      substanceUse: number | null
    } | null
  }> = []

  try {
    dbMovies = await withPrismaRetry(() =>
      prisma.mediaItem.findMany({
        where: {
          tmdbId: { in: tmdbIds },
          type: "MOVIE",
        },
        select: {
          tmdbId: true,
          id: true,
          title: true,
          posterUrl: true,
          expertAgeRec: true,
          communityAgeRec: true,
          isEnriched: true,
          genres: true,
          platforms: true,
          topics: true,
          contentMetrics: {
            select: {
              toneTags: true,
              violence: true,
              sexNudity: true,
              language: true,
              substanceUse: true,
            },
          },
        },
      }),
    )
  } catch {
    dbMovies = []
  }

  const dbByTmdbId = new Map(
    dbMovies.filter((movie) => movie.tmdbId !== null).map((movie) => [movie.tmdbId!, movie]),
  )

  return filteredMovies
    .map((tmdb) => {
      const db = dbByTmdbId.get(tmdb.id)
      // Out-of-DB (or in-DB but unrated) films get a provisional age estimated
      // from TMDB genre ids, so the cinema age filter isn't empty for current
      // theatrical releases that haven't been imported/enriched yet.
      const estimatedAge =
        db?.expertAgeRec ?? estimateAgeFromTmdbGenreIds(tmdb.genre_ids ?? [])
      const isProvisional = !db || !db.isEnriched
      const movie: CinemaMovie = {
        id: db?.id ?? `tmdb-${tmdb.id}`,
        tmdbId: tmdb.id,
        type: "MOVIE",
        title: tmdb.title,
        originalTitle: tmdb.original_title,
        posterUrl:
          db?.posterUrl ||
          getImageUrl(tmdb.poster_path, ImageSize.poster.medium),
        releaseDate: tmdb.release_date || null,
        cinemaReleaseBucket: getCinemaReleaseBucket(tmdb.release_date),
        expertAgeRec: estimatedAge,
        communityAgeRec: db?.communityAgeRec ?? null,
        genres: db?.genres ?? [],
        platforms: db?.platforms ?? [],
        topics: db?.topics ?? [],
        toneTags: db?.contentMetrics?.toneTags ?? [],
        contentMetrics: db?.contentMetrics
          ? {
              violence: db.contentMetrics.violence,
              sexNudity: db.contentMetrics.sexNudity,
              language: db.contentMetrics.language,
              substanceUse: db.contentMetrics.substanceUse,
            }
          : null,
        inDatabase: !!db,
        isProvisional,
      }
      return movie
    })
    .filter((movie) => matchesAgeFilter(movie, filters))
}
