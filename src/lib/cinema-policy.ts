// TMDB now_playing (region=FR) returns 20 titles a page and a French week has
// roughly 80–120 films in theatres. Three pages (60 titles, in TMDB's own
// GLOBAL-popularity order) cut off French releases with a small worldwide
// audience — exactly the titles the French ranking below is meant to lift.
// Pages past `total_pages` come back empty; a failing page is skipped by the
// caller (`fetchCinemaPages` in cinema.ts), never fatal.
export const CINEMA_TMDB_PAGES = [1, 2, 3, 4, 5, 6] as const
export const CINEMA_RECENT_RELEASE_DAYS = 56
export const CINEMA_REISSUE_RELEASE_DAYS = 180

export type CinemaReleaseBucket = "upcoming" | "recent" | "holdover" | "reissue" | "unknown"

export function isCinemaSort(sort: string | undefined): boolean {
  return sort === "cinema"
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.floor((a.getTime() - b.getTime()) / msPerDay)
}

function ageInDaysFrom(releaseDate: string | null | undefined, now: Date): number | null {
  if (!releaseDate) return null
  const parsed = new Date(`${releaseDate}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return null
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return daysBetween(today, parsed)
}

export function getCinemaReleaseBucket(
  releaseDate: string | null | undefined,
  now = new Date(),
): CinemaReleaseBucket {
  const ageInDays = ageInDaysFrom(releaseDate, now)
  if (ageInDays === null) return "unknown"

  if (ageInDays < 0) return "upcoming"
  if (ageInDays <= CINEMA_RECENT_RELEASE_DAYS) return "recent"
  if (ageInDays >= CINEMA_REISSUE_RELEASE_DAYS) return "reissue"
  return "holdover"
}

export function cinemaReleaseBucketPriority(bucket: CinemaReleaseBucket): number {
  if (bucket === "recent") return 0
  if (bucket === "upcoming") return 1
  if (bucket === "holdover") return 2
  if (bucket === "unknown") return 3
  return 4
}

// Languages we surface on the French cinema rails. Kept here (prisma-free) so
// the selection below stays unit-testable.
export const EUROPEAN_LANGUAGES = new Set([
  "fr", "en", "es", "it", "de", "pt", "nl", "da", "sv", "no",
  "fi", "pl", "cs", "ro", "hu", "el", "tr", "ru",
])

/** TMDB movie genre id for Animation. */
const TMDB_ANIMATION_GENRE = 16
/** East-Asian languages whose ANIMATED features are mainstream in France (anime). */
const ANIME_LANGUAGES = new Set(["ja", "ko", "zh"])
/**
 * A non-European live-action title is kept when it already has a large
 * audience (an international hit), not on global TMDB buzz alone: popularity
 * counts the whole world, so a film that trends in its home market and plays
 * on three Paris screens would otherwise ride above a French release.
 */
export const NON_EUROPEAN_MIN_VOTES = 1000

/**
 * Whether a now_playing / upcoming title belongs on the French cinema rails.
 *
 * European-language titles always do. Since 21 Nov 2026 two non-European
 * cases do too, because they are real French theatrical events rather than
 * long-tail community releases: anime features (Japanese / Korean / Chinese
 * ANIMATION — Demon Slayer, Chainsaw Man and Ghibli fill French multiplexes)
 * and established international hits (≥ NON_EUROPEAN_MIN_VOTES votes).
 */
export function isFrenchCinemaEligible(movie: {
  original_language: string
  genre_ids?: number[] | null
  vote_count?: number | null
}): boolean {
  if (EUROPEAN_LANGUAGES.has(movie.original_language)) return true
  if (
    ANIME_LANGUAGES.has(movie.original_language) &&
    (movie.genre_ids ?? []).includes(TMDB_ANIMATION_GENRE)
  ) {
    return true
  }
  return (movie.vote_count ?? 0) >= NON_EUROPEAN_MIN_VOTES
}

// ── French-relevance ranking ─────────────────────────────────────────────
//
// Why: TMDB `popularity` is a GLOBAL activity figure. Sorting the French
// now_playing list by it (after a release-bucket pass) put US releases first
// and a French family release like « Astérix : Le Royaume de Nubie » last,
// because its audience is French.
//
// The score (higher = shown first):
//
//   score = ln(1 + popularity)                   global interest, damped
//           × 1.6 if original_language === "fr"  French production
//           × recency factor:
//               released 0–14 days ago ......... 1.35  (the week's sorties)
//               avant-première (date ahead) .... 1.15  (already in now_playing)
//               15–56 days ..................... 1.00
//               57+ days (holdover) ............ 0.80
//               no date ........................ 0.70
//           + 0.3 × log10(1 + vote_count)        established audience
//
// The log keeps one viral title from swamping the list (popularity 900 vs 90
// is ×10 raw but only +2.3 here), so the multipliers can actually reorder.
// 1.6 lets a French film with about a ninth of a foreign film's worldwide
// popularity draw level (1.6 × ln 35 ≈ 5.7 ≈ ln 301) — roughly the gap between
// TMDB's worldwide activity and the French box office for French productions,
// while a tiny art-house title (popularity ~3) still scores far below. Votes
// are a small additive term: a new release has almost none, so they mostly
// separate long-running titles. Ties keep TMDB's own order (stable sort).
// Reissues (180+ days) are dropped by the caller before ranking.

export const FR_LANGUAGE_BOOST = 1.6
export const CINEMA_FRESH_RELEASE_DAYS = 14

export function cinemaRecencyFactor(releaseDate: string | null | undefined, now = new Date()): number {
  const ageInDays = ageInDaysFrom(releaseDate, now)
  if (ageInDays === null) return 0.7
  if (ageInDays < 0) return 1.15
  if (ageInDays <= CINEMA_FRESH_RELEASE_DAYS) return 1.35
  if (ageInDays <= CINEMA_RECENT_RELEASE_DAYS) return 1
  return 0.8
}

type RankableMovie = {
  popularity?: number | null
  original_language: string
  release_date?: string | null
  vote_count?: number | null
}

export function frenchCinemaScore(movie: RankableMovie, now = new Date()): number {
  const popularity = Math.max(0, movie.popularity ?? 0)
  const votes = Math.max(0, movie.vote_count ?? 0)
  const language = movie.original_language === "fr" ? FR_LANGUAGE_BOOST : 1
  return (
    Math.log(1 + popularity) * language * cinemaRecencyFactor(movie.release_date, now) +
    0.3 * Math.log10(1 + votes)
  )
}

/** Sort a now_playing list by `frenchCinemaScore`, stable on the input order. */
export function rankCinemaForFrance<T extends RankableMovie>(movies: T[], now = new Date()): T[] {
  return movies
    .map((movie, index) => ({ movie, index, score: frenchCinemaScore(movie, now) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ movie }) => movie)
}

/**
 * Pick the genuinely-upcoming French theatrical releases from a TMDB list.
 *
 * Authoritative inputs only — never the stored primary `release_date`, which can
 * sit in the future for a film already in cinemas (a later digital/foreign date):
 *   - keep titles eligible for the French rails (`isFrenchCinemaEligible`),
 *     de-duplicated by TMDB id,
 *   - DROP anything currently in `now_playing` (already in theaters by definition),
 *   - keep only titles whose date is strictly in the future ("upcoming" bucket).
 * Sorted soonest-first. Generic over the movie shape so callers keep their full
 * TMDB object (poster, genre_ids…) for downstream mapping.
 */
export function selectUpcomingCinema<
  T extends {
    id: number
    original_language: string
    release_date?: string | null
    genre_ids?: number[] | null
    vote_count?: number | null
  },
>(movies: T[], nowPlayingIds: Set<number>, now = new Date()): T[] {
  const seen = new Set<number>()
  return movies
    .filter((m) => isFrenchCinemaEligible(m))
    .filter((m) => {
      if (seen.has(m.id)) return false
      seen.add(m.id)
      return true
    })
    .filter((m) => !nowPlayingIds.has(m.id))
    .filter((m) => getCinemaReleaseBucket(m.release_date, now) === "upcoming")
    .sort((a, b) => (a.release_date || "").localeCompare(b.release_date || ""))
}
