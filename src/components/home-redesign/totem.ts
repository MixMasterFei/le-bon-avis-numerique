/**
 * The "totem" rating system for the V2 homepage.
 *
 * Source data: ContentMetrics on a 0–5 scale (violence, sexNudity,
 * language, substanceUse). The design's totem uses a 0–3 intensity scale
 * with level words + colors, so we bucket 0–5 → 0–3.
 */

export interface TotemMetrics {
  violence?: number | null
  sexNudity?: number | null
  language?: number | null
  substanceUse?: number | null
}

export type TotemLevel = 0 | 1 | 2 | 3

/** 0–5 content metric → 0–3 totem level: 0→0, 1–2→1, 3→2, 4–5→3. */
export function totemLevel(v: number | null | undefined): TotemLevel {
  if (!v || v <= 0) return 0
  if (v <= 2) return 1
  if (v <= 3) return 2
  return 3
}

export const TOTEM_WORDS = ["Aucun", "Léger", "Modéré", "Marqué"] as const

// CSS vars resolved within [data-home="v2"].
export const TOTEM_COLORS = [
  "var(--r0)",
  "var(--r1)",
  "var(--r2)",
  "var(--r3)",
] as const

export interface TotemAxis {
  key: keyof TotemMetrics
  short: string
  label: string
}

export const TOTEM_AXES: TotemAxis[] = [
  { key: "violence", short: "V", label: "Violence" },
  { key: "sexNudity", short: "S", label: "Sexe / Sensualité" },
  { key: "language", short: "L", label: "Langage" },
  { key: "substanceUse", short: "A", label: "Substances" },
]

/** True when there's at least one non-null axis to show a content totem. */
export function hasTotemData(m: TotemMetrics | null | undefined): boolean {
  if (!m) return false
  return [m.violence, m.sexNudity, m.language, m.substanceUse].some(
    (x) => typeof x === "number",
  )
}
