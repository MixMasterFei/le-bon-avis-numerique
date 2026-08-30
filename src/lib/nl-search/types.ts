import type { NlAvoid, NlMediaType } from "./vocab"

export type { NlAvoid, NlMediaType }

/**
 * What the interpretation step is allowed to propose. EVERY field is optional
 * and untrusted — this is the raw shape coming back from the model, before
 * validate.ts clamps it. Nothing in the app should ever consume this type
 * directly; use `NlIntent`.
 */
export interface NlIntentRaw {
  /** Not a family-media question (off-topic, abuse, gibberish). */
  horsSujet?: boolean
  mediaType?: string
  /** The child's age, as stated by the parent. */
  maxAge?: number
  minAge?: number
  themes?: string[]
  platforms?: string[]
  eviter?: string[]
  /** Set when the parent named a specific work rather than described one. */
  titre?: string
  railSecondaire?: string | null
  /** Short French labels restating the interpretation, for the chips. */
  libelles?: string[]
}

export type NlSearchMode =
  /** Structured filters → smart filter / catalogue query. */
  | "filtre"
  /** A specific work was named → title lookup. */
  | "titre"
  /** No usable interpretation → keyword search over themes + titles. */
  | "texte"
  /** Not a media question → empty state, no catalogue query. */
  | "hors_sujet"

export type NlSecondaryRail = "plus_jeunes" | "en_serie"

/**
 * The clamped, whitelisted interpretation — the only form the rest of the app
 * sees. Every value here has been checked against a closed vocabulary or a
 * numeric range, so it is safe to hand straight to the query builders.
 */
export interface NlIntent {
  mode: NlSearchMode
  mediaType: NlMediaType
  maxAge: number | null
  minAge: number | null
  themes: string[]
  platforms: string[]
  eviter: NlAvoid[]
  titre: string | null
  railSecondaire: NlSecondaryRail | null
  libelles: string[]
}

/** How the page resolved its interpretation — mirrors nl_search_queries.status. */
export type NlResolutionStatus =
  | "llm"
  | "cache"
  | "params"
  | "fallback"
  | "hors_sujet"
  | "blocked"
