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
