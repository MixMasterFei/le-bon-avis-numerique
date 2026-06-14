/**
 * Release-status helpers — the single source of truth for "can we honestly
 * show a content analysis for this title yet?".
 *
 * Why this exists: people search "[titre] à partir de quel âge" and land on
 * fiches for films/games that AREN'T OUT YET. We must never present a
 * fabricated content evaluation (violence/sex/language scores, "aucun signal
 * sensible majeur", parent-discussion prompts) for something nobody has seen.
 *
 * `shouldHideContentAnalysis` is deliberately BROADER than `releaseDate > now`:
 * a title with a NULL release date that is actually upcoming (e.g. an
 * announced sequel with no date yet) would otherwise slip through. It is
 * caught via `isProvisional` (once reverted to provisional) and/or the TMDB
 * `releaseStatus` field. Keep all three conditions — each closes a real gap.
 */

/** True when the title has a known release date that is still in the future. */
export function isUnreleased(releaseDate: Date | string | null | undefined): boolean {
  if (!releaseDate) return false
  const t = releaseDate instanceof Date ? releaseDate.getTime() : new Date(releaseDate).getTime()
  if (Number.isNaN(t)) return false
  return t > Date.now()
}

/**
 * TMDB lifecycle values that mean "not out yet". We match on the UNRELEASED
 * set (not `=== "Released"`) because TV uses "Returning Series" / "Ended" for
 * aired shows — a `!== "Released"` check would wrongly flag every series.
 * Movies use "Released"; "Post Production" / "Planned" / "In Production" /
 * "Rumored" are pre-release for both. ("Canceled" is intentionally excluded:
 * a canceled series may already have aired episodes.)
 */
export const UNRELEASED_TMDB_STATUSES: readonly string[] = [
  "Planned",
  "In Production",
  "Post Production",
  "Rumored",
]

/** True when a TMDB status string denotes a not-yet-released title. */
export function isUnreleasedStatus(status?: string | null): boolean {
  return !!status && UNRELEASED_TMDB_STATUSES.includes(status)
}

export interface ContentAnalysisGateInput {
  releaseDate?: Date | string | null
  /** Precomputed provisional flag, if the caller already has it. */
  isProvisional?: boolean
  /** Raw fallback when `isProvisional` isn't precomputed. */
  isEnriched?: boolean
  expertAgeRec?: number | null
  /** TMDB lifecycle: "Released" | "Planned" | "In Production" | "Post Production" | null. */
  releaseStatus?: string | null
}

/**
 * Should the fiche HIDE its content analysis (scores, parent prompts,
 * "réponse rapide" verdict, AggregateRating, content JSON-LD)?
 *
 * True if ANY of:
 *  - the release date is in the future,
 *  - the fiche is provisional (imported, age-estimated, not yet enriched),
 *  - TMDB says it isn't "Released" (catches null-date upcoming titles).
 *
 * The age recommendation itself stays visible (badged "à confirmer") — only
 * the content evaluation is withheld until the title is actually out.
 */
export function shouldHideContentAnalysis(m: ContentAnalysisGateInput): boolean {
  if (isUnreleased(m.releaseDate)) return true
  const provisional =
    m.isProvisional ?? (m.isEnriched === false && m.expertAgeRec != null)
  if (provisional) return true
  if (isUnreleasedStatus(m.releaseStatus)) return true
  return false
}
