/**
 * "Tendance du moment" refresh.
 *
 * The homepage time-aware hero rail used to order its pools by
 * `tmdbVoteCount` (lifetime accumulated votes) — stable, but stale: it
 * surfaced the same evergreen blockbusters every day. This module pulls a
 * FRESH popularity signal (TMDB /trending weekly + IGDB popularity
 * primitives), matches it against titles already in our catalogue, and
 * writes a rank-normalized `trendingScore` (0–100, top item = 100) that
 * the rail orders by instead.
 *
 * Design notes:
 *  - Score is derived from the item's RANK in the external trending list,
 *    not its raw popularity value, so movies/TV/games stay comparable on
 *    one 0–100 scale (cross-type mixing in the rail stays sane).
 *  - We only ever score titles ALREADY in the catalogue (no imports here)
 *    — the rail's own age/quality/horror filters then decide what shows.
 *  - Each run resets prior scores first, so a title that drops out of the
 *    trending lists stops being boosted. `trendingUpdatedAt` records when.
 *  - Best-effort: a failing source (e.g. IGDB down) is skipped, never
 *    throws the whole refresh.
 */

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import { getTrendingMovies, getTrendingTVShows } from "@/lib/tmdb"
import { getTrendingGameIds } from "@/lib/igdb"

export interface TrendingRefreshStats {
  movies: number
  tv: number
  games: number
  total: number
  errors: number
}

// How deep to pull each source. TMDB returns ~20 results/page.
const TMDB_PAGES = 2
const IGDB_LIMIT = 120

// Rank → 0–100 score. Top of the list = 100, tail ≈ 1. Floored at 1 so a
// trending title is always distinguishable from a non-trending one (NULL).
function rankScore(index: number, length: number): number {
  if (length <= 1) return 100
  return Math.max(1, Math.round((100 * (length - index)) / length))
}

// Pull an ordered list of TMDB ids for one media kind across N pages.
// De-dupes while preserving first-seen order (= trending rank).
async function fetchTmdbTrendingIds(
  kind: "movie" | "tv",
  pages: number
): Promise<number[]> {
  const seen = new Set<number>()
  const ordered: number[] = []
  for (let page = 1; page <= pages; page++) {
    const res =
      kind === "movie"
        ? await getTrendingMovies("week", page)
        : await getTrendingTVShows("week", page)
    for (const item of res.results) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        ordered.push(item.id)
      }
    }
  }
  return ordered
}

// Match an ordered list of external ids to catalogue rows, then build the
// {id, score} pairs. `findRows` resolves externalId → internal row id.
async function scoreByExternalRank(
  orderedExternalIds: number[],
  findRows: (ids: number[]) => Promise<Array<{ id: string; externalId: number }>>
): Promise<Array<{ id: string; score: number }>> {
  if (orderedExternalIds.length === 0) return []
  const rows = await findRows(orderedExternalIds)
  const byExternal = new Map(rows.map((r) => [r.externalId, r.id]))
  const out: Array<{ id: string; score: number }> = []
  orderedExternalIds.forEach((extId, index) => {
    const internalId = byExternal.get(extId)
    if (internalId) {
      out.push({ id: internalId, score: rankScore(index, orderedExternalIds.length) })
    }
  })
  return out
}

// Single round-trip write: VALUES join keyed on the internal id. Inputs
// are catalogue uuids + numbers we computed, so no injection surface, but
// we still parameterize via Prisma.sql. The id column is `text`.
async function writeScores(pairs: Array<{ id: string; score: number }>): Promise<void> {
  if (pairs.length === 0) return
  const tuples = pairs.map((p) => Prisma.sql`(${p.id}, ${p.score})`)
  await withPrismaRetry(() =>
    prisma.$executeRaw`
      UPDATE media_items AS m
      SET trending_score = v.score::double precision,
          trending_updated_at = NOW()
      FROM (VALUES ${Prisma.join(tuples)}) AS v(id, score)
      WHERE m.id = v.id
    `
  )
}

/**
 * Refresh the trending signal across films, séries and jeux.
 * Resets prior scores, then writes the fresh batch. Never throws on a
 * single-source failure — partial refreshes are logged via `errors`.
 */
export async function refreshTrending(): Promise<TrendingRefreshStats> {
  const stats: TrendingRefreshStats = { movies: 0, tv: 0, games: 0, total: 0, errors: 0 }

  // 1. Clear last run's boosts so dropped-out titles stop ranking high.
  await withPrismaRetry(() =>
    prisma.mediaItem.updateMany({
      where: { trendingScore: { not: null } },
      data: { trendingScore: null, trendingUpdatedAt: null },
    })
  )

  const allPairs: Array<{ id: string; score: number }> = []

  // 2. Films (TMDB /trending/movie/week).
  try {
    const ids = await fetchTmdbTrendingIds("movie", TMDB_PAGES)
    const pairs = await scoreByExternalRank(ids, async (tmdbIds) => {
      const rows = await withPrismaRetry(() =>
        prisma.mediaItem.findMany({
          where: { type: "MOVIE", tmdbId: { in: tmdbIds } },
          select: { id: true, tmdbId: true },
        })
      )
      return rows.flatMap((r) => (r.tmdbId != null ? [{ id: r.id, externalId: r.tmdbId }] : []))
    })
    stats.movies = pairs.length
    allPairs.push(...pairs)
  } catch {
    stats.errors++
  }

  // 3. Séries (TMDB /trending/tv/week).
  try {
    const ids = await fetchTmdbTrendingIds("tv", TMDB_PAGES)
    const pairs = await scoreByExternalRank(ids, async (tmdbIds) => {
      const rows = await withPrismaRetry(() =>
        prisma.mediaItem.findMany({
          where: { type: "TV", tmdbId: { in: tmdbIds } },
          select: { id: true, tmdbId: true },
        })
      )
      return rows.flatMap((r) => (r.tmdbId != null ? [{ id: r.id, externalId: r.tmdbId }] : []))
    })
    stats.tv = pairs.length
    allPairs.push(...pairs)
  } catch {
    stats.errors++
  }

  // 4. Jeux (IGDB popularity primitives).
  try {
    const trending = await getTrendingGameIds(IGDB_LIMIT)
    const orderedIgdbIds = trending.map((t) => t.gameId)
    const pairs = await scoreByExternalRank(orderedIgdbIds, async (igdbIds) => {
      const rows = await withPrismaRetry(() =>
        prisma.mediaItem.findMany({
          where: { type: "GAME", igdbId: { in: igdbIds } },
          select: { id: true, igdbId: true },
        })
      )
      return rows.flatMap((r) => (r.igdbId != null ? [{ id: r.id, externalId: r.igdbId }] : []))
    })
    stats.games = pairs.length
    allPairs.push(...pairs)
  } catch {
    stats.errors++
  }

  // 5. One write for the whole batch.
  await writeScores(allPairs)
  stats.total = allPairs.length

  return stats
}
