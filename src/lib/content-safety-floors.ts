/**
 * The full deterministic content-safety floor stack, applied at EVERY write
 * path that persists an `expertAgeRec` + `ContentMetrics` (basic enrich, deep
 * enrich, generate-review, dedupe merge, admin manual edit).
 *
 * Consolidating it here is the durable fix for the class of bug found on
 * 2026-07-11: the floor logic in `age-floor.ts` was correct, but individual
 * call sites fed it the WRONG inputs — the fresh LLM `tags` instead of the
 * persisted `topics` (so the deterministic "Horreur" signal never reached the
 * floor), or skipped the PEGI descriptor floor entirely — which silently
 * LOWERED already-correct ages on re-enrichment. Testing the pure function did
 * not catch it because the defect lived at the call site. One shared entry
 * point removes the opportunity to wire a new path wrong.
 *
 * The stack, in order (each step only ever RAISES safety, never lowers it):
 *   1. applyPegiContentFloors — official PEGI descriptors floor the content axes
 *   2. floorExpertAgeBySignals — content signals floor the recommended age
 *   3. clampMetricsByAge       — a title curated young caps its own sensible axes
 *
 * Callers MUST pass the item's PERSISTED topics (deterministic, IGDB-derived —
 * the reliable "Horreur"/"Guerre" signal), optionally unioned with any fresh
 * LLM tags, but NEVER the fresh tags alone.
 */

import { floorExpertAgeBySignals } from "./age-floor"
import { applyPegiContentFloors } from "./pegi-descriptors"

/** A title the model itself curated as this young or younger has its sensible
 *  content axes capped — a backstop beyond the LLM rubric. Keyed on the floored
 *  expertAgeRec (trustworthy), not officialRating (unreliable here). */
export const YOUNG_AGE = 8

/** The four "sensible" content axes every metrics object must carry. Other
 *  axes (consumerism, positiveMessages, roleModels) are preserved untouched. */
interface SensibleAxes {
  violence: number
  sexNudity: number
  language: number
  substanceUse: number
}

/**
 * Cap the sensible content axes for titles recommended at or below YOUNG_AGE.
 * Returns a new object; never raises a score. Generic so it preserves whatever
 * extra axes the caller's metrics object carries.
 */
export function clampMetricsByAge<M extends SensibleAxes>(
  metrics: M,
  expertAge: number | null | undefined,
): M {
  if (typeof expertAge !== "number" || expertAge > YOUNG_AGE) return metrics
  const cap = (v: number) => Math.min(v, 2)
  return {
    ...metrics,
    violence: cap(metrics.violence),
    sexNudity: cap(metrics.sexNudity),
    language: cap(metrics.language),
    substanceUse: cap(metrics.substanceUse),
  }
}

export interface ContentSafetyFloorInput<M extends SensibleAxes> {
  /** The candidate recommended age (LLM output, heuristic, or existing value). */
  expertAgeRec: number
  /** Full metrics object; only the 4 sensible axes are floored/clamped. */
  metrics: M
  genres?: string[] | null
  /** MUST already include the item's persisted `topics`, not just fresh tags. */
  topics?: string[] | null
  visualStyle?: string | null
  type?: string | null
  officialRating?: string | null
  /** Official PEGI descriptor labels (games) — floor the matching axes. */
  pegiDescriptors?: string[] | null
}

/**
 * Apply the complete deterministic safety stack and return the floored age +
 * metrics. This is the single sanctioned way to compute the persisted values.
 */
export function applyContentSafetyFloors<M extends SensibleAxes>(
  input: ContentSafetyFloorInput<M>,
): { expertAgeRec: number; metrics: M } {
  // 1. Official PEGI descriptors are authoritative — floor the matching axes
  //    FIRST so a raised axis can also lift the age in step 2.
  const pegiFloored = applyPegiContentFloors(
    input.metrics,
    input.pegiDescriptors,
    input.officialRating,
  )

  // 2. Content signals floor the recommended age (never lowers it).
  const flooredAge = floorExpertAgeBySignals({
    expertAgeRec: input.expertAgeRec,
    metrics: pegiFloored,
    genres: input.genres,
    topics: input.topics,
    visualStyle: input.visualStyle,
    type: input.type,
    officialRating: input.officialRating,
  })

  // 3. Young-curated titles cap their own axes (uses the FLOORED age so a
  //    raised age doesn't then get its axes capped).
  const clamped = clampMetricsByAge(pegiFloored, flooredAge)

  return { expertAgeRec: flooredAge, metrics: clamped }
}
