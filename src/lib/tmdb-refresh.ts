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

/** Zero-vote refresh window, in days after release. */
export const ZERO_VOTE_MIN_DAYS = 7
export const ZERO_VOTE_MAX_DAYS = 60
/** Inside the window, re-read at most this often (the backfill runs weekly). */
export const ZERO_VOTE_RECHECK_DAYS = 6

const daysBefore = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS)

/**
 * Titles still carrying a TMDB pre-release status that are due for a re-read:
 * their release date has passed (daily), or they have no date yet (weekly —
 * an announced sequel gets a date and a status the day TMDB publishes them).
 */
export function staleReleaseStatusWhere(now: Date = new Date()): Prisma.MediaItemWhereInput {
  const datedCheckedBefore = new Date(now.getTime() - RELEASE_STATUS_RECHECK_HOURS * HOUR_MS)
  const undatedCheckedBefore = daysBefore(now, UNDATED_RELEASE_STATUS_RECHECK_DAYS)
  return {
    type: { in: ["MOVIE", "TV"] },
    tmdbId: { not: null },
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
 * Released titles whose stored vote count is 0 and that are due for a re-read:
 *  - inside the 7–60-day window after release: weekly, while votes accumulate;
 *  - outside it: once, if the row was never re-read since import. That one-time
 *    catch-up drains the backlog this refresh did not exist for — 63 of the 73
 *    zero-vote films released 60–183 days ago were imported BEFORE release —
 *    and then never matches the same row again.
 */
export function zeroVoteRefreshWhere(now: Date = new Date()): Prisma.MediaItemWhereInput {
  return {
    type: { in: ["MOVIE", "TV"] },
    tmdbId: { not: null },
    tmdbVoteCount: 0,
    releaseDate: { lte: daysBefore(now, ZERO_VOTE_MIN_DAYS) },
    OR: [
      { tmdbCheckedAt: null },
      {
        releaseDate: { gte: daysBefore(now, ZERO_VOTE_MAX_DAYS) },
        tmdbCheckedAt: { lt: daysBefore(now, ZERO_VOTE_RECHECK_DAYS) },
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
  /** Gone from TMDB (404): drained, never retried. */
  notFound: number
  /** Transient failures: left unstamped, retried next run. */
  errors: number
  /** Status left the pre-release set → the title can now be enriched. */
  nowReleased: { id: string; title: string; from: string | null; to: string }[]
  /** Vote count went from 0/unknown to > 0 → visible to vote-gated lists. */
  votesGained: number
  /** Stopped early to stay inside the function's time budget. */
  bailedOnTime: boolean
}

function isTmdbNotFound(error: unknown): boolean {
  return error instanceof Error && error.message.includes("TMDB API error: 404")
}

/**
 * Moves the cursor only. Raw UPDATE on purpose: Prisma's @updatedAt would
 * otherwise record "the fiche changed" for a re-read that changed nothing
 * (same convention as src/lib/streaming-sync.ts).
 */
async function stampTmdbChecked(id: string): Promise<void> {
  await prisma.$executeRaw`UPDATE media_items SET tmdb_checked_at = now() WHERE id = ${id}`
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
        await prisma.mediaItem.update({ where: { id: row.id }, data: { ...patch, tmdbCheckedAt: new Date() } })
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
        // Deleted/merged on TMDB — it will never answer. Drain it: a never-
        // rated row gets 0/0 (as the ratings backfill always did, or it is
        // re-selected forever), and the cursor moves either way.
        result.examined++
        try {
          if (row.tmdbRating === null || row.tmdbVoteCount === null) {
            await prisma.mediaItem.update({
              where: { id: row.id },
              data: { tmdbRating: row.tmdbRating ?? 0, tmdbVoteCount: row.tmdbVoteCount ?? 0, tmdbCheckedAt: new Date() },
            })
          } else {
            await stampTmdbChecked(row.id)
          }
          result.notFound++
        } catch {
          result.errors++
        }
      }
    }

    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs)) // be gentle on TMDB
  }

  return result
}
