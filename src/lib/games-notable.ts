/**
 * « Sortis récemment en jeux vidéo » — the homepage games row, ranked by
 * notability × recency instead of raw release date (Xavier, 27 Nov 2026: the
 * row is NEWS, not a recommendation).
 *
 * Sorted by date alone, the row led with whatever shipped last — Tape to
 * Tape, Sulfur, Final Fantasy Resonance (4 to 6 ratings each) — while GTA VI
 * and the Zelda: Ocarina of Time remake were nowhere: too recent to have the
 * rating count of an old hit, and above the family age cap. The row is now
 * uncapped (each card keeps its age badge, the family-fit dots and the 15+
 * poster blur) and ranks the launches of the last NOTABLE_GAMES_WINDOW_DAYS
 * days with `gameLaunchScore` — the same notability × recency score as the
 * « À ne pas manquer » band — plus a bonus for the top-names seeds of the
 * /jeux/quel-age pillar (the games French families ask about by name).
 *
 * Server-side only (it reads the curated seed list); the client rail builds
 * its URL from `homepage-games-rail.ts`.
 */

import { TOP_GAMES } from "@/app/jeux/quel-age/topGames.data"
import { matchTier } from "@/lib/game-seed-match"
import { daysSince, freshTrendingScore, gameLaunchScore, launchRecencyFactor } from "@/lib/homepage-spotlight"

/** Launches of the last ~2 months; never a future date. */
export const NOTABLE_GAMES_WINDOW_DAYS = 60
/**
 * Token rating floor (IGDB rating count): what the date-sorted row already
 * required of a game out less than 90 days (`GAME_FRESH_MIN_VOTES`). The old
 * `minVoteCount=20` never applied to a fresh release.
 */
export const NOTABLE_MIN_VOTES = 3
/**
 * A brand-new launch can have almost no ratings yet: a fresh trending score
 * this high (the median of the ~90 trending games is ~50), or being a
 * top-names seed, lets it in below the floor.
 */
export const NOTABLE_TRENDING_BYPASS = 50
/** A top-names seed weighs like ~10 more ratings (log10 scale, × recency). */
export const NOTABLE_SEED_BONUS = 1

export interface NotableGameRow {
  title: string
  releaseDate: Date | null
  tmdbVoteCount: number | null
  trendingScore: number | null
  trendingUpdatedAt: Date | null
}

/** Is this catalogue title one of the /jeux/quel-age top-names seeds (or an edition of one)? */
export function isTopNameSeedTitle(title: string, seeds = TOP_GAMES): boolean {
  return seeds.some((seed) => matchTier(seed, title) != null)
}

/** Notability × recency, with the seed bonus. */
export function notableGameScore(row: NotableGameRow, now: Date, isSeed: boolean): number {
  const trending = freshTrendingScore(row, now)
  const base = gameLaunchScore({ votes: row.tmdbVoteCount, trending, releaseDate: row.releaseDate }, now)
  return base + (isSeed ? NOTABLE_SEED_BONUS * launchRecencyFactor(daysSince(row.releaseDate, now)) : 0)
}

/**
 * Keep the launches of the window that carry a real signal (rating floor,
 * or a high trending score, or a top-names seed), biggest first; ties go to
 * the most recent release.
 */
export function rankNotableGames<T extends NotableGameRow>(
  rows: T[],
  now: Date,
  opts: { isSeed?: (title: string) => boolean; windowDays?: number } = {},
): T[] {
  const isSeed = opts.isSeed ?? ((title: string) => isTopNameSeedTitle(title))
  const windowDays = opts.windowDays ?? NOTABLE_GAMES_WINDOW_DAYS
  return rows
    .map((row, index) => {
      const days = daysSince(row.releaseDate, now)
      const seed = isSeed(row.title)
      const trending = freshTrendingScore(row, now) ?? 0
      const inWindow = days != null && days >= 0 && days <= windowDays
      const signal = (row.tmdbVoteCount ?? 0) >= NOTABLE_MIN_VOTES || trending >= NOTABLE_TRENDING_BYPASS || seed
      return { row, index, keep: inWindow && signal, score: notableGameScore(row, now, seed) }
    })
    .filter((r) => r.keep)
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score
      const date = (b.row.releaseDate?.getTime() ?? 0) - (a.row.releaseDate?.getTime() ?? 0)
      return date || a.index - b.index
    })
    .map((r) => r.row)
}
