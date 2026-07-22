import type { Prisma } from "@prisma/client"
import { UNRELEASED_TMDB_STATUSES } from "./release-status"

/**
 * Single source of truth for "which unenriched titles can the enrichment
 * pipeline actually process right now?".
 *
 * We never fully enrich a title that isn't out yet — there's no content to
 * assess, so the model confabulates content metrics from the premise. The
 * enrich route (`/api/admin/enrich`) enforces this with the predicate below;
 * the dashboard backlog count and the GET status must use the SAME predicate,
 * otherwise the dashboard shows "N à enrichir" while a manual enrich does
 * nothing (the N are all unreleased — exactly the confusing state this fixes).
 */

/** Prisma predicate: title is released enough to honestly enrich. */
export function notUnreleasedWhere(): Prisma.MediaItemWhereInput {
  const now = new Date()
  return {
    AND: [
      // null release date = unknown/old catalog item → still eligible.
      { OR: [{ releaseDate: null }, { releaseDate: { lte: now } }] },
      // null-safe: keep rows with no status AND rows whose status isn't a
      // pre-release value. A bare NOT/in would drop NULLs.
      { OR: [{ releaseStatus: null }, { releaseStatus: { notIn: [...UNRELEASED_TMDB_STATUSES] } }] },
    ],
  }
}

/**
 * The actionable enrichment backlog: not yet enriched AND already released.
 * Use everywhere "œuvres à enrichir" is counted so the number matches what a
 * manual/cron enrich will pick up.
 */
export function unenrichedBacklogWhere(): Prisma.MediaItemWhereInput {
  return { AND: [{ isEnriched: false }, notUnreleasedWhere()] }
}

/** How far back a release still counts as "fresh" and jumps the queue. */
export const FRESH_RELEASE_WINDOW_DAYS = 120

/**
 * PRIORITY TIER: titles that came out recently and still have no analysis.
 *
 * Why this exists — the failure it fixes: the enrichment queue was ordered
 * `createdAt: desc` (newest IMPORT first). The pre-release play deliberately
 * imports big titles months ahead so they rank before release, and those
 * titles cannot be enriched while unreleased. The moment they came out they
 * were therefore the OLDEST rows in the queue, i.e. dead last — while the
 * daily import kept refilling the top. A LIFO queue with continuous arrivals
 * never reaches its tail.
 *
 * Net effect: the better the pre-release play worked, the longer the fiche
 * stayed unanalysed after release. L'Odyssée (imported 2025-12-23, released
 * 2026-07-15) sat behind 93 newer rows during its opening week, serving ~79%
 * of all site traffic with its analysis and per-member fit switched off.
 *
 * Ordered by releaseDate desc by the caller, so "out today" is served today.
 */
export function freshlyReleasedWhere(
  days: number = FRESH_RELEASE_WINDOW_DAYS
): Prisma.MediaItemWhereInput {
  const now = new Date()
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return {
    AND: [
      { isEnriched: false },
      { releaseDate: { gte: from, lte: now } },
      {
        OR: [
          { releaseStatus: null },
          { releaseStatus: { notIn: [...UNRELEASED_TMDB_STATUSES] } },
        ],
      },
    ],
  }
}

/**
 * Grace period between a title's release and the analysis being live. Beyond
 * this the fiche is publicly wrong (it shows "analyse en cours" on a title
 * people are actively searching), so the debt digest raises it.
 */
export const RELEASE_ANALYSIS_GRACE_DAYS = 3

/** Released more than the grace period ago and STILL unanalysed → alert. */
export function overdueAnalysisWhere(
  graceDays: number = RELEASE_ANALYSIS_GRACE_DAYS
): Prisma.MediaItemWhereInput {
  const cutoff = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000)
  return {
    AND: [
      { isEnriched: false },
      { releaseDate: { lte: cutoff, not: null } },
      {
        OR: [
          { releaseStatus: null },
          { releaseStatus: { notIn: [...UNRELEASED_TMDB_STATUSES] } },
        ],
      },
    ],
  }
}
