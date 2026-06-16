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
  /** Microtransactions / in-game purchases (games). */
  consumerism?: number | null
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

/** Per-axis word override (e.g. purchases read better than "Marqué"). */
export const PURCHASE_WORDS = ["Aucun", "Quelques-uns", "Présents", "Nombreux"] as const

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
  /** Optional level-word override for this axis (else TOTEM_WORDS). */
  words?: readonly string[]
}

// Films / TV / series: the four sensibility axes.
export const TOTEM_AXES_FILM: TotemAxis[] = [
  { key: "violence", short: "V", label: "Violence" },
  { key: "sexNudity", short: "S", label: "Sexe / Sensualité" },
  { key: "language", short: "L", label: "Langage" },
  { key: "substanceUse", short: "A", label: "Substances" },
]

// Games: violence, language, in-game purchases, substances — 4 axes like films.
export const TOTEM_AXES_GAME: TotemAxis[] = [
  { key: "violence", short: "V", label: "Violence" },
  { key: "language", short: "L", label: "Langage" },
  { key: "consumerism", short: "€", label: "Achats intégrés", words: PURCHASE_WORDS },
  { key: "substanceUse", short: "A", label: "Substances" },
]

/** Default export kept for the generic decoder / back-compat (film axes). */
export const TOTEM_AXES = TOTEM_AXES_FILM

/** The axes to display for a given media type. */
export function totemAxesFor(type?: string | null): TotemAxis[] {
  return type === "GAME" ? TOTEM_AXES_GAME : TOTEM_AXES_FILM
}

/** True when there's at least one non-null axis to show a content totem,
 *  scoped to the axes relevant for the media type. */
export function hasTotemData(
  m: TotemMetrics | null | undefined,
  type?: string | null,
): boolean {
  if (!m) return false
  return totemAxesFor(type).some((a) => typeof m[a.key] === "number")
}

// ─────────────────────────────────────────────────────────────────────────
// Vigilance indicator (on-card display)
//
// `totemLevel` above stays the detailed 0–5→0–3 mapping for the fiche. On the
// CARDS we deliberately show a coarser, age-anchored "vigilance" signal so the
// totem reads as "y a-t-il un point à surveiller ?" rather than a precise score:
//
//   - cartoon-friendly bucketing: raw ≤2 → 0, 3 → 1 (léger), 4 → 2 (à noter),
//     5 → 3 (marqué). Mild/stylized peril (most family content sits at 2–3 raw)
//     no longer lights up orange.
//   - age anchor: a young-rated title (expertAge ≤ 8) is capped at 1, so a
//     stray over-scored axis can't make a kids film look as alarming as an
//     action film. expertAge == null → bucketing only (no cap), so a genuinely
//     graphic unrated/provisional title still flags.
// ─────────────────────────────────────────────────────────────────────────

/** Coarse per-axis vigilance level for the card badge/popover. */
export function vigilanceAxisLevel(
  raw: number | null | undefined,
  expertAge?: number | null,
): TotemLevel {
  let level: TotemLevel =
    !raw || raw <= 2 ? 0 : raw === 3 ? 1 : raw === 4 ? 2 : 3
  if (typeof expertAge === "number" && expertAge <= 8 && level > 1) {
    level = 1
  }
  return level
}

/**
 * Overall vigilance for a title = MAX across its (type-scoped) axes. A single
 * axis at 4 flips the badge to amber even if every other axis is 0 — the badge
 * answers "is there a point to watch?", not an average.
 */
export function vigilanceMax(
  m: TotemMetrics | null | undefined,
  type?: string | null,
  expertAge?: number | null,
): TotemLevel {
  if (!m) return 0
  let max: TotemLevel = 0
  for (const a of totemAxesFor(type)) {
    const lvl = vigilanceAxisLevel(m[a.key], expertAge)
    if (lvl > max) max = lvl
  }
  return max
}

// Genres that, on their own, signal intense content for families — used as a
// robust fallback so a horror/thriller reads RED even when its AI metric is
// under-scored (the "horror at Modéré" case). FR + EN spellings.
export const MATURE_GENRES = new Set([
  "Horreur", "Horror", "Thriller", "Crime", "Policier",
  "Guerre", "War", "Épouvante", "Epouvante",
])

export type VigilanceTone = "none" | "amber" | "red"

/**
 * Coarse severity for the card badge dot — a 2-color signal, NOT a precise
 * level claim:
 *   red   = strong → any axis "Important/Intense" (raw ≥4, age-anchored) OR a
 *           mature genre (horror/thriller/crime/war).
 *   amber = some points to note (a flagged axis, raw 3).
 *   none  = nothing to flag.
 * Genre is a deliberate floor so under-scored mature titles still read red.
 */
export function vigilanceTone(
  m: TotemMetrics | null | undefined,
  type?: string | null,
  expertAge?: number | null,
  genres?: string[] | null,
): VigilanceTone {
  const mature = (genres ?? []).some((g) => MATURE_GENRES.has(g))
  const max = vigilanceMax(m, type, expertAge)
  if (max >= 2 || mature) return "red"
  if (max >= 1) return "amber"
  return "none"
}
