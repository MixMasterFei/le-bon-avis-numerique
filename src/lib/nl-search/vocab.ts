/**
 * The closed vocabularies the interpretation step is allowed to emit.
 *
 * This file is the safety boundary of the whole feature: the model may propose
 * only values that appear here, and anything else is dropped in validate.ts.
 * That is what makes a free-text question incapable of reaching the catalogue
 * with an invented tag — the LLM picks FROM a list, it never writes filters.
 *
 * NL_THEMES intentionally duplicates the catalogue's `MOVIE_TV_TOPICS` rather
 * than importing it: that list lives in useCatalogueFilters.ts, which is a
 * "use client" module and must not be pulled into the server bundle. The
 * duplication is pinned by __tests__/vocab.test.ts, which fails if the two ever
 * diverge — drift-proof without a refactor.
 */
import { FILTERABLE_PLATFORMS } from "@/lib/streaming-providers"
import { GAME_GENRE_TOPICS } from "@/lib/igdb-genres"
import { QUIZ_INTEREST_CHIPS, QUIZ_HARD_AVOID_GENRES } from "@/lib/preference-quiz-config"
import { normalizeTag } from "@/lib/preference-vector/vocabulary"

/** Mirror of `topicsFor("MOVIE")` — pinned by vocab.test.ts. */
export const MOVIE_TV_THEMES = [
  "Animation", "Aventure", "Comédie", "Fantastique", "Science-Fiction", "Famille",
  "Éducatif", "Animaux", "Super-héros", "Espace", "Magie", "Nature", "Sport",
  "Musique", "Histoire", "Amitié",
] as const

/** Interests a parent describes but the catalogue rail list doesn't offer. */
const EXTRA_THEMES = QUIZ_INTEREST_CHIPS

/** Themes offered for films + séries. */
export const NL_THEMES: string[] = Array.from(
  new Set<string>([...MOVIE_TV_THEMES, ...EXTRA_THEMES]),
)

/** Themes offered for games (IGDB genre vocabulary, French). */
export const NL_GAME_THEMES: string[] = [...GAME_GENRE_TOPICS]

/** Streaming services, in the exact spelling stored on MediaItem.platforms[]. */
export const NL_PLATFORMS: string[] = [...FILTERABLE_PLATFORMS]

/** Consoles — mirror of `platformsFor("GAME")`, pinned by vocab.test.ts. */
export const NL_GAME_PLATFORMS: string[] = [
  "Switch", "PS5", "PS4", "Xbox Series", "Xbox One", "PC", "Mac",
]

export type NlMediaType = "MOVIE" | "TV" | "GAME"

export function themesFor(mediaType: NlMediaType): string[] {
  return mediaType === "GAME" ? NL_GAME_THEMES : NL_THEMES
}

export function platformsForType(mediaType: NlMediaType): string[] {
  return mediaType === "GAME" ? NL_GAME_PLATFORMS : NL_PLATFORMS
}

/**
 * Case- and accent-insensitive lookup back to the CANONICAL spelling.
 * "science fiction" → "Science-Fiction", "animaux" → "Animaux". Anything with
 * no canonical match returns null and is dropped by the validator.
 */
export function canonicalize(value: string, allowed: string[]): string | null {
  const target = normalizeTag(value)
  if (!target) return null
  for (const candidate of allowed) {
    if (normalizeTag(candidate) === target) return candidate
  }
  return null
}

/* ------------------------------------------------------------------ *
 * "Sans …" — the avoid axis
 * ------------------------------------------------------------------ */

export const NL_AVOID_KEYS = ["peur", "violence", "tristesse", "themes_durs"] as const
export type NlAvoid = (typeof NL_AVOID_KEYS)[number]

export interface AvoidRule {
  /** Human label for the interpretation chip ("sans grosses frayeurs"). */
  label: string
  /** Genres/topics SQL-excluded outright. */
  excludeTags: string[]
  /** Optional ceiling on ContentMetrics.violence (0-5). */
  maxViolence?: number
}

/**
 * The model chooses only an ENUM KEY; this table — not the model — decides what
 * that key actually filters. So « pas trop effrayant » can never be interpreted
 * into an arbitrary tag list, and the mapping stays reviewable in one place.
 *
 * Every rule TIGHTENS the query. There is deliberately no rule that loosens
 * one: a member's own profile sensitivities still apply on top for logged-in
 * families, and nothing here can relax them.
 */
export const AVOID_RULES: Record<NlAvoid, AvoidRule> = {
  // Mirrors the scary indicators in calculateMemberScore (scoring.ts).
  peur: {
    label: "sans grosses frayeurs",
    excludeTags: ["Horreur", "Thriller", "Épouvante", "Zombies", "Fantômes", "Halloween"],
  },
  violence: {
    label: "sans violence",
    excludeTags: ["Horreur", "Thriller", "Crime", "Guerre"],
    maxViolence: 2,
  },
  tristesse: {
    label: "sans passages tristes",
    excludeTags: ["Deuil", "Mort d'un parent", "Maladie grave"],
  },
  themes_durs: {
    label: "sans thèmes difficiles",
    excludeTags: [...QUIZ_HARD_AVOID_GENRES, "Drogue", "Suicide"],
  },
}

/** Union of the SQL exclusions implied by the selected avoid keys. */
export function resolveAvoidFilters(keys: NlAvoid[]): {
  excludeTags: string[]
  maxViolence?: number
} {
  const tags = new Set<string>()
  let maxViolence: number | undefined
  for (const key of keys) {
    const rule = AVOID_RULES[key]
    if (!rule) continue
    for (const tag of rule.excludeTags) tags.add(tag)
    if (typeof rule.maxViolence === "number") {
      maxViolence = Math.min(maxViolence ?? rule.maxViolence, rule.maxViolence)
    }
  }
  return { excludeTags: Array.from(tags), ...(maxViolence !== undefined ? { maxViolence } : {}) }
}
