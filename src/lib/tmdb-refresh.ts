import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getMovieDetails, getTVDetails } from "@/lib/tmdb"
import { UNRELEASED_TMDB_STATUSES, isUnreleasedStatus } from "@/lib/release-status"

/**
 * Post-import TMDB refresh. Imports write three things ONCE that go stale the
 * moment a title is released, and nothing ever re-read them:
 *
 *  - `releaseStatus` — a film imported in "Post Production" kept that status
 *    after release, and the enrichment gate (enrich-filter.ts) excludes those
 *    statuses, so it stayed « âge provisoire » forever. Measured 2026-11-06:
 *    56 films released more than a week earlier, e.g. « Les Ensorceleuses 2 »
 *    (out 2026-09-09, still "Post Production").
 *  - `tmdbRating` / `tmdbVoteCount` — 0/0 before release, so every vote-gated
 *    list (featured ≥ 200 votes, « meilleurs films 2026 » ≥ 20) silently
 *    excluded the year's new films: 156 of the 274 released in six months.
 *    And a count read once stays frozen: imports skip titles already in the
 *    catalogue, so nothing else ever re-reads it (see recentReleaseVotesWhere).
 *  - `releaseDate` when TMDB had none at import (filled in, never overwritten).
 *
 * One TMDB details call answers all of them, so both refreshes share
 * `refreshFromTmdb`: the daily release-status refresh
 * (/api/admin/refresh-release-status) and the Saturday ratings backfill
 * (/api/admin/backfill-ratings). `tmdbCheckedAt` records each re-read so the
 * selections rotate instead of re-asking about the same rows.
 */

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

/** A pre-release status whose date has passed is re-read once per daily run. */
export const RELEASE_STATUS_RECHECK_HOURS = 20
/** Announced titles with no date at all are re-read weekly. */
export const UNDATED_RELEASE_STATUS_RECHECK_DAYS = 7

/**
 * End state of a title TMDB no longer knows. A 404 is nearly always final (the
 * entry was deleted or merged into another id, which TMDB never reuses), but
 * one could be a glitch, so the title leaves the refresh queues only after
 * this many CONSECUTIVE 404s — three days on the daily release-status queue,
 * three weeks on the vote queue. Any answer resets the streak. A title given
 * up keeps its last status, so a pre-release one stays out of enrichment (we
 * cannot confirm it is out); it is listed in the run's cron log (`gaveUp`) so
 * a human can delete or re-link the fiche.
 */
export const TMDB_NOT_FOUND_GIVE_UP = 3

/**
 * Vote follow-up of recent releases (Saturday ratings backfill) — see
 * recentReleaseVotesWhere. The numbers:
 *
 *  - 500 votes: the highest gate any film/series list applies (expert picks,
 *    the homepage hero's quality pools). Past it, every gate is open — the
 *    lower ones are 20 (« meilleurs films 2026 »), 50 (quality sort), 80 (new
 *    releases rails), 100 (family recommendations, editorial suggestions),
 *    200 (featured), 300 (family series) — and the count stops mattering.
 *  - weekly for 90 days: the theatrical run and, abroad, the first digital
 *    release — when TMDB votes move fastest.
 *  - every four weeks until 365 days: the « année » lists, the new-release
 *    rails and the editorial freshness rule (family-content-agent.ts: one-year
 *    window, ≥ 100 votes) all care about a title for its first year.
 *  - then retired: an older title's count barely moves, and re-reading the
 *    whole back catalogue every month would cost thousands of calls a week.
 *
 * Load: ~550 films a year (274 released in six months, measured 2026-11-06)
 * plus series ⇒ a few hundred TMDB reads per Saturday in steady state, well
 * inside the backfill loop's 35 × 50 budget.
 */
export const RECENT_VOTES_CEILING = 500
export const RECENT_VOTES_WEEKLY_DAYS = 90
export const RECENT_VOTES_MAX_DAYS = 365
/** Re-read cadences, one day short of a week / four weeks (the backfill runs weekly). */
export const RECENT_VOTES_WEEKLY_RECHECK_DAYS = 6
export const RECENT_VOTES_MONTHLY_RECHECK_DAYS = 27

const daysBefore = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS)

/**
 * Titles still carrying a TMDB pre-release status that are due for a re-read:
 * their release date has passed (daily), or they have no date yet (weekly —
 * an announced sequel gets a date and a status the day TMDB publishes them).
 * The queue drains as TMDB catches up; a title TMDB no longer knows leaves it
 * after TMDB_NOT_FOUND_GIVE_UP consecutive 404s.
 */
export function staleReleaseStatusWhere(now: Date = new Date()): Prisma.MediaItemWhereInput {
  const datedCheckedBefore = new Date(now.getTime() - RELEASE_STATUS_RECHECK_HOURS * HOUR_MS)
  const undatedCheckedBefore = daysBefore(now, UNDATED_RELEASE_STATUS_RECHECK_DAYS)
  return {
    type: { in: ["MOVIE", "TV"] },
    tmdbId: { not: null },
    tmdbNotFoundCount: { lt: TMDB_NOT_FOUND_GIVE_UP },
    releaseStatus: { in: [...UNRELEASED_TMDB_STATUSES] },
    OR: [
      {
        releaseDate: { lte: now },
        OR: [{ tmdbCheckedAt: null }, { tmdbCheckedAt: { lt: datedCheckedBefore } }],
      },
      {
        releaseDate: null,
        OR: [{ tmdbCheckedAt: null }, { tmdbCheckedAt: { lt: undatedCheckedBefore } }],
      },
    ],
  }
}

/** Least recently re-read first, then the longest overdue. */
export const STALE_RELEASE_STATUS_ORDER: Prisma.MediaItemOrderByWithRelationInput[] = [
  { tmdbCheckedAt: { sort: "asc", nulls: "first" } },
  { releaseDate: { sort: "asc", nulls: "last" } },
  { id: "asc" },
]

/**
 * Released titles whose vote counters are due for a re-read, WHATEVER their
 * count. It used to take only titles still at exactly 0 votes: a film that
 * went from 0 to 5 left the queue for good and never reached the 20, 100 or
 * 200 votes the lists ask for — nothing else re-reads a title once imported.
 *
 *  - Ageing: weekly during the first 90 days after release, then every four
 *    weeks until day 365 (numbers justified above RECENT_VOTES_CEILING).
 *  - Retirement: 500 votes or more (every gate open), or older than 365 days,
 *    or TMDB_NOT_FOUND_GIVE_UP consecutive 404s.
 *  - Never-rated rows (tmdbRating null) are left to the backfill's other
 *    queue, so a row is never read twice in one batch.
 *  - Plus a one-time catch-up, outside the window: a zero-vote title never
 *    re-read since import — 63 of the 73 zero-vote films released 60–183 days
 *    ago were imported BEFORE release — is read once, then never again.
 *
 * A row TMDB failed to answer is not stamped (refreshFromTmdb), so it stays
 * due and the next run retries it.
 */
export function recentReleaseVotesWhere(now: Date = new Date()): Prisma.MediaItemWhereInput {
  const weeklyFrom = daysBefore(now, RECENT_VOTES_WEEKLY_DAYS)
  const checkedBefore = (days: number) => ({
    OR: [{ tmdbCheckedAt: null }, { tmdbCheckedAt: { lt: daysBefore(now, days) } }],
  })
  return {
    type: { in: ["MOVIE", "TV"] },
    tmdbId: { not: null },
    tmdbNotFoundCount: { lt: TMDB_NOT_FOUND_GIVE_UP },
    tmdbRating: { not: null },
    releaseDate: { lte: now },
    AND: [
      { OR: [{ tmdbVoteCount: null }, { tmdbVoteCount: { lt: RECENT_VOTES_CEILING } }] },
      {
        OR: [
          { releaseDate: { gte: weeklyFrom }, ...checkedBefore(RECENT_VOTES_WEEKLY_RECHECK_DAYS) },
          {
            releaseDate: { gte: daysBefore(now, RECENT_VOTES_MAX_DAYS), lt: weeklyFrom },
            ...checkedBefore(RECENT_VOTES_MONTHLY_RECHECK_DAYS),
          },
          { tmdbVoteCount: 0, tmdbCheckedAt: null },
        ],
      },
    ],
  }
}

export const TMDB_REFRESH_SELECT = {
  id: true,
  title: true,
  type: true,
  tmdbId: true,
  releaseStatus: true,
  releaseDate: true,
  tmdbRating: true,
  tmdbVoteCount: true,
  tmdbNotFoundCount: true,
} satisfies Prisma.MediaItemSelect

export interface TmdbRefreshRow {
  id: string
  title: string
  type: string
  tmdbId: number | null
  releaseStatus: string | null
  releaseDate: Date | null
  tmdbRating: number | null
  tmdbVoteCount: number | null
  /** Consecutive 404s so far (TMDB_REFRESH_SELECT reads it; absent = 0). */
  tmdbNotFoundCount?: number
}

/** The subset of a TMDB movie/TV details payload this refresh reads. */
export interface TmdbLifecycleDetails {
  status?: string | null
  release_date?: string | null
  first_air_date?: string | null
  vote_average?: number | null
  vote_count?: number | null
}

export interface TmdbRefreshPatch {
  releaseStatus?: string
  releaseDate?: Date
  tmdbRating?: number
  tmdbVoteCount?: number
}

/**
 * What to write for one row, given fresh TMDB details: only fields whose value
 * changes. Never blanks a status TMDB didn't return, never overwrites a stored
 * date. Vote counters are stored as TMDB reports them — 0 included — so a
 * never-rated row (tmdbRating null) leaves the ratings queue for good.
 */
export function tmdbRefreshPatch(row: TmdbRefreshRow, details: TmdbLifecycleDetails): TmdbRefreshPatch {
  const patch: TmdbRefreshPatch = {}

  const status = typeof details.status === "string" ? details.status.trim() : ""
  if (status && status !== row.releaseStatus) patch.releaseStatus = status

  if (!row.releaseDate) {
    const raw = row.type === "TV" ? details.first_air_date : details.release_date
    const date = raw ? new Date(raw) : null
    if (date && !Number.isNaN(date.getTime())) patch.releaseDate = date
  }

  const rating = details.vote_average ?? 0
  const votes = details.vote_count ?? 0
  if (rating !== row.tmdbRating) patch.tmdbRating = rating
  if (votes !== row.tmdbVoteCount) patch.tmdbVoteCount = votes

  return patch
}

export interface TmdbRefreshResult {
  /** Rows TMDB answered for (including 404s). */
  examined: number
  /** Rows whose data changed. */
  updated: number
  /** Re-read, nothing new — only the cursor moved. */
  unchanged: number
  /**
   * TMDB answered 404: the cursor moved and the 404 streak grew. NOT drained
   * at once — the title comes back at its next cadence until the streak
   * reaches TMDB_NOT_FOUND_GIVE_UP (see `gaveUp`).
   */
  notFound: number
  /** Transient failures: left unstamped, retried next run. */
  errors: number
  /** Status left the pre-release set → the title can now be enriched. */
  nowReleased: { id: string; title: string; from: string | null; to: string }[]
  /** Vote count went from 0/unknown to > 0 → visible to vote-gated lists. */
  votesGained: number
  /** Reached TMDB_NOT_FOUND_GIVE_UP 404s in a row this run: out of the queues for good. */
  gaveUp: { id: string; title: string }[]
  /** Stopped early to stay inside the function's time budget. */
  bailedOnTime: boolean
}

function isTmdbNotFound(error: unknown): boolean {
  return error instanceof Error && error.message.includes("TMDB API error: 404")
}

/**
 * Moves the cursor (and ends any 404 streak: TMDB answered). Raw UPDATE on
 * purpose: Prisma's @updatedAt would otherwise record "the fiche changed" for
 * a re-read that changed nothing (same convention as src/lib/streaming-sync.ts).
 */
async function stampTmdbChecked(id: string): Promise<void> {
  await prisma.$executeRaw`UPDATE media_items SET tmdb_checked_at = now(), tmdb_not_found_count = 0 WHERE id = ${id}`
}

/** Moves the cursor and lengthens the 404 streak (raw, same reason as above). */
async function stampTmdbNotFound(id: string): Promise<void> {
  await prisma.$executeRaw`UPDATE media_items SET tmdb_checked_at = now(), tmdb_not_found_count = tmdb_not_found_count + 1 WHERE id = ${id}`
}

export async function refreshFromTmdb(
  rows: TmdbRefreshRow[],
  opts: { deadline?: number; delayMs?: number } = {},
): Promise<TmdbRefreshResult> {
  const { deadline, delayMs = 120 } = opts
  const result: TmdbRefreshResult = {
    examined: 0,
    updated: 0,
    unchanged: 0,
    notFound: 0,
    errors: 0,
    nowReleased: [],
    votesGained: 0,
    gaveUp: [],
    bailedOnTime: false,
  }

  for (const row of rows) {
    if (deadline !== undefined && Date.now() > deadline) {
      result.bailedOnTime = true
      break
    }
    if (row.tmdbId == null || (row.type !== "MOVIE" && row.type !== "TV")) continue

    try {
      const details: TmdbLifecycleDetails =
        row.type === "MOVIE" ? await getMovieDetails(row.tmdbId) : await getTVDetails(row.tmdbId)
      result.examined++
      const patch = tmdbRefreshPatch(row, details)

      if (Object.keys(patch).length > 0) {
        await prisma.mediaItem.update({
          where: { id: row.id },
          data: { ...patch, tmdbCheckedAt: new Date(), tmdbNotFoundCount: 0 },
        })
        result.updated++
        if (patch.releaseStatus && isUnreleasedStatus(row.releaseStatus) && !isUnreleasedStatus(patch.releaseStatus)) {
          result.nowReleased.push({ id: row.id, title: row.title, from: row.releaseStatus, to: patch.releaseStatus })
        }
        if ((patch.tmdbVoteCount ?? 0) > 0 && !(row.tmdbVoteCount && row.tmdbVoteCount > 0)) {
          result.votesGained++
        }
      } else {
        await stampTmdbChecked(row.id)
        result.unchanged++
      }
    } catch (error) {
      if (!isTmdbNotFound(error)) {
        result.errors++
      } else {
        // TMDB no longer knows this id (deleted, or merged into another one).
        // The cursor moves and the 404 streak grows; the queues drop the title
        // once the streak reaches TMDB_NOT_FOUND_GIVE_UP — moving the cursor
        // alone only postponed it to the next day, for ever. A never-rated row
        // also gets 0/0 (as the ratings backfill always did), or the
        // never-rated queue re-selects it on every call.
        result.examined++
        try {
          if (row.tmdbRating === null || row.tmdbVoteCount === null) {
            await prisma.mediaItem.update({
              where: { id: row.id },
              data: {
                tmdbRating: row.tmdbRating ?? 0,
                tmdbVoteCount: row.tmdbVoteCount ?? 0,
                tmdbCheckedAt: new Date(),
                tmdbNotFoundCount: { increment: 1 },
              },
            })
          } else {
            await stampTmdbNotFound(row.id)
          }
          result.notFound++
          if ((row.tmdbNotFoundCount ?? 0) + 1 >= TMDB_NOT_FOUND_GIVE_UP) {
            result.gaveUp.push({ id: row.id, title: row.title })
          }
        } catch {
          result.errors++
        }
      }
    }

    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs)) // be gentle on TMDB
  }

  return result
}
