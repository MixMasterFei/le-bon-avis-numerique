/**
 * Single source of truth for "should this poster be blurred?".
 *
 * Two independent triggers:
 *
 *  1. METRICS — `expertAgeRec >= 15` AND any one of the four content metrics
 *     exceeds threshold 3. So a tame 15+ film (slow drama, biopic) stays
 *     crisp; only mature 15+/16+/18+ content gets the blur treatment.
 *
 *  2. GENRE — an explicitly frightening genre (horreur / épouvante) at 12+.
 *     The metrics trigger alone cannot protect against a horror poster,
 *     because the titles that need it most are exactly the ones that have NO
 *     ContentMetrics yet: a horror film currently in theatres is imported with
 *     a provisional age and stays `isEnriched: false` until the nightly AI
 *     pass reaches it, so every metric reads 0. That is how "Insidious :
 *     L'Invasion du Lointain" shipped an unblurred jump-scare poster on the
 *     family homepage. Fright intensity also has no axis in ContentMetrics
 *     (violence/sexNudity/language/substanceUse all miss it), so genre is the
 *     only honest signal here — same reasoning as the horror floor in
 *     `age-floor.ts`.
 *
 * Games are exempt — their covers are illustrated, not photographic.
 *
 * Used by:
 *   - src/components/media/MediaCard.tsx (listing pages)
 *   - src/components/media/BlurredPoster.tsx (media detail hero)
 *   - src/components/home-redesign/RedesignCard.tsx (V2 rails)
 *   - src/components/home-v2/ApercuMediaCard.tsx (homepage/catalogue cards)
 * Every call site MUST pass `genres` — the horror trigger is the only
 * protection for titles whose ContentMetrics don't exist yet.
 *
 * The user-facing toggle that disables this entirely lives in
 * SettingsContext (`blur18Plus`) and is configurable from
 * /profil → Account settings.
 */

export interface BlurMediaInput {
  type: string
  expertAgeRec: number | null | undefined
  violence?: number | null
  sexNudity?: number | null
  language?: number | null
  substanceUse?: number | null
  /** Media genres — drives the horror trigger. Optional: callers that don't
   *  have them keep the previous metrics-only behaviour. */
  genres?: string[] | null
}

const AGE_TRIGGER = 15
const METRIC_TRIGGER = 3

// Deliberately narrower than family-fit's MATURE_GENRES (which also covers
// Thriller / Crime / Guerre): a thriller poster is tense, not disturbing, and
// blurring every polar would train parents to click through the blur. Kept in
// accent-folded form so "Épouvante" matches.
const FRIGHT_GENRES = new Set(["horreur", "horror", "epouvante"])
const FRIGHT_AGE_TRIGGER = 12

function foldGenre(g: string): string {
  return g
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
}

export function hasFrightGenre(genres: string[] | null | undefined): boolean {
  return (genres ?? []).some((g) => FRIGHT_GENRES.has(foldGenre(g)))
}

export function shouldBlurMedia(
  input: BlurMediaInput,
  blurEnabled: boolean,
): boolean {
  if (!blurEnabled) return false
  if (input.type === "GAME") return false

  const age = input.expertAgeRec
  if (age === null || age === undefined) return false

  // Genre trigger — works with or without ContentMetrics.
  if (age >= FRIGHT_AGE_TRIGGER && hasFrightGenre(input.genres)) return true

  if (age < AGE_TRIGGER) return false

  const violence = input.violence ?? 0
  const sexNudity = input.sexNudity ?? 0
  const language = input.language ?? 0
  const substance = input.substanceUse ?? 0

  return (
    violence >= METRIC_TRIGGER ||
    sexNudity >= METRIC_TRIGGER ||
    language >= METRIC_TRIGGER ||
    substance >= METRIC_TRIGGER
  )
}

/**
 * Tooltip text shown on the eye-reveal button so users know the
 * blur is configurable. Same string everywhere for consistency.
 */
export const BLUR_TOOLTIP =
  "Affichage flouté pour les contenus sensibles (horreur, 15+). Modifiez ce comportement dans Paramètres famille."
