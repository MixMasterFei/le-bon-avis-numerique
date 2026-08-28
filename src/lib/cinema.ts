import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import { getNowPlayingMovies, getUpcomingMovies, getImageUrl, ImageSize, type TMDBMovie } from "@/lib/tmdb"
import { estimateAgeFromTmdbGenreIds } from "@/lib/import-helpers"
import {
  CINEMA_TMDB_PAGES,
  EUROPEAN_LANGUAGES,
  cinemaReleaseBucketPriority,
  getCinemaReleaseBucket,
  selectUpcomingCinema,
  type CinemaReleaseBucket,
} from "@/lib/cinema-policy"

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
      // Within a release bucket, surface the MAINSTREAM films first. TMDB's
      // now_playing (region=FR) lists every title in French theaters — incl.
      // tiny art-house — in an order that doesn't reflect box-office. Ranking
      // by TMDB popularity brings the well-known releases to the top (closer to
      // what mainstream French cinema listings show) and buries the obscure
      // long-tail below the single visible row.
      const popDelta = (b.movie.popularity ?? 0) - (a.movie.popularity ?? 0)
      if (popDelta !== 0) return popDelta
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
    // Drop old reissues ("reprises", e.g. a restored 1902 classic): they're
    // technically "now playing" but read as obscure on a mainstream cinema rail.
    .filter((movie) => movie.cinemaReleaseBucket !== "reissue")
    .filter((movie) => matchesAgeFilter(movie, filters))
}

export interface UpcomingCinemaMovie {
  id: string
  type: "MOVIE"
  title: string
  posterUrl: string | null
  expertAgeRec: number | null
  genres: string[]
  releaseDate: string | null // FR theatrical date, YYYY-MM-DD
}

/**
 * Genuinely-upcoming French theatrical releases for the homepage "Bientôt" rail.
 *
 * Source of truth is TMDB `/movie/upcoming?region=FR` (the symmetric counterpart
 * of the now_playing rail), NOT the stored primary `release_date` — which can be
 * a future digital/foreign date for a film already in cinemas (e.g. "De Gaulle"
 * showing now but carrying a July re-release date). We additionally subtract
 * what's currently now-playing, then intersect with our DB so every card links
 * to a real fiche (and carries a real, not provisional, age when enriched).
 */
export async function getUpcomingCinemaMovies(limit = 12): Promise<UpcomingCinemaMovie[]> {
  // NOTE: `limit` cuts the list BEFORE any caller-side age filtering, so
  // callers that filter afterwards must over-fetch here (see /api/db/upcoming).
  let upcoming: TMDBMovie[]
  let nowPlayingIds: Set<number>
  try {
    const [pages, playing] = await Promise.all([
      Promise.all(CINEMA_TMDB_PAGES.map((page) => getUpcomingMovies(page))),
      getNowPlayingTmdbIds(),
    ])
    upcoming = pages.flatMap((page) => page.results || [])
    nowPlayingIds = playing
  } catch {
    return []
  }

  const candidates = selectUpcomingCinema(upcoming, nowPlayingIds)
  if (candidates.length === 0) return []

  const tmdbIds = candidates.map((m) => m.id)
  let dbMovies: Array<{
    tmdbId: number | null
    id: string
    title: string
    posterUrl: string | null
    expertAgeRec: number | null
    genres: string[]
  }> = []
  try {
    dbMovies = await withPrismaRetry(() =>
      prisma.mediaItem.findMany({
        where: { tmdbId: { in: tmdbIds }, type: "MOVIE" },
        select: { tmdbId: true, id: true, title: true, posterUrl: true, expertAgeRec: true, genres: true },
      }),
    )
  } catch {
    return []
  }

  const dbByTmdbId = new Map(
    dbMovies.filter((m) => m.tmdbId !== null).map((m) => [m.tmdbId!, m]),
  )

  // Keep only titles we actually have a fiche for — the card links to /media/[id],
  // so an out-of-DB id would 404. `candidates` is already soonest-first.
  const items: UpcomingCinemaMovie[] = []
  for (const tmdb of candidates) {
    const db = dbByTmdbId.get(tmdb.id)
    if (!db) continue
    // `getImageUrl(null)` returns "/placeholder-poster.jpg", a file that does
    // not exist in /public — emitting it produced a broken-image card on the
    // "Bientôt" rail ("Dans les cordes"). Keep the field honestly null so the
    // caller can drop the item or paint its own placeholder.
    const posterUrl =
      db.posterUrl ||
      (tmdb.poster_path ? getImageUrl(tmdb.poster_path, ImageSize.poster.medium) : null)
    items.push({
      id: db.id,
      type: "MOVIE",
      title: db.title,
      posterUrl,
      expertAgeRec: db.expertAgeRec ?? estimateAgeFromTmdbGenreIds(tmdb.genre_ids ?? []),
      genres: db.genres ?? [],
      releaseDate: tmdb.release_date || null,
    })
    if (items.length >= limit) break
  }
  return items
}
