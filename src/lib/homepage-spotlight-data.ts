/**
 * Server loader for the « À ne pas manquer cette semaine » band. The selection
 * rules are pure and tested in `homepage-spotlight.ts`; this file only reads
 * the catalogue (and the cached TMDB now_playing list behind the cinema rail).
 *
 * Shared by the homepage (cached, `getHomepageSpotlight`) and the
 * homepage-watch cron (`computeHomepageSpotlight`, uncached) so the cron
 * reports exactly what the page would show.
 */

import { unstable_cache } from "next/cache"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import { getCinemaMovies } from "@/lib/cinema"
import {
  SPOTLIGHT_GAME_FRESH_DAYS,
  SPOTLIGHT_SERIES_FRESH_DAYS,
  rankSpotlightFilms,
  rankSpotlightGames,
  rankSpotlightSeries,
  selectSpotlight,
  type SpotlightFallback,
  type SpotlightItem,
  type SpotlightMedia,
  type SpotlightPin,
} from "@/lib/homepage-spotlight"

/** Cache tag: revalidated when an admin removes a pin or the cron writes pins. */
export const HOMEPAGE_SPOTLIGHT_TAG = "homepage-spotlight"

const DAY_MS = 24 * 60 * 60 * 1000

export const spotlightMediaSelect = {
  id: true,
  type: true,
  title: true,
  posterUrl: true,
  expertAgeRec: true,
  isEnriched: true,
  genres: true,
  platforms: true,
  releaseDate: true,
  trendingScore: true,
  trendingUpdatedAt: true,
  tmdbVoteCount: true,
  contentMetrics: {
    select: { violence: true, sexNudity: true, language: true, substanceUse: true },
  },
} as const satisfies Prisma.MediaItemSelect

export type SpotlightRow = Prisma.MediaItemGetPayload<{ select: typeof spotlightMediaSelect }>

export function toSpotlightMedia(row: SpotlightRow): SpotlightMedia | null {
  if (row.type !== "MOVIE" && row.type !== "TV" && row.type !== "GAME") return null
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    posterUrl: row.posterUrl,
    expertAgeRec: row.expertAgeRec,
    isEnriched: row.isEnriched,
    genres: row.genres ?? [],
    contentMetrics: row.contentMetrics
      ? {
          violence: row.contentMetrics.violence,
          sexNudity: row.contentMetrics.sexNudity,
          language: row.contentMetrics.language,
          substanceUse: row.contentMetrics.substanceUse,
        }
      : null,
  }
}

function mediaList(rows: SpotlightRow[]): SpotlightMedia[] {
  return rows.map(toSpotlightMedia).filter((m): m is SpotlightMedia => m !== null)
}

/** Active pins. An absent table (migration 016 not applied yet) reads as none. */
export async function loadSpotlightPins(now: Date): Promise<SpotlightPin[]> {
  try {
    const rows = await withPrismaRetry(() =>
      prisma.homepageSpotlight.findMany({
        where: { startsAt: { lte: now }, expiresAt: { gt: now } },
        orderBy: [{ rank: "asc" }],
        take: 40,
        select: {
          mediaId: true,
          source: true,
          rank: true,
          startsAt: true,
          expiresAt: true,
          media: { select: spotlightMediaSelect },
        },
      }),
    )
    return rows.map((r) => ({
      mediaId: r.mediaId,
      source: r.source,
      rank: r.rank,
      startsAt: r.startsAt,
      expiresAt: r.expiresAt,
      media: r.media ? toSpotlightMedia(r.media) : null,
    }))
  } catch {
    return []
  }
}

/** The ranked fallback lists (each kept short: the band shows at most 8). */
export async function loadSpotlightFallback(now: Date): Promise<SpotlightFallback> {
  const [films, series, games] = await Promise.all([
    (async () => {
      try {
        // Same list, same French order as the « À l'affiche » rail.
        const cinema = await getCinemaMovies()
        const ids = cinema.filter((m) => m.inDatabase).map((m) => m.id)
        if (ids.length === 0) return []
        const rows = await withPrismaRetry(() =>
          prisma.mediaItem.findMany({ where: { id: { in: ids }, type: "MOVIE" }, select: spotlightMediaSelect }),
        )
        const byId = new Map(rows.map((r) => [r.id, r]))
        const inCinemaOrder = ids.map((id) => byId.get(id)).filter((r): r is SpotlightRow => !!r)
        return mediaList(rankSpotlightFilms(inCinemaOrder, now).slice(0, 12))
      } catch {
        return []
      }
    })(),
    (async () => {
      try {
        const rows = await withPrismaRetry(() =>
          prisma.mediaItem.findMany({
            where: {
              type: "TV",
              trendingScore: { not: null },
              releaseDate: { gte: new Date(now.getTime() - SPOTLIGHT_SERIES_FRESH_DAYS * DAY_MS) },
              platforms: { isEmpty: false },
            },
            orderBy: { trendingScore: "desc" },
            take: 40,
            select: spotlightMediaSelect,
          }),
        )
        return mediaList(rankSpotlightSeries(rows, now).slice(0, 12))
      } catch {
        return []
      }
    })(),
    (async () => {
      try {
        const rows = await withPrismaRetry(() =>
          prisma.mediaItem.findMany({
            where: {
              type: "GAME",
              expertAgeRec: { not: null },
              posterUrl: { not: null },
              releaseDate: { gte: new Date(now.getTime() - SPOTLIGHT_GAME_FRESH_DAYS * DAY_MS), lte: now },
            },
            orderBy: [{ trendingScore: { sort: "desc", nulls: "last" } }, { tmdbVoteCount: { sort: "desc", nulls: "last" } }],
            take: 60,
            select: spotlightMediaSelect,
          }),
        )
        return mediaList(rankSpotlightGames(rows, now).slice(0, 12))
      } catch {
        return []
      }
    })(),
  ])
  return { films, series, games }
}

/** Uncached: what the band shows right now (used by the homepage-watch cron). */
export async function computeHomepageSpotlight(now = new Date()): Promise<SpotlightItem[]> {
  const [pins, fallback] = await Promise.all([loadSpotlightPins(now), loadSpotlightFallback(now)])
  return selectSpotlight({ pins, fallback, now })
}

/**
 * Cached for the homepage (server-rendered into the HTML — no client fetch,
 * so the band never delays LCP). 30 min, like the cinema API; the admin
 * « retirer » action and the cron revalidate the tag immediately.
 */
export const getHomepageSpotlight = unstable_cache(
  async (): Promise<SpotlightItem[]> => {
    try {
      return await computeHomepageSpotlight(new Date())
    } catch {
      return []
    }
  },
  ["homepage-spotlight-v1"],
  { revalidate: 1800, tags: [HOMEPAGE_SPOTLIGHT_TAG] },
)
