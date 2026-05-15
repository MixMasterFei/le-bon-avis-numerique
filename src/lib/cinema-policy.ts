export const CINEMA_TMDB_PAGES = [1, 2, 3] as const
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

