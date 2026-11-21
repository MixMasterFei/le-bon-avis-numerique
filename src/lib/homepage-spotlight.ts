/**
 * « À ne pas manquer cette semaine » — the homepage band of the titles
 * families are talking about this week: the big cinema releases, new series
 * or seasons on French platforms, the big game launches.
 *
 * INFORMATIONAL, not a recommendation: the band deliberately ignores the
 * homepage age filter (a parent should learn that GTA VI is 18+ here, not
 * have it silently hidden), shows every title with its age badge, and the
 * card keeps the site-wide poster blur rules (`shouldBlurMedia`).
 *
 * Pure selection only (no Prisma, no fetch) so it is unit-tested; the loader
 * lives in `homepage-spotlight-data.ts`. Ages always come from the catalogue:
 * nothing here produces or alters an age.
 *
 * Inputs:
 *  (a) active pins from `homepage_spotlight` — admin pins first, then the
 *      homepage-watch cron's pins in their rank order;
 *  (b) a deterministic fallback that tops the band up when pins don't fill it:
 *      films in French cinemas (trending this week first, then the French
 *      cinema ranking), series on a French platform that premiered recently
 *      and trend this week, games released in the last weeks (IGDB trending,
 *      then rating count). Interleaved film / série / jeu so the band is mixed.
 */

import { RELEVANT_PROVIDERS } from "@/lib/streaming-providers"

export type SpotlightType = "MOVIE" | "TV" | "GAME"
export type SpotlightOrigin = "admin" | "watch" | "fallback"

export interface SpotlightMedia {
  id: string
  type: SpotlightType
  title: string
  posterUrl: string | null
  expertAgeRec: number | null
  isEnriched: boolean
  genres: string[]
  contentMetrics: {
    violence: number | null
    sexNudity: number | null
    language: number | null
    substanceUse: number | null
  } | null
}

export interface SpotlightPin {
  mediaId: string
  source: string
  rank: number
  startsAt: Date
  expiresAt: Date
  media: SpotlightMedia | null
}

export interface SpotlightItem extends SpotlightMedia {
  /** Imported but not analysed yet — badged « à confirmer » like the cinema rail. */
  isProvisional: boolean
  origin: SpotlightOrigin
}

export interface SpotlightFallback {
  films: SpotlightMedia[]
  series: SpotlightMedia[]
  games: SpotlightMedia[]
}

/** Band size: one desktop row of the V2 rail is 6–8 cards. */
export const SPOTLIGHT_MAX = 8
/** Below this many showable titles the band hides rather than look broken. */
export const SPOTLIGHT_MIN_TO_SHOW = 4

/** A series counts as « new » for this long after its first air date. */
export const SPOTLIGHT_SERIES_FRESH_DAYS = 120
/** A game counts as a launch for this long after its release. */
export const SPOTLIGHT_GAME_FRESH_DAYS = 45
/** Same token floor as the « sortis récemment » games rail (fetchGames). */
export const SPOTLIGHT_GAME_MIN_VOTES = 3
/** A trending score older than this is stale (the import cron stopped). */
export const SPOTLIGHT_TRENDING_MAX_AGE_HOURS = 72

const DAY_MS = 24 * 60 * 60 * 1000

export function isActivePin(pin: Pick<SpotlightPin, "startsAt" | "expiresAt">, now: Date): boolean {
  return pin.startsAt.getTime() <= now.getTime() && now.getTime() < pin.expiresAt.getTime()
}

/** Only titles we can show honestly: in the catalogue, with an age and a poster. */
export function isShowable(media: Pick<SpotlightMedia, "expertAgeRec" | "posterUrl">): boolean {
  return (
    typeof media.expertAgeRec === "number" &&
    Number.isFinite(media.expertAgeRec) &&
    media.expertAgeRec >= 0 &&
    typeof media.posterUrl === "string" &&
    media.posterUrl.length > 0
  )
}

function toItem(media: SpotlightMedia, origin: SpotlightOrigin): SpotlightItem {
  return { ...media, isProvisional: !media.isEnriched && media.expertAgeRec != null, origin }
}

/** Active pins in display order: admin before watch, then rank, then newest. */
export function orderActivePins(pins: SpotlightPin[], now: Date): SpotlightPin[] {
  return pins
    .filter((p) => isActivePin(p, now))
    .sort((a, b) => {
      const src = (a.source === "admin" ? 0 : 1) - (b.source === "admin" ? 0 : 1)
      if (src !== 0) return src
      if (a.rank !== b.rank) return a.rank - b.rank
      return b.startsAt.getTime() - a.startsAt.getTime()
    })
}

/** Round-robin film → série → jeu until `limit`; a short list lets the others fill. */
export function interleaveByType<T>(lists: T[][], limit: number): T[] {
  const out: T[] = []
  const cursors = lists.map(() => 0)
  while (out.length < limit) {
    let progressed = false
    for (let i = 0; i < lists.length && out.length < limit; i++) {
      if (cursors[i] < lists[i].length) {
        out.push(lists[i][cursors[i]++])
        progressed = true
      }
    }
    if (!progressed) break
  }
  return out
}

export function selectSpotlight(input: {
  pins: SpotlightPin[]
  fallback: SpotlightFallback
  now: Date
  limit?: number
}): SpotlightItem[] {
  const limit = input.limit ?? SPOTLIGHT_MAX
  const seen = new Set<string>()
  const out: SpotlightItem[] = []

  for (const pin of orderActivePins(input.pins, input.now)) {
    if (out.length >= limit) break
    const media = pin.media
    if (!media || seen.has(media.id) || !isShowable(media)) continue
    seen.add(media.id)
    out.push(toItem(media, pin.source === "admin" ? "admin" : "watch"))
  }
  if (out.length >= limit) return out

  const fresh = (list: SpotlightMedia[]) => {
    const kept: SpotlightMedia[] = []
    for (const m of list) {
      if (seen.has(m.id) || !isShowable(m)) continue
      // Mark now so the same id in two lists can't take two slots.
      seen.add(m.id)
      kept.push(m)
    }
    return kept
  }
  const topUp = interleaveByType(
    [fresh(input.fallback.films), fresh(input.fallback.series), fresh(input.fallback.games)],
    limit - out.length,
  )
  return [...out, ...topUp.map((m) => toItem(m, "fallback"))]
}

// ── Fallback ranking helpers (pure, fed by the loader) ─────────────────────

interface Trending {
  trendingScore: number | null
  trendingUpdatedAt: Date | null
}

/** A trending score from the last refresh, or null when absent / stale. */
export function freshTrendingScore(row: Trending, now: Date): number | null {
  if (row.trendingScore == null || !row.trendingUpdatedAt) return null
  const ageHours = (now.getTime() - row.trendingUpdatedAt.getTime()) / 3_600_000
  return ageHours <= SPOTLIGHT_TRENDING_MAX_AGE_HOURS ? row.trendingScore : null
}

/**
 * Films: catalogue titles in French cinemas (`cinemaOrder`, already in the
 * French-relevance order of the cinema rail). Those trending this week lead,
 * by trending score; the rest follow in cinema order.
 */
export function rankSpotlightFilms<T extends { id: string } & Trending>(
  cinemaOrder: T[],
  now: Date,
): T[] {
  const indexed = cinemaOrder.map((row, index) => ({ row, index, t: freshTrendingScore(row, now) }))
  return indexed
    .sort((a, b) => {
      if (a.t != null && b.t != null) return b.t - a.t || a.index - b.index
      if (a.t != null) return -1
      if (b.t != null) return 1
      return a.index - b.index
    })
    .map(({ row }) => row)
}

/**
 * Series: on a French platform, premiered in the last SPOTLIGHT_SERIES_FRESH_DAYS,
 * trending this week. A long-running show with a NEW SEASON can't be told
 * apart here (the catalogue keeps no last-air date): the homepage-watch cron,
 * which reads TMDB, pins those instead.
 */
export function rankSpotlightSeries<
  T extends { platforms: string[]; releaseDate: Date | null } & Trending,
>(rows: T[], now: Date): T[] {
  const since = now.getTime() - SPOTLIGHT_SERIES_FRESH_DAYS * DAY_MS
  return rows
    .map((row, index) => ({ row, index, t: freshTrendingScore(row, now) }))
    .filter(
      ({ row, t }) =>
        t != null &&
        row.platforms.some((p) => RELEVANT_PROVIDERS.has(p)) &&
        row.releaseDate != null &&
        row.releaseDate.getTime() >= since &&
        row.releaseDate.getTime() <= now.getTime(),
    )
    .sort((a, b) => (b.t as number) - (a.t as number) || a.index - b.index)
    .map(({ row }) => row)
}

/**
 * Games: released in the last SPOTLIGHT_GAME_FRESH_DAYS (not before today),
 * with a token rating floor; trending this week first, then rating count,
 * then the most recent.
 */
export function rankSpotlightGames<
  T extends { releaseDate: Date | null; tmdbVoteCount: number | null } & Trending,
>(rows: T[], now: Date): T[] {
  const since = now.getTime() - SPOTLIGHT_GAME_FRESH_DAYS * DAY_MS
  return rows
    .filter(
      (row) =>
        row.releaseDate != null &&
        row.releaseDate.getTime() >= since &&
        row.releaseDate.getTime() <= now.getTime() &&
        (row.tmdbVoteCount ?? 0) >= SPOTLIGHT_GAME_MIN_VOTES,
    )
    .map((row, index) => ({ row, index, t: freshTrendingScore(row, now) }))
    .sort((a, b) => {
      if (a.t != null || b.t != null) {
        if (a.t == null) return 1
        if (b.t == null) return -1
        if (a.t !== b.t) return b.t - a.t
      }
      const votes = (b.row.tmdbVoteCount ?? 0) - (a.row.tmdbVoteCount ?? 0)
      if (votes !== 0) return votes
      const date = (b.row.releaseDate?.getTime() ?? 0) - (a.row.releaseDate?.getTime() ?? 0)
      return date || a.index - b.index
    })
    .map(({ row }) => row)
}
