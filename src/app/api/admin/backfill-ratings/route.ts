import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { prisma } from "@/lib/prisma"
import { logCronRun } from "@/lib/cron-log"
import { refreshFromTmdb, TMDB_REFRESH_SELECT, zeroVoteRefreshWhere } from "@/lib/tmdb-refresh"

export const maxDuration = 60

const BATCH = 50
// Stop fetching with room left for the counts + cron log under maxDuration.
const TIME_BUDGET_MS = 45_000

/** Items with a tmdbId but no rating stored yet. */
const UNRATED_WHERE: Prisma.MediaItemWhereInput = {
  tmdbId: { not: null },
  tmdbRating: null,
  type: { in: ["MOVIE", "TV"] },
}

/**
 * POST /api/admin/backfill-ratings
 * Two queues, up to 50 items per call to stay within timeout:
 *  1. items that never got tmdbRating/tmdbVoteCount;
 *  2. released items whose stored vote count is still 0 — a pre-release
 *     import stores 0/0 and was never re-read, which kept new films out of
 *     every vote-gated list. See zeroVoteRefreshWhere (src/lib/tmdb-refresh.ts).
 *
 * Every row read is stamped (tmdbCheckedAt), so a row whose votes are still 0
 * leaves the queue until its next weekly re-read instead of being re-selected
 * by the next batch: `remaining` really drains and the Saturday loop ends.
 * The `vote_average` 0 is persisted too (see tmdbRefreshPatch) — otherwise
 * tmdbRating stays NULL and the backfill loops forever on the same top-N items.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()

  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const unrated = await prisma.mediaItem.findMany({
    where: UNRATED_WHERE,
    select: TMDB_REFRESH_SELECT,
    take: BATCH,
    orderBy: { dataQualityScore: "desc" },
  })
  const zeroVotes =
    unrated.length < BATCH
      ? await prisma.mediaItem.findMany({
          where: zeroVoteRefreshWhere(new Date()),
          select: TMDB_REFRESH_SELECT,
          take: BATCH - unrated.length,
          // Most recent releases first: they gain votes fastest and are the ones
          // vote-gated lists (featured, « meilleurs films 2026 ») are missing.
          orderBy: [{ releaseDate: "desc" }, { id: "asc" }],
        })
      : []

  if (unrated.length === 0 && zeroVotes.length === 0) {
    await logCronRun({
      task: "backfill-ratings",
      status: "success",
      summary: "Tous les items ont deja des notes TMDB",
      startTime,
    })
    return NextResponse.json({ message: "All items already have ratings", updated: 0, remaining: 0 })
  }

  const result = await refreshFromTmdb([...unrated, ...zeroVotes], {
    deadline: startTime + TIME_BUDGET_MS,
    delayMs: 150,
  })

  const [remainingUnrated, remainingZeroVotes] = await Promise.all([
    prisma.mediaItem.count({ where: UNRATED_WHERE }),
    prisma.mediaItem.count({ where: zeroVoteRefreshWhere(new Date()) }),
  ])
  const remaining = remainingUnrated + remainingZeroVotes
  // "updated" = rows re-read and written (data and/or cursor). The Saturday
  // loop stops when a batch makes no progress at all (updated = unratable = 0).
  const updated = result.updated + result.unchanged

  await logCronRun({
    task: "backfill-ratings",
    status: result.errors > 0 ? "partial" : "success",
    summary:
      `${updated} notes TMDB relues (${result.votesGained} titres sortis du zero vote)` +
      `${result.notFound > 0 ? `, ${result.notFound} sans fiche TMDB (ignores)` : ""}, ${remaining} restants`,
    details: {
      updated,
      changed: result.updated,
      votesGained: result.votesGained,
      unratable: result.notFound,
      errors: result.errors,
      unratedBatch: unrated.length,
      zeroVoteBatch: zeroVotes.length,
      remaining,
      remainingUnrated,
      remainingZeroVotes,
    },
    startTime,
  })

  return NextResponse.json({
    updated,
    changed: result.updated,
    votesGained: result.votesGained,
    unratable: result.notFound,
    errors: result.errors,
    remaining,
    remainingUnrated,
    remainingZeroVotes,
    message: remaining > 0
      ? `Updated ${updated} items. ${remaining} remaining - call again to continue.`
      : `Done! Updated ${updated} items. All items now have ratings.`,
  })
}
