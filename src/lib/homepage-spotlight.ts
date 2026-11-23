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
 *      and trend this week, games released in the last weeks (notability ×
 *      recency, see `gameLaunchScore`). Interleaved film / série / jeu so the
 *      band is mixed.
 *
 * Composition rules (23 Nov 2026 — the first watch run filled all 8 slots
 * with its pins and pushed out Zelda: Ocarina of Time and VisionQuest):
 *  1. Admin pins first, always; no rule below ever removes one.
 *  2. Watch pins take at most SPOTLIGHT_WATCH_MAX slots and always leave
 *     SPOTLIGHT_FALLBACK_MIN to the fallback (which brings the recent
 *     releases). Watch pins past that only fill slots the fallback can't.
 *  3. Reserved slots, when a candidate exists: one game released in the last
 *     SPOTLIGHT_RECENT_DAYS days, one film in French cinemas. A title already
 *     in the band fills them (no slot spent twice); otherwise the best
 *     candidate — pins first, then the fallback's ranking — replaces the
 *     last title taken that is neither an admin pin nor reserved.
 *  4. At most SPOTLIGHT_MAX_MATURE titles rated SPOTLIGHT_MATURE_AGE or more,
 *     all sources together, granted in priority order (admin, watch, then
 *     fallback). Admin pins count but are never dropped; a 16+ watch /
 *     fallback candidate past the cap is skipped for the next one.
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
  /** Selection only (the « recent game » slot) — never passed to the card. */
  releaseDate?: Date | null
}

export interface SpotlightPin {
  mediaId: string
  source: string
  rank: number
  startsAt: Date
  expiresAt: Date
  media: SpotlightMedia | null
}

// `releaseDate` stays out of the item: the band is cached (`unstable_cache`
// serialises Dates to strings) and the card has no use for it.
export interface SpotlightItem extends Omit<SpotlightMedia, "releaseDate"> {
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

/** « Big recent release »: a game out for at most this many days gets a reserved slot. */
export const SPOTLIGHT_RECENT_DAYS = 30
/** Watch pins never take more than this many slots… */
export const SPOTLIGHT_WATCH_MAX = 6
/** …and always leave at least this many to the fallback (recent releases). */
export const SPOTLIGHT_FALLBACK_MIN = 2
/** A family site: at most this many titles rated SPOTLIGHT_MATURE_AGE or more. */
export const SPOTLIGHT_MAX_MATURE = 2
export const SPOTLIGHT_MATURE_AGE = 16

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole days since `date` (negative = not out yet), or null without a date. */
export function daysSince(date: Date | null | undefined, now: Date): number | null {
  if (!date) return null
  const t = date.getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((now.getTime() - t) / DAY_MS)
}

/**
 * How much recency weighs on a launch's rank — strongly: a game out 18 days
 * ago outranks one out 39 days ago with similar signals (1.25 vs 0.8).
 * Unknown date = neutral; not out yet (the watch looks 7 days ahead) = like
 * a recent release.
 */
export function launchRecencyFactor(days: number | null | undefined): number {
  if (days == null) return 1
  if (days < 0) return 1.25
  if (days <= 14) return 1.5
  if (days <= SPOTLIGHT_RECENT_DAYS) return 1.25
  if (days <= SPOTLIGHT_GAME_FRESH_DAYS) return 0.8
  return 0.6
}

/**
 * A game launch's weight: notability (log of the rating count, plus this
 * week's trending score when there is one — 80 weighs like ~1,600 ratings)
 * × recency. A rating count alone is lifetime notoriety: Enshrouded (early
 * access since 2024, 1.0 on 15 Oct, 69 ratings) out-ranked the 5 Nov
 * Ocarina of Time remake (61 ratings) on the 23 Nov 2026 run.
 */
export function gameLaunchScore(
  input: { votes: number | null | undefined; trending: number | null | undefined; releaseDate: Date | null | undefined },
  now: Date,
): number {
  const notability = Math.log10(1 + Math.max(0, input.votes ?? 0)) + Math.max(0, input.trending ?? 0) / 25
  return notability * launchRecencyFactor(daysSince(input.releaseDate, now))
}

export function isMatureAge(age: number | null | undefined): boolean {
  return typeof age === "number" && age >= SPOTLIGHT_MATURE_AGE
}

/** A game released in the last SPOTLIGHT_RECENT_DAYS days (not a future date). */
export function isRecentGame(media: Pick<SpotlightMedia, "type" | "releaseDate">, now: Date): boolean {
  if (media.type !== "GAME") return false
  const days = daysSince(media.releaseDate, now)
  return days != null && days >= 0 && days <= SPOTLIGHT_RECENT_DAYS
}

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
  return {
    id: media.id,
    type: media.type,
    title: media.title,
    posterUrl: media.posterUrl,
    expertAgeRec: media.expertAgeRec,
    isEnriched: media.isEnriched,
    genres: media.genres,
    contentMetrics: media.contentMetrics,
    isProvisional: !media.isEnriched && media.expertAgeRec != null,
    origin,
  }
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
  roundRobin(lists, (item) => {
    if (out.length >= limit) return false
    out.push(item)
    return true
  })
  return out
}

/**
 * Round-robin over `lists`: on its turn a list offers its next items until
 * `visit` accepts one (a refused item is skipped and the turn stays with
 * that list, so a skipped film is replaced by the next film, not by a
 * series). Runs until every list is exhausted.
 */
export function roundRobin<T>(lists: T[][], visit: (item: T) => boolean): void {
  const cursors = lists.map(() => 0)
  for (;;) {
    let remaining = false
    for (let i = 0; i < lists.length; i++) {
      while (cursors[i] < lists[i].length) {
        if (visit(lists[i][cursors[i]++])) break
      }
      if (cursors[i] < lists[i].length) remaining = true
    }
    if (!remaining) return
  }
}

export function selectSpotlight(input: {
  pins: SpotlightPin[]
  fallback: SpotlightFallback
  now: Date
  limit?: number
}): SpotlightItem[] {
  const { now, fallback } = input
  const limit = input.limit ?? SPOTLIGHT_MAX
  // `fallback.films` is the catalogue's « à l'affiche » list: in French cinemas.
  const inCinema = new Set(fallback.films.map((m) => m.id))
  const isCinemaFilm = (m: SpotlightMedia) => m.type === "MOVIE" && inCinema.has(m.id)

  // `order` = display order (admin 0…, watch 1000 + pin index, fallback
  // 2000 + pick index); `seq` = when it was taken (the latest taken is the
  // first to give way to a reserved slot).
  interface Slot {
    media: SpotlightMedia
    origin: SpotlightOrigin
    order: number
    seq: number
  }
  const band: Slot[] = []
  const seen = new Set<string>()
  let seq = 0
  const matureCount = () => band.filter((s) => isMatureAge(s.media.expertAgeRec)).length
  const fits = (m: SpotlightMedia) =>
    !seen.has(m.id) &&
    isShowable(m) &&
    (!isMatureAge(m.expertAgeRec) || matureCount() < SPOTLIGHT_MAX_MATURE)
  const add = (media: SpotlightMedia, origin: SpotlightOrigin, order: number) => {
    seen.add(media.id)
    band.push({ media, origin, order, seq: seq++ })
  }

  // 1. Admin pins: first, counted in the 16+ cap but never dropped by it.
  const ordered = orderActivePins(input.pins, now)
  for (const pin of ordered) {
    if (band.length >= limit) break
    const m = pin.media
    if (pin.source !== "admin" || !m || seen.has(m.id) || !isShowable(m)) continue
    add(m, "admin", band.length)
  }
  const adminCount = band.length
  const watchPins = ordered
    .filter((p) => p.source !== "admin" && p.media)
    .map((p) => p.media as SpotlightMedia)

  // 2. Watch pins, capped so the fallback keeps its slots.
  const watchCap = Math.max(0, Math.min(SPOTLIGHT_WATCH_MAX, limit - SPOTLIGHT_FALLBACK_MIN - adminCount))
  let watchTaken = 0
  watchPins.forEach((m, index) => {
    if (watchTaken >= watchCap || band.length >= limit || !fits(m)) return
    add(m, "watch", 1000 + index)
    watchTaken++
  })

  // 3. Fallback, interleaved film → série → jeu.
  let picks = 0
  roundRobin([fallback.films, fallback.series, fallback.games], (m) => {
    if (band.length >= limit || !fits(m)) return false
    add(m, "fallback", 2000 + picks++)
    return true
  })

  // 4. Watch pins past the cap fill what the fallback could not.
  watchPins.forEach((m, index) => {
    if (band.length < limit && fits(m)) add(m, "watch", 1000 + index)
  })

  // 5. Reserved slots: a recent game, then a film in French cinemas. Already
  //    there (pin or fallback) → that title is kept; otherwise the best
  //    candidate (pins first, then the fallback's ranking) takes the place of
  //    the last title taken that is neither an admin pin nor reserved.
  const kept = new Set<string>()
  const reserve = (satisfies: (m: SpotlightMedia) => boolean, fallbackPool: SpotlightMedia[]) => {
    const present = band.find((s) => satisfies(s.media))
    if (present) {
      kept.add(present.media.id)
      return
    }
    const victim =
      band.length < limit
        ? null
        : band
            .filter((s) => s.origin !== "admin" && !kept.has(s.media.id))
            .reduce<Slot | null>((last, s) => (last == null || s.seq > last.seq ? s : last), null)
    if (band.length >= limit && !victim) return
    const matureAfter = matureCount() - (victim && isMatureAge(victim.media.expertAgeRec) ? 1 : 0)
    const eligible = (m: SpotlightMedia) =>
      satisfies(m) &&
      !seen.has(m.id) &&
      isShowable(m) &&
      (!isMatureAge(m.expertAgeRec) || matureAfter < SPOTLIGHT_MAX_MATURE)
    const pinIndex = watchPins.findIndex(eligible)
    const fromFallback = pinIndex < 0 ? fallbackPool.find(eligible) : undefined
    if (pinIndex < 0 && !fromFallback) return
    if (victim) {
      band.splice(band.indexOf(victim), 1)
      seen.delete(victim.media.id)
    }
    if (pinIndex >= 0) {
      add(watchPins[pinIndex], "watch", 1000 + pinIndex)
      kept.add(watchPins[pinIndex].id)
    } else if (fromFallback) {
      // Takes the replaced title's place when that was a fallback one.
      add(fromFallback, "fallback", victim?.origin === "fallback" ? victim.order : 2999)
      kept.add(fromFallback.id)
    }
  }
  reserve((m) => isRecentGame(m, now), fallback.games)
  reserve(isCinemaFilm, fallback.films)

  return [...band].sort((a, b) => a.order - b.order).map((s) => toItem(s.media, s.origin))
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
 * by trending score weighted by recency (a film out 10 days ago beats one out
 * 7 weeks ago with a similar score); the rest follow in cinema order.
 */
export function rankSpotlightFilms<T extends { id: string; releaseDate?: Date | null } & Trending>(
  cinemaOrder: T[],
  now: Date,
): T[] {
  const indexed = cinemaOrder.map((row, index) => {
    const t = freshTrendingScore(row, now)
    return { row, index, t: t == null ? null : t * launchRecencyFactor(daysSince(row.releaseDate, now)) }
  })
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
 * with a token rating floor, ranked by `gameLaunchScore` (rating count +
 * this week's trending score, weighted by recency), then the most recent.
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
    .map((row, index) => ({
      row,
      index,
      score: gameLaunchScore(
        { votes: row.tmdbVoteCount, trending: freshTrendingScore(row, now), releaseDate: row.releaseDate },
        now,
      ),
    }))
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score
      const date = (b.row.releaseDate?.getTime() ?? 0) - (a.row.releaseDate?.getTime() ?? 0)
      return date || a.index - b.index
    })
    .map(({ row }) => row)
}
