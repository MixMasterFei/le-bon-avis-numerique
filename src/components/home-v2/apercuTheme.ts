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

/** The age-band key whose range contains `age` (smallest bucket where age ≤ maxAge). */
export function ageBucketKeyForAge(age: number): string {
  for (const b of APERCU_AGE_BUCKETS) {
    if (age <= b.maxAge) return b.key
  }
  return APERCU_AGE_BUCKETS[APERCU_AGE_BUCKETS.length - 1].key
}

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
  // Jeux vidéo (genres IGDB traduits) — chacun a sa couleur pour qu'aucune
  // pastille ne reste « grise » sur les cartes du catalogue.
  Course: { bg: "#8DBDC9", text: "#1E3E47" },
  Arcade: { bg: "#F8D775", text: "#5C4500" },
  Réflexion: { bg: "#C9B7D9", text: "#3E2D5C" },
  Simulation: { bg: "#B8D89A", text: "#2D3E1E" },
  Stratégie: { bg: "#8DBDC9", text: "#1E3E47" },
  Sport: { bg: "#B8D89A", text: "#2D3E1E" },
  Tir: { bg: "#E8A87C", text: "#5C2E1E" },
  Combat: { bg: "#E8A87C", text: "#5C2E1E" },
  Plateforme: { bg: "#F4C7A6", text: "#5C3D1E" },
  RPG: { bg: "#C9B7D9", text: "#3E2D5C" },
  Indé: { bg: "#E9C7A1", text: "#5C3F1E" },
  Tactique: { bg: "#8DBDC9", text: "#1E3E47" },
  MOBA: { bg: "#A79BC7", text: "#3E2D5C" },
  "Jeu de société": { bg: "#E9C7A1", text: "#5C3F1E" },
  Quiz: { bg: "#F8D775", text: "#5C4500" },
  Flipper: { bg: "#F4C7A6", text: "#5C3D1E" },
  "Roman visuel": { bg: "#D89AB0", text: "#5C2D40" },
}

// Soft but still-visible neutral for the rare genre we have no dedicated
// color for — warm sand, never the page background (which read as
// "uncolored / grey" to users).
const GENRE_NEUTRAL: BadgeColor = { bg: "#E3DAC9", text: "#5A4F3C" }

const WARNING_BADGE: BadgeColor = {
  bg: APERCU_PALETTE.accent,
  text: "#FFFFFF",
}

// Canonical French label for a raw genre string. TMDB returns French for
// films/séries, but IGDB game genres arrive in English ("Racing",
// "Indie", "Puzzle"…) and a few TMDB labels vary ("Familial" vs
// "Famille"). Normalize everything to one French set so the UI never
// shows English and always matches a color above.
const GENRE_FR: Record<string, string> = {
  // Jeux (IGDB, anglais)
  adventure: "Aventure",
  indie: "Indé",
  racing: "Course",
  arcade: "Arcade",
  puzzle: "Réflexion",
  simulator: "Simulation",
  simulation: "Simulation",
  strategy: "Stratégie",
  sport: "Sport",
  shooter: "Tir",
  fighting: "Combat",
  platform: "Plateforme",
  "role-playing (rpg)": "RPG",
  rpg: "RPG",
  "turn-based strategy (tbs)": "Stratégie",
  "real time strategy (rts)": "Stratégie",
  "hack and slash/beat 'em up": "Action",
  "point-and-click": "Aventure",
  "card & board game": "Jeu de société",
  "quiz/trivia": "Quiz",
  tactical: "Tactique",
  pinball: "Flipper",
  "visual novel": "Roman visuel",
  moba: "MOBA",
  // Films / séries (anglais résiduels)
  comedy: "Comédie",
  drama: "Drame",
  family: "Famille",
  fantasy: "Fantastique",
  "science fiction": "Science-Fiction",
  "sci-fi & fantasy": "Science-Fiction",
  "action & adventure": "Action",
  animation: "Animation",
  documentary: "Documentaire",
  history: "Histoire",
  music: "Musique",
  mystery: "Mystère",
  romance: "Romance",
  thriller: "Thriller",
  war: "Guerre",
  "war & politics": "Guerre",
  western: "Western",
  crime: "Crime",
  horror: "Horreur",
  // Variantes françaises à normaliser
  familial: "Famille",
}

export function genreLabelFr(genre: string): string {
  return GENRE_FR[genre.trim().toLowerCase()] ?? genre
}

export function genreBadgeColor(genre: string): BadgeColor {
  const label = genreLabelFr(genre)
  if (WARNING_GENRES.has(label)) return WARNING_BADGE
  return GENRE_COLORS[label] ?? GENRE_NEUTRAL
}
