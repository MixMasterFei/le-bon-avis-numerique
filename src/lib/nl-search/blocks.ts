/**
 * The block registry and the page-plan director.
 *
 * This is the "agentic" half of Recherche magique: the interpretation step may
 * propose WHICH sections a board is built from and in WHAT ORDER, with a French
 * title for each. It may not propose anything else. Every block key here maps to
 * a fixed React section fed by a deterministic resolver, so a composed page is
 * a rearrangement of the catalogue — never a generated one.
 *
 * The director below is deliberately paranoid. A proposal is not a plan: it is
 * whitelisted, de-duplicated, re-ordered, capped, and repaired into something
 * renderable, and if nothing survives we fall back to a static plan. The page
 * always composes.
 */
import { sanitizePlainText } from "@/lib/security"
import { canonicalize, themesFor, type NlMediaType } from "./vocab"
import type { NlIntent } from "./types"

/* ------------------------------------------------------------------ *
 * The registry
 * ------------------------------------------------------------------ */

/** Sections backed by a catalogue query. Each one self-hides when empty. */
export const NL_CONTENT_BLOCKS = [
  /** One standout match, given the full-width treatment. */
  "heroMatch",
  /** The answer to the question: the main results grid. */
  "mediaGrid",
  /** A narrower slice of the same search (a type, a theme). */
  "mediaRail",
  /** The pivot: "et si on jouait ?" — same request, another medium. */
  "crossType",
  /** In French cinemas right now (TMDB now_playing, live). */
  "cinemaNow",
  /** Released soon, with the "prévenez-moi" toggle. */
  "upcoming",
  /** Related news briefs. */
  "newsPicks",
  /** Related blog reading. */
  "blogPicks",
  /** The same request, for a younger sibling. */
  "youngerSiblings",
] as const

/** Typographic blocks. These carry no data — they give the board its rhythm. */
export const NL_EDITORIAL_BLOCKS = [
  /** A large statement title, anywhere down the page. */
  "displayTitle",
  /** A one-line editorial band between two sections. */
  "interstitial",
  /** The closing invitation. */
  "closingCta",
] as const

export const NL_BLOCK_KEYS = [...NL_CONTENT_BLOCKS, ...NL_EDITORIAL_BLOCKS] as const

export type NlContentBlock = (typeof NL_CONTENT_BLOCKS)[number]
export type NlEditorialBlock = (typeof NL_EDITORIAL_BLOCKS)[number]
export type NlBlockKey = (typeof NL_BLOCK_KEYS)[number]

export function isEditorialBlock(key: NlBlockKey): key is NlEditorialBlock {
  return (NL_EDITORIAL_BLOCKS as readonly string[]).includes(key)
}

/* ------------------------------------------------------------------ *
 * Shapes
 * ------------------------------------------------------------------ */

/** Untrusted: one entry as proposed by the interpretation step. */
export interface NlPlanBlockRaw {
  block?: string
  eyebrow?: string
  title?: string
  /** Word(s) inside `title` to set in the italic accent face. */
  em?: string
  lead?: string
  /** `mediaRail` / `crossType` only. */
  mediaType?: string
  /** `mediaRail` only — narrows the slice. */
  themes?: string[]
}

/** Validated: what the renderer actually receives. */
export interface NlPlanBlock {
  block: NlBlockKey
  eyebrow: string | null
  title: string | null
  em: string | null
  lead: string | null
  mediaType: NlMediaType | null
  themes: string[]
}

export type NlPlan = NlPlanBlock[]

/* ------------------------------------------------------------------ *
 * Limits
 * ------------------------------------------------------------------ */

/** Past this the board stops reading as composed and starts reading as a dump. */
const MAX_BLOCKS = 7
/** A hero further down the page is no longer a hero. */
const MAX_HERO_INDEX = 1
/** The only content block allowed to repeat, with different params. */
const MAX_MEDIA_RAILS = 2

const EYEBROW_MAX_LEN = 28
const TITLE_MAX_LEN = 70
const EM_MAX_LEN = 30
const LEAD_MAX_LEN = 150
const MAX_RAIL_THEMES = 2

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

function toBlockKey(value: unknown): NlBlockKey | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return (NL_BLOCK_KEYS as readonly string[]).includes(trimmed) ? (trimmed as NlBlockKey) : null
}

function toMediaTypeOrNull(value: unknown): NlMediaType | null {
  if (typeof value !== "string") return null
  const upper = value.toUpperCase()
  return upper === "MOVIE" || upper === "TV" || upper === "GAME" ? (upper as NlMediaType) : null
}

function toText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null
  const clean = sanitizePlainText(value, maxLen).trim()
  return clean.length > 0 ? clean : null
}

/**
 * Locates the accent word inside a title so the renderer can wrap it in <Em>.
 * Returns null when `em` isn't a substring — we never re-write the title to make
 * the italics fit, we just drop them.
 */
export function splitTitleForEm(
  title: string,
  em: string | null,
): { before: string; accent: string; after: string } | null {
  if (!em) return null
  const index = title.toLowerCase().indexOf(em.toLowerCase())
  if (index < 0) return null
  return {
    before: title.slice(0, index),
    accent: title.slice(index, index + em.length),
    after: title.slice(index + em.length),
  }
}

function validateBlock(raw: unknown, intent: NlIntent): NlPlanBlock | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const input = raw as NlPlanBlockRaw

  const block = toBlockKey(input.block)
  if (!block) return null

  const mediaType = toMediaTypeOrNull(input.mediaType)

  // Rail themes are canonicalized against the vocabulary of the rail's OWN type,
  // so a games rail can't inherit a films-only theme.
  const themeVocab = themesFor(mediaType ?? intent.mediaType)
  const themes: string[] = []
  if (Array.isArray(input.themes)) {
    for (const candidate of input.themes) {
      if (typeof candidate !== "string") continue
      const canonical = canonicalize(candidate, themeVocab)
      if (canonical && !themes.includes(canonical)) themes.push(canonical)
      if (themes.length >= MAX_RAIL_THEMES) break
    }
  }

  return {
    block,
    eyebrow: toText(input.eyebrow, EYEBROW_MAX_LEN),
    title: toText(input.title, TITLE_MAX_LEN),
    em: toText(input.em, EM_MAX_LEN),
    lead: toText(input.lead, LEAD_MAX_LEN),
    mediaType,
    themes,
  }
}

/* ------------------------------------------------------------------ *
 * The director
 * ------------------------------------------------------------------ */

/** The medium to pivot TO, which must differ from what was asked for. */
function pivotType(from: NlMediaType): NlMediaType {
  return from === "GAME" ? "MOVIE" : "GAME"
}

/**
 * The plan used whenever the model proposes nothing usable — and the floor the
 * director repairs towards. Deliberately plain: one hero, the results, and the
 * complement the interpretation already asked for.
 */
export function fallbackPlan(intent: NlIntent): NlPlan {
  if (intent.mode === "hors_sujet") return []

  const plan: NlPlan = [
    { block: "heroMatch", eyebrow: null, title: null, em: null, lead: null, mediaType: null, themes: [] },
    { block: "mediaGrid", eyebrow: null, title: null, em: null, lead: null, mediaType: null, themes: [] },
  ]

  if (intent.railSecondaire === "plus_jeunes") {
    plan.push({
      block: "youngerSiblings",
      eyebrow: null, title: null, em: null, lead: null, mediaType: null, themes: [],
    })
  } else if (intent.railSecondaire === "en_serie") {
    plan.push({
      block: "mediaRail",
      eyebrow: null, title: null, em: null, lead: null, mediaType: "TV", themes: [],
    })
  }

  return plan
}

/**
 * Turns a proposal into a renderable plan.
 *
 * Order of operations matters: we validate, then enforce structural rules, then
 * guarantee the results block exists, then cap. Every rule either repairs or
 * drops — none of them can throw, because a malformed plan must degrade to a
 * plain board rather than an error page.
 */
export function buildPlan(raw: unknown, intent: NlIntent): NlPlan {
  if (intent.mode === "hors_sujet") return []
  if (!Array.isArray(raw)) return fallbackPlan(intent)

  try {
    const validated = raw
      .map((entry) => validateBlock(entry, intent))
      .filter((entry): entry is NlPlanBlock => entry !== null)

    const out: NlPlan = []
    const used = new Map<NlBlockKey, number>()

    for (const candidate of validated) {
      const seen = used.get(candidate.block) ?? 0
      const limit = candidate.block === "mediaRail" ? MAX_MEDIA_RAILS : 1
      if (seen >= limit) continue

      // A hero has to lead. Below the fold it is just a large card.
      if (candidate.block === "heroMatch" && out.length > MAX_HERO_INDEX) continue

      const editorial = isEditorialBlock(candidate.block)

      // Nothing typographic opens the board: the h1 already sits above it.
      if (editorial && out.length === 0) continue

      // Two editorial blocks in a row is a layout hole, not a rhythm.
      const previous = out[out.length - 1]
      if (editorial && previous && isEditorialBlock(previous.block)) continue

      // An editorial block with no words renders as blank space.
      if (editorial && !candidate.title && !candidate.lead) continue

      // The pivot must actually pivot.
      if (candidate.block === "crossType") {
        const target = candidate.mediaType && candidate.mediaType !== intent.mediaType
          ? candidate.mediaType
          : pivotType(intent.mediaType)
        out.push({ ...candidate, mediaType: target })
        used.set(candidate.block, seen + 1)
        continue
      }

      // Games have no series counterpart, so a TV rail off a games search is a
      // guaranteed-empty section.
      if (candidate.block === "mediaRail" && candidate.mediaType === "TV" && intent.mediaType === "GAME") {
        continue
      }

      // A younger-siblings rail needs an age to step down from.
      if (candidate.block === "youngerSiblings" && intent.maxAge === null) continue

      out.push(candidate)
      used.set(candidate.block, seen + 1)
    }

    // The board must answer the question somewhere. If the proposal forgot the
    // results, put them back directly under the hero.
    if (!out.some((b) => b.block === "mediaGrid")) {
      const insertAt = out[0]?.block === "heroMatch" ? 1 : 0
      out.splice(insertAt, 0, {
        block: "mediaGrid",
        eyebrow: null, title: null, em: null, lead: null, mediaType: null, themes: [],
      })
    }

    const capped = out.slice(0, MAX_BLOCKS)

    // A trailing editorial block dangles once the cap has cut what followed it.
    while (capped.length > 0 && isEditorialBlock(capped[capped.length - 1].block)
      && capped[capped.length - 1].block !== "closingCta") {
      capped.pop()
    }

    return capped.length > 0 ? capped : fallbackPlan(intent)
  } catch {
    return fallbackPlan(intent)
  }
}
