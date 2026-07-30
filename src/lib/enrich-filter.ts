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

/**
 * How long after release a title must wait before enrichment may run.
 *
 * The guard used to be `releaseDate <= now`, which flips at MIDNIGHT on release
 * day. Spider-Man: Brand New Day opened in France on 2026-07-29 and was
 * enriched at 06:31 that same morning — six hours into its theatrical run,
 * before a single review existed and for a film that cannot be in the model's
 * training data. The model duly confabulated, and published it as parent
 * guidance: « Peut inclure scènes de tension, antagonistes menaçants et
 * contrôles mentaux. » — "peut inclure" being the model saying it does not
 * know, and the mind-control detail being invented outright.
 *
 * A day-0 title is epistemically identical to a day-minus-1 title, so the old
 * threshold was one day too early. Waiting a week lets reviews, parent guides
 * and the CSA rating land first. Meanwhile the fiche is not empty: provisional
 * ages still show (badged "à confirmer") and the content analysis stays hidden
 * via `shouldHideContentAnalysis`, which is the honest state for a film nobody
 * has written about yet.
 *
 * Override with ENRICH_RELEASE_GRACE_DAYS (0 restores the old behaviour).
 */
export const DEFAULT_ENRICH_GRACE_DAYS = 7

export function enrichGraceDays(): number {
  const raw = process.env.ENRICH_RELEASE_GRACE_DAYS
  if (raw == null || raw.trim() === "") return DEFAULT_ENRICH_GRACE_DAYS
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_ENRICH_GRACE_DAYS
}

/** The newest release date currently eligible for enrichment. */
export function enrichCutoffDate(now: Date = new Date()): Date {
  return new Date(now.getTime() - enrichGraceDays() * 24 * 60 * 60 * 1000)
}

/** Prisma predicate: title is released enough to honestly enrich. */
export function notUnreleasedWhere(): Prisma.MediaItemWhereInput {
  const cutoff = enrichCutoffDate()
  return {
    AND: [
      // null release date = unknown/old catalog item → still eligible.
      { OR: [{ releaseDate: null }, { releaseDate: { lte: cutoff } }] },
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
