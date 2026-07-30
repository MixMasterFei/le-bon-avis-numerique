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

/**
 * IGDB lifecycle values (`GameStatusEnum`) meaning "not playable yet". Games
 * store their own vocabulary in the SAME `releaseStatus` column, so the gate
 * has to recognise both. Narrow on purpose: `early_access` is publicly
 * playable and `offline`/`cancelled`/`delisted` describe games that WERE
 * released — see IGDB_UNRELEASED_STATUSES in src/lib/igdb.ts.
 */
export const UNRELEASED_IGDB_STATUSES: readonly string[] = ["alpha", "beta", "rumored"]

/**
 * True when a status string denotes a not-yet-released title, in either the
 * TMDB (movies/TV) or IGDB (games) vocabulary. Comparison is case-insensitive
 * so a lowercase game status can never silently bypass the gate — the exact
 * trap of storing "rumored" next to TMDB's "Rumored".
 */
export function isUnreleasedStatus(status?: string | null): boolean {
  if (!status) return false
  const s = status.toLowerCase()
  return (
    UNRELEASED_TMDB_STATUSES.some((v) => v.toLowerCase() === s) ||
    UNRELEASED_IGDB_STATUSES.some((v) => v.toLowerCase() === s)
  )
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
