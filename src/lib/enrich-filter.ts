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
 * When may a newly released title be enriched?
 *
 * The model has never seen a film released this week: it works only from the
 * data we hold (synopsis, keywords, genres, the French certification). On
 * release morning that data is thin and it fills the gaps by inventing. The
 * guard used to be `releaseDate <= now`; Spider-Man: Brand New Day was enriched
 * six hours into its run on 2026-07-29 and published « peut inclure… contrôles
 * mentaux » as parent guidance — invented. A fixed 7-day wait followed.
 *
 * Seven days was too long for us: Search Console (Nov 2026) shows the
 * « [titre] à partir de quel âge » searches peak in release week, while the
 * fiche still showed a provisional age. Rule since 16 Nov 2026 (Xavier):
 *
 * - a released title WITH a French certification (CNC visa — usually known
 *   before release) is eligible from its release day;
 * - one WITHOUT waits ENRICH_RELEASE_GRACE_DAYS (default 3) after release;
 * - nothing unreleased, ever, and no pre-release TMDB status.
 *
 * The certification grounds the age; the model still has only the synopsis
 * for content, so the Age Keeper reviews the first release-week batches.
 * ENRICH_RELEASE_GRACE_DAYS=0 lets everything through on release day.
 */
export const DEFAULT_ENRICH_GRACE_DAYS = 3

export function enrichGraceDays(): number {
  const raw = process.env.ENRICH_RELEASE_GRACE_DAYS
  if (raw == null || raw.trim() === "") return DEFAULT_ENRICH_GRACE_DAYS
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_ENRICH_GRACE_DAYS
}

/** The newest release date eligible WITHOUT a French certification. */
export function enrichCutoffDate(now: Date = new Date()): Date {
  return new Date(now.getTime() - enrichGraceDays() * 24 * 60 * 60 * 1000)
}

/** Pure mirror of notUnreleasedWhere's date rule, for tests and callers holding a row. */
export function isEnrichableRelease(
  item: { releaseDate: Date | null; officialRating?: string | null },
  now: Date = new Date(),
): boolean {
  if (item.releaseDate == null) return true
  if (item.releaseDate.getTime() > now.getTime()) return false
  if (item.officialRating) return true
  return item.releaseDate.getTime() <= enrichCutoffDate(now).getTime()
}

/** Prisma predicate: title is released enough to honestly enrich. */
export function notUnreleasedWhere(now: Date = new Date()): Prisma.MediaItemWhereInput {
  const cutoff = enrichCutoffDate(now)
  return {
    AND: [
      {
        OR: [
          // null release date = unknown/old catalog item → still eligible.
          { releaseDate: null },
          // No French certification: wait the grace period.
          { releaseDate: { lte: cutoff } },
          // French certification known: eligible from release day.
          { AND: [{ releaseDate: { lte: now } }, { officialRating: { not: null } }] },
        ],
      },
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
