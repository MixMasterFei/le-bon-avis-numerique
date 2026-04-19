/**
 * Single source of truth for "should this poster be blurred?".
 *
 * Trigger: `expertAgeRec >= 15` AND any one of the four content metrics
 * exceeds threshold 3. So a tame 15+ film (slow drama, biopic) stays
 * crisp; only mature 15+/16+/18+ content gets the blur treatment.
 *
 * Games are exempt — their covers are illustrated, not photographic.
 *
 * Used by:
 *   - src/components/media/MediaCard.tsx (listing pages)
 *   - src/components/media/BlurredPoster.tsx (media detail hero)
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
}

const AGE_TRIGGER = 15
const METRIC_TRIGGER = 3

export function shouldBlurMedia(
  input: BlurMediaInput,
  blurEnabled: boolean,
): boolean {
  if (!blurEnabled) return false
  if (input.type === "GAME") return false

  const age = input.expertAgeRec
  if (age === null || age === undefined || age < AGE_TRIGGER) return false

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
  "Affichage flouté pour les contenus 15+ sensibles. Modifiez ce comportement dans Paramètres famille."
