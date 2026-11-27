/**
 * The homepage games row « Sortis récemment en jeux vidéo » — one query,
 * shared by the client rail (`GamesRail`) and the homepage-watch cron, so the
 * cron reads exactly what the page shows.
 *
 * NO age cap on purpose (Xavier, 27 Nov 2026): this row is news, not a
 * recommendation, so families see GTA VI and the Zelda remake with their age
 * badge instead of a row that looks out of date. Every other browse rail
 * keeps the family cap. Ranking: `sortBy=notable` (src/lib/games-notable.ts).
 *
 * Dependency-free: imported by a client component.
 */

export const GAMES_RAIL_LIMIT = 12

export const GAMES_RAIL_FILTERS = {
  sortBy: "notable",
  limit: GAMES_RAIL_LIMIT,
  requirePoster: true,
} as const

export function gamesRailUrl(): string {
  const { sortBy, limit, requirePoster } = GAMES_RAIL_FILTERS
  return `/api/db/games?sortBy=${sortBy}&limit=${limit}&requirePoster=${requirePoster}`
}
