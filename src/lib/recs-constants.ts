/**
 * Recommendation thresholds — single source of truth for the two distinct
 * recommendation contexts, so the numbers can be pinned by the expectations
 * registry and never drift silently.
 *
 *  • minMemberFit — family "movie night" mode (`/api/recommendations/family`):
 *    a title is only proposed if EVERY selected member scores at least this fit
 *    (out of 100). The gate that guarantees nobody is left out.
 *  • qualityFloor — general single-member recommendations
 *    (`/api/recommendations`): only surface mainstream titles whose
 *    `dataQualityScore` clears this bar.
 */
export const RECS_THRESHOLDS = {
  minMemberFit: 66,
  qualityFloor: 70,
} as const
