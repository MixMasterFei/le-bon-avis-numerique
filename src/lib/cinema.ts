import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import {
  getNowPlayingMovies,
  getUpcomingMovies,
  discoverMovies,
  getImageUrl,
  ImageSize,
  type TMDBMovie,
} from "@/lib/tmdb"
import { estimateAgeFromTmdbGenreIds } from "@/lib/import-helpers"
import {
  CINEMA_TMDB_PAGES,
  EUROPEAN_LANGUAGES,
  FRENCH_ORIGIN_COUNTRY,
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
  /** Made in France (production country, co-productions included) — not merely French-spoken. */
  isFrenchProduction: boolean
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

/**
 * TMDB ids of FRENCH-MADE films released recently enough to still be playing.
 *
 * Why discover instead of the now_playing payload: production country is only
 * on the movie DETAIL endpoint (`TMDBMovieDetails.production_countries`), not
 * on list results, so marking 34 now-playing films would cost 34 detail calls
 * per cache refresh. One discover call with `with_origin_country=FR` gives the
 * same answer; we then intersect with the now-playing set.
 *
 * `with_origin_country` (not `with_original_language=fr`) is deliberate:
 * "français" means made in France, so Belgian and Québécois films must NOT
 * count, while a French production shot in English must. Co-productions match
 * because TMDB tests membership of the origin-country list.
 *
 * The date window is wide on purpose (a year): the intersection with
 * now_playing does the real filtering, and a French film can carry an earlier
 * festival `primary_release_date` than its theatrical run.
 *
 * FAIL-SAFE: any error returns an empty set. The caller then simply marks
 * nothing as French, the "cinéma français" row falls under its minimum and
 * hides itself, and the main rail is untouched.
 */
export async function getFrenchProductionTmdbIds(): Promise<Set<number>> {
  try {
    const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
    const pages = await Promise.all(
      [1, 2].map((page) =>
        discoverMovies({
          page,
          with_origin_country: FRENCH_ORIGIN_COUNTRY,
          "primary_release_date.gte": from,
          sort_by: "popularity.desc",
          region: "FR",
        }),
      ),
    )
    return new Set(pages.flatMap((p) => p.results || []).map((m) => m.id))
  } catch {
    return new Set()
  }
}

export async function getCinemaMovies(filters: CinemaFilters = {}): Promise<CinemaMovie[]> {
  // French-origin lookup runs alongside now_playing (both TMDB-cached 1h) so
  // the "cinéma français" split costs no extra round-trip latency.
  const [tmdbPages, frenchIds] = await Promise.all([
    Promise.all(CINEMA_TMDB_PAGES.map((page) => getNowPlayingMovies(page))),
    getFrenchProductionTmdbIds(),
  ])
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
        isFrenchProduction: frenchIds.has(tmdb.id),
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
    items.push({
      id: db.id,
      type: "MOVIE",
      title: db.title,
      posterUrl: db.posterUrl || getImageUrl(tmdb.poster_path, ImageSize.poster.medium),
      expertAgeRec: db.expertAgeRec ?? estimateAgeFromTmdbGenreIds(tmdb.genre_ids ?? []),
      genres: db.genres ?? [],
      releaseDate: tmdb.release_date || null,
    })
    if (items.length >= limit) break
  }
  return items
}
