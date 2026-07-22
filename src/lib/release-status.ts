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
 * WHY the content analysis is withheld. The two reasons look identical to the
 * gate but must NEVER read the same to a visitor:
 *
 *  - "unreleased"        → nobody has seen it yet. "après la sortie" is true.
 *  - "awaiting-analysis" → it IS out, we just haven't analysed it yet. Saying
 *                          "après la sortie" here is a factual error, which is
 *                          exactly what shipped on L'Odyssée for the week
 *                          following its 15/07/2026 release.
 *
 * Order matters: genuinely-unreleased wins, because a future-dated title is
 * also provisional and the release wording is the more informative of the two.
 */
export type ContentAnalysisHiddenReason = "unreleased" | "awaiting-analysis"

export function contentAnalysisHiddenReason(
  m: ContentAnalysisGateInput
): ContentAnalysisHiddenReason | null {
  if (isUnreleased(m.releaseDate)) return "unreleased"
  if (isUnreleasedStatus(m.releaseStatus)) return "unreleased"
  const provisional =
    m.isProvisional ?? (m.isEnriched === false && m.expertAgeRec != null)
  if (provisional) return "awaiting-analysis"
  return null
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
 * the content evaluation is withheld. This gate must stay conservative: it is
 * the guarantee that we never publish a fabricated evaluation. To vary the
 * WORDING without weakening the gate, use `contentAnalysisHiddenReason`.
 */
export function shouldHideContentAnalysis(m: ContentAnalysisGateInput): boolean {
  return contentAnalysisHiddenReason(m) !== null
}

/**
 * A title that is OUT but still unanalysed — the state that must never persist.
 * `freshlyReleasedWhere` (enrich-filter) prioritises exactly this set, and the
 * debt digest alerts when any member is older than the grace period.
 */
export function isReleasedAwaitingAnalysis(m: ContentAnalysisGateInput): boolean {
  return contentAnalysisHiddenReason(m) === "awaiting-analysis"
}
