/**
 * Palette values reference CSS custom properties declared in
 * `src/app/globals.css`. That lets a single [data-theme="dark"]
 * swap the whole palette for Soirée mode without touching any
 * component — the browser resolves the `var(--color-*)` at paint
 * time, and server components emit these strings directly into
 * `style={{ background: p.bg }}` which HTML accepts verbatim.
 */
export const APERCU_PALETTE = {
  bg: "var(--color-bg)",
  bg2: "var(--color-bg2)",
  card: "var(--color-card)",
  ink: "var(--color-ink)",
  ink2: "var(--color-ink2)",
  accent: "var(--color-accent)",
  accent2: "var(--color-accent2)",
  line: "var(--color-line)",
  line2: "var(--color-line2)",
  placeholder: "var(--color-placeholder)",
} as const

// Each bucket carries the content-metric caps appropriate to the age.
// 0-5 scale per ContentMetrics table. The 16+ bucket has no caps since
// adult viewers can handle anything.
export interface ApercuAgeBucket {
  key: string
  maxAge: number
  label: string
  name: string
  color: string
  caps: {
    maxViolence?: number
    maxSexual?: number
    maxLanguage?: number
    maxSubstance?: number
  }
}

export const APERCU_AGE_BUCKETS: ApercuAgeBucket[] = [
  { key: "2-4", maxAge: 4, label: "2–4", name: "Tout-petits", color: "#F4C7A6", caps: { maxViolence: 0, maxSexual: 0, maxLanguage: 0, maxSubstance: 0 } },
  { key: "5-7", maxAge: 7, label: "5–7", name: "Enfants", color: "#F8D775", caps: { maxViolence: 1, maxSexual: 0, maxLanguage: 1, maxSubstance: 0 } },
  { key: "8-10", maxAge: 10, label: "8–10", name: "Grands enfants", color: "#B8D89A", caps: { maxViolence: 2, maxSexual: 1, maxLanguage: 1, maxSubstance: 1 } },
  { key: "11-12", maxAge: 12, label: "11–12", name: "Pré-ados", color: "#8DBDC9", caps: { maxViolence: 2, maxSexual: 1, maxLanguage: 2, maxSubstance: 1 } },
  { key: "13-15", maxAge: 15, label: "13–15", name: "Ados", color: "#A79BC7", caps: { maxViolence: 3, maxSexual: 2, maxLanguage: 3, maxSubstance: 2 } },
  // maxAge: 18 (not 99) so the films page actually applies the filter
  // — its DEFAULT_MAX_AGE is 18 and any maxAge >= that is silently
  // dropped, which made "16+" route to the same page as the default
  // browse (no active filter, misleading URL).
  { key: "16+", maxAge: 18, label: "16+", name: "Jeunes adultes", color: "#D89AB0", caps: {} },
]

export function buildAgeBucketHref(bucket: ApercuAgeBucket): string {
  const params = new URLSearchParams({ maxAge: String(bucket.maxAge) })
  for (const [k, v] of Object.entries(bucket.caps)) {
    if (typeof v === "number") params.set(k, String(v))
  }
  return `/films?${params}`
}

export function isFraunces(fontFlag: string | undefined): boolean {
  return fontFlag !== "poppins"
}

// ── Color helpers for cards/badges ───────────────────────────────────
// Pulls hexes from the same age + theme palettes documented in
// docs/ART_DIRECTION.md so every label on the page belongs to one
// chromatic universe.

export interface BadgeColor {
  bg: string
  text: string
}

const NEUTRAL_BADGE: BadgeColor = {
  bg: APERCU_PALETTE.bg2,
  text: "#3a342c",
}

/**
 * Map an age recommendation to its identity bucket color.
 * Returns the cream `bg2` for unknown ages so empty/null doesn't
 * silently inherit one bucket's color.
 */
export function ageBadgeColor(age: number | null | undefined): BadgeColor {
  if (age === null || age === undefined) return NEUTRAL_BADGE
  for (const b of APERCU_AGE_BUCKETS) {
    if (age <= b.maxAge) {
      return { bg: b.color, text: "#1E1A15" }
    }
  }
  return NEUTRAL_BADGE
}

/**
 * Genres that should look immediately worrying on a family-facing
 * card. They get the brand's terracotta accent so a parent spots
 * them at a glance without reading.
 */
const WARNING_GENRES = new Set([
  "Horreur",
  "Horror",
  "Thriller",
  "Guerre",
  "War",
])

const GENRE_COLORS: Record<string, BadgeColor> = {
  Animation: { bg: "#F4C7A6", text: "#5C3D1E" },
  Aventure: { bg: "#E8A87C", text: "#5C2E1E" },
  Comédie: { bg: "#F8D775", text: "#5C4500" },
  Comedie: { bg: "#F8D775", text: "#5C4500" },
  Fantastique: { bg: "#C9B7D9", text: "#3E2D5C" },
  Famille: { bg: "#B8D89A", text: "#2D3E1E" },
  "Science-Fiction": { bg: "#8DBDC9", text: "#1E3E47" },
  "Sci-Fi": { bg: "#8DBDC9", text: "#1E3E47" },
  Drame: { bg: "#D89AB0", text: "#5C2D40" },
  Romance: { bg: "#D89AB0", text: "#5C2D40" },
  Musique: { bg: "#E9C7A1", text: "#5C3F1E" },
  Documentaire: { bg: "#B8D89A", text: "#2D3E1E" },
  Action: { bg: "#E8A87C", text: "#5C2E1E" },
  Crime: { bg: "#A79BC7", text: "#3E2D5C" },
  Mystère: { bg: "#A79BC7", text: "#3E2D5C" },
  Mystere: { bg: "#A79BC7", text: "#3E2D5C" },
  Histoire: { bg: "#E9C7A1", text: "#5C3F1E" },
  Western: { bg: "#E8A87C", text: "#5C2E1E" },
}

const WARNING_BADGE: BadgeColor = {
  bg: APERCU_PALETTE.accent,
  text: "#FFFFFF",
}

export function genreBadgeColor(genre: string): BadgeColor {
  if (WARNING_GENRES.has(genre)) return WARNING_BADGE
  return GENRE_COLORS[genre] ?? NEUTRAL_BADGE
}
