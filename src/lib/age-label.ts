/**
 * How a recommended age is written on badges and meta lines.
 *
 * `expertAgeRec === 0` is a REAL rating — "Tous publics" (CSA TP / CNC U), not
 * a missing one. Every badge used to test `age > 0`, so a TP title rendered
 * with NO badge at all and read as "pas encore noté" on the cards (this is what
 * made "La fin d'Oak Street" look unrated in the family rail). Zero and null
 * are different answers and must look different.
 */

/** Short badge form: "TP" for tous publics, "10+" otherwise, null when unknown. */
export function ageBadgeLabel(age: number | null | undefined): string | null {
  if (typeof age !== "number" || !Number.isFinite(age) || age < 0) return null
  return age === 0 ? "TP" : `${age}+`
}

/** Sentence form for meta lines: "Tous publics" / "conseillé 10+". */
export function ageMetaLabel(age: number | null | undefined): string | null {
  if (typeof age !== "number" || !Number.isFinite(age) || age < 0) return null
  return age === 0 ? "Tous publics" : `conseillé ${age}+`
}

/** Popover / tooltip form: "Tous publics" / "Dès 10 ans". */
export function ageSentenceLabel(age: number | null | undefined): string | null {
  if (typeof age !== "number" || !Number.isFinite(age) || age < 0) return null
  return age === 0 ? "Tous publics" : `Dès ${age} ans`
}
