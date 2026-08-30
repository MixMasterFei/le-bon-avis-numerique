/**
 * Clamping layer between the interpretation step and the catalogue.
 *
 * Nothing the model returns is trusted: ages go through sanitizeNumber, themes
 * and platforms must canonicalize against a closed vocabulary, avoid-keys must
 * be known enum members, and the display labels are sanitized plain text. A
 * malformed or hostile payload degrades to a keyword search — it never throws
 * and never reaches the query builders unchecked.
 *
 * The same clamps run on URL parameters (`intentFromSearchParams`), so a
 * hand-edited or shared /decouverte link is exactly as constrained as a fresh
 * interpretation.
 */
import { sanitizeNumber, sanitizePlainText } from "@/lib/security"
import {
  NL_AVOID_KEYS,
  canonicalize,
  platformsForType,
  themesFor,
  type NlAvoid,
  type NlMediaType,
} from "./vocab"
import type { NlIntent, NlIntentRaw, NlSecondaryRail } from "./types"

const MAX_THEMES = 3
const MAX_PLATFORMS = 2
const MAX_LABELS = 4
const LABEL_MAX_LEN = 40
const TITLE_MAX_LEN = 80

/** Youngest/oldest age we accept on a family-media query. */
const AGE_MIN = 0
const AGE_MAX = 18

const MEDIA_TYPES: NlMediaType[] = ["MOVIE", "TV", "GAME"]
const SECONDARY_RAILS: NlSecondaryRail[] = ["plus_jeunes", "en_serie"]

function emptyIntent(mode: NlIntent["mode"], mediaType: NlMediaType = "MOVIE"): NlIntent {
  return {
    mode,
    mediaType,
    maxAge: null,
    minAge: null,
    themes: [],
    platforms: [],
    eviter: [],
    titre: null,
    railSecondaire: null,
    libelles: [],
  }
}

function toMediaType(value: unknown): NlMediaType {
  if (typeof value !== "string") return "MOVIE"
  const upper = value.toUpperCase()
  return (MEDIA_TYPES as string[]).includes(upper) ? (upper as NlMediaType) : "MOVIE"
}

/** Age in [0,18], or null. sanitizeNumber clamps rather than rejects, so a
 *  bare-faced "for my 40 year old" lands at 18 instead of poisoning the query. */
function toAge(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return sanitizeNumber(value, AGE_MIN, AGE_MAX)
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === "string")
}

function canonicalList(values: unknown, allowed: string[], cap: number): string[] {
  const out: string[] = []
  for (const raw of toStringArray(values)) {
    const canonical = canonicalize(raw, allowed)
    if (canonical && !out.includes(canonical)) out.push(canonical)
    if (out.length >= cap) break
  }
  return out
}

function toAvoidKeys(value: unknown): NlAvoid[] {
  const out: NlAvoid[] = []
  for (const raw of toStringArray(value)) {
    const key = raw.toLowerCase().trim() as NlAvoid
    if ((NL_AVOID_KEYS as readonly string[]).includes(key) && !out.includes(key)) {
      out.push(key)
    }
  }
  return out
}

function toLabels(value: unknown): string[] {
  const out: string[] = []
  for (const raw of toStringArray(value)) {
    const clean = sanitizePlainText(raw, LABEL_MAX_LEN).trim()
    if (clean && !out.includes(clean)) out.push(clean)
    if (out.length >= MAX_LABELS) break
  }
  return out
}

/**
 * Validates + clamps a raw interpretation. Never throws: any structural problem
 * degrades to `mode: "texte"`, which the page renders as a keyword search.
 */
export function validateNlIntent(raw: unknown): NlIntent {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyIntent("texte")

  try {
    const input = raw as NlIntentRaw
    const mediaType = toMediaType(input.mediaType)

    // Off-topic wins over everything else: if the question isn't about family
    // media we run no catalogue query at all, whatever else was extracted.
    if (input.horsSujet === true) return emptyIntent("hors_sujet", mediaType)

    const maxAge = toAge(input.maxAge)
    let minAge = toAge(input.minAge)
    // An inverted range is a misread, not a filter — drop the floor rather than
    // returning a window that matches nothing.
    if (maxAge !== null && minAge !== null && minAge > maxAge) minAge = null

    const themes = canonicalList(input.themes, themesFor(mediaType), MAX_THEMES)
    const platforms = canonicalList(input.platforms, platformsForType(mediaType), MAX_PLATFORMS)
    const eviter = toAvoidKeys(input.eviter)
    const libelles = toLabels(input.libelles)

    const titreRaw = typeof input.titre === "string" ? sanitizePlainText(input.titre, TITLE_MAX_LEN).trim() : ""
    const titre = titreRaw.length >= 2 ? titreRaw : null

    const railSecondaire =
      typeof input.railSecondaire === "string" &&
      (SECONDARY_RAILS as string[]).includes(input.railSecondaire)
        ? (input.railSecondaire as NlSecondaryRail)
        : null

    // A named title takes the lookup path; otherwise we need at least one real
    // filter for "filtre" to mean anything — with nothing usable, keyword
    // search over the original question beats an unfiltered catalogue dump.
    const hasFilters =
      maxAge !== null || minAge !== null || themes.length > 0 || platforms.length > 0 || eviter.length > 0

    if (titre) {
      return { mode: "titre", mediaType, maxAge, minAge, themes, platforms, eviter, titre, railSecondaire, libelles }
    }
    if (!hasFilters) return emptyIntent("texte", mediaType)

    // A secondary "younger siblings" rail only makes sense below a known age.
    const rail = railSecondaire === "plus_jeunes" && maxAge === null ? null : railSecondaire
    // Games have no series counterpart.
    const finalRail = rail === "en_serie" && mediaType === "GAME" ? null : rail

    return {
      mode: "filtre",
      mediaType,
      maxAge,
      minAge,
      themes,
      platforms,
      eviter,
      titre: null,
      railSecondaire: finalRail,
      libelles,
    }
  } catch {
    return emptyIntent("texte")
  }
}

/* ------------------------------------------------------------------ *
 * URL encoding — the "page that upgrades itself" half
 * ------------------------------------------------------------------ */

export interface NlSearchParams {
  q?: string
  type?: string
  age?: string
  ageMin?: string
  themes?: string
  plateformes?: string
  sans?: string
  titre?: string
  rail?: string
  hs?: string
}

/** True when the URL already carries a structured interpretation — the signal
 *  that this render must NOT call the interpretation step again. */
export function hasStructuredParams(params: NlSearchParams): boolean {
  return Boolean(
    params.type || params.age || params.ageMin || params.themes ||
    params.plateformes || params.sans || params.titre || params.hs,
  )
}

/** Rebuilds an intent from URL params, through the same clamps as a fresh parse. */
export function intentFromSearchParams(params: NlSearchParams): NlIntent {
  if (params.hs === "1") return validateNlIntent({ horsSujet: true, mediaType: params.type })

  const split = (value: string | undefined): string[] =>
    typeof value === "string" && value.length > 0 ? value.split(",").map((s) => s.trim()).filter(Boolean) : []

  const asNumber = (value: string | undefined): number | undefined => {
    if (typeof value !== "string" || value.trim() === "") return undefined
    const n = Number(value)
    return Number.isFinite(n) ? n : undefined
  }

  return validateNlIntent({
    mediaType: params.type,
    maxAge: asNumber(params.age),
    minAge: asNumber(params.ageMin),
    themes: split(params.themes),
    platforms: split(params.plateformes),
    eviter: split(params.sans),
    titre: params.titre,
    railSecondaire: params.rail,
    // Labels are display-only and are re-derived from the filters on a param
    // render, so they never need to survive in the URL.
    libelles: [],
  })
}

/** Canonical URL params for an intent — what the chips link to. */
export function intentToSearchParams(intent: NlIntent, query: string): URLSearchParams {
  const sp = new URLSearchParams()
  if (query) sp.set("q", query)
  if (intent.mode === "hors_sujet") {
    sp.set("hs", "1")
    return sp
  }
  if (intent.mediaType !== "MOVIE") sp.set("type", intent.mediaType)
  if (intent.maxAge !== null) sp.set("age", String(intent.maxAge))
  if (intent.minAge !== null) sp.set("ageMin", String(intent.minAge))
  if (intent.themes.length > 0) sp.set("themes", intent.themes.join(","))
  if (intent.platforms.length > 0) sp.set("plateformes", intent.platforms.join(","))
  if (intent.eviter.length > 0) sp.set("sans", intent.eviter.join(","))
  if (intent.titre) sp.set("titre", intent.titre)
  if (intent.railSecondaire) sp.set("rail", intent.railSecondaire)
  return sp
}
