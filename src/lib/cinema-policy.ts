export const CINEMA_TMDB_PAGES = [1, 2, 3] as const

export function isCinemaSort(sort: string | undefined): boolean {
  return sort === "cinema"
}

