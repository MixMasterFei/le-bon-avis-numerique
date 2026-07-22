export const CINEMA_TMDB_PAGES = [1, 2, 3] as const

/** ISO 3166-1 code used to identify French-MADE films (production, not language). */
export const FRENCH_ORIGIN_COUNTRY = "FR"

/**
 * Minimum French-made films needed before the dedicated "cinéma français" row
 * renders. French theatrical supply is lumpy — some weeks carry two releases —
 * and a half-empty labelled row reads as broken in a way a single blended row
 * never does. Below this we simply don't show the row.
 */
export const MIN_FRENCH_ROW_ITEMS = 3
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

export function getCinemaReleaseBucket(
  releaseDate: string | null | undefined,
  now = new Date(),
): CinemaReleaseBucket {
  if (!releaseDate) return "unknown"

  const parsed = new Date(`${releaseDate}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return "unknown"

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const ageInDays = daysBetween(today, parsed)

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
// the upcoming selection below stays unit-testable.
export const EUROPEAN_LANGUAGES = new Set([
  "fr", "en", "es", "it", "de", "pt", "nl", "da", "sv", "no",
  "fi", "pl", "cs", "ro", "hu", "el", "tr", "ru",
])

/**
 * Pick the genuinely-upcoming French theatrical releases from a TMDB list.
 *
 * Authoritative inputs only — never the stored primary `release_date`, which can
 * sit in the future for a film already in cinemas (a later digital/foreign date):
 *   - keep European-language titles, de-duplicated by TMDB id,
 *   - DROP anything currently in `now_playing` (already in theaters by definition),
 *   - keep only titles whose date is strictly in the future ("upcoming" bucket).
 * Sorted soonest-first. Generic over the movie shape so callers keep their full
 * TMDB object (poster, genre_ids…) for downstream mapping.
 */
export function selectUpcomingCinema<
  T extends { id: number; original_language: string; release_date?: string | null },
>(movies: T[], nowPlayingIds: Set<number>, now = new Date()): T[] {
  const seen = new Set<number>()
  return movies
    .filter((m) => EUROPEAN_LANGUAGES.has(m.original_language))
    .filter((m) => {
      if (seen.has(m.id)) return false
      seen.add(m.id)
      return true
    })
    .filter((m) => !nowPlayingIds.has(m.id))
    .filter((m) => getCinemaReleaseBucket(m.release_date, now) === "upcoming")
    .sort((a, b) => (a.release_date || "").localeCompare(b.release_date || ""))
}

