/**
 * Deterministic age FLOOR from content signals — the symmetric counterpart to
 * `clampMetricsByAge` in the enrichment route.
 *
 * Problem it fixes: French official ratings are often lenient (acclaimed adult
 * dramas like Forrest Gump are "Tous Publics"), and the LLM rubric anchors the
 * recommended age to that rating — so mature films were landing in the 8-12
 * bands. Totem's promise is INDEPENDENT guidance that can be stricter than a
 * lenient CNC/CSA rating, so a mature title's recommended age must be allowed to
 * rise above the official one.
 *
 * Design (per the agreed spec):
 *  - Only ever RAISES the age, never lowers it.
 *  - Per-axis thresholds, not a blind "Tous Publics → min 13", to avoid
 *    over-flagging family comedies (a bit of language ≠ 16+).
 *  - Animation discount: stylized peril reads softer than live action.
 *  - War/WWII/Resistance themes get a pre-teen floor even when raw metrics read
 *    moderate (the Forrest Gump / war-drama case).
 *  - Games are left to their PEGI mapping (different, more reliable pipeline).
 *  - officialRating is intentionally NOT an input — it can never lower the floor.
 */

export interface AgeFloorInput {
  expertAgeRec: number
  metrics?: {
    violence?: number | null
    sexNudity?: number | null
    language?: number | null
    substanceUse?: number | null
  } | null
  genres?: string[] | null
  topics?: string[] | null
  visualStyle?: string | null
  type?: string | null
}

const ANIMATION_STYLES = new Set([
  "Animation 2D classique",
  "Animation 3D/CGI",
  "Stop motion",
  "Anime japonais",
])

const WAR_TOPICS = new Set(["guerre", "seconde guerre mondiale", "résistance"])

/** Whether a title reads as animation (stylized) vs live action. */
export function isAnimationStyle(
  visualStyle?: string | null,
  genres?: string[] | null,
): boolean {
  if (visualStyle && ANIMATION_STYLES.has(visualStyle)) return true
  return (genres ?? []).some((g) => /^animation$|anime/i.test(g.trim()))
}

/**
 * Returns the content-justified minimum recommended age, never below the
 * provided `expertAgeRec`.
 */
export function floorExpertAgeBySignals(input: AgeFloorInput): number {
  const age = input.expertAgeRec
  if (typeof age !== "number") return age
  // Games map age from PEGI in their own pipeline — don't second-guess it here.
  if (input.type === "GAME") return age

  const m = input.metrics ?? {}
  const n = (x?: number | null) => (typeof x === "number" ? x : 0)
  const maxAxis = Math.max(
    n(m.violence),
    n(m.sexNudity),
    n(m.language),
    n(m.substanceUse),
  )
  const anim = isAnimationStyle(input.visualStyle, input.genres)

  let floor = 0
  if (maxAxis >= 4) floor = anim ? 12 : 14
  else if (maxAxis >= 3) floor = anim ? 10 : 12

  // War / WWII / Resistance themes warrant at least a pre-teen floor in live
  // action even when the raw axes read moderate (the lenient-rated war-drama
  // case: Forrest Gump, La vie est belle, …).
  const topics = (input.topics ?? []).map((t) => t.toLowerCase().trim())
  if (!anim && topics.some((t) => WAR_TOPICS.has(t))) {
    floor = Math.max(floor, 12)
  }

  return Math.max(age, floor)
}
