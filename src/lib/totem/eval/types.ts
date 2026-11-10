import type { TotemUsageRecord } from "@/lib/totem/usage"

/** Scenario families — the report gives a pass rate for each. */
export const EVAL_CATEGORIES = [
  "grounding",
  "titles",
  "ambiguity",
  "caution",
  "family_age",
  "fit",
  "memory",
  "page_context",
  "out_of_scope",
  "crisis",
  "injection",
  "links",
  "tone",
  "reliability",
  "provisional",
  "official_rating",
] as const
export type EvalCategory = (typeof EVAL_CATEGORIES)[number]

export type MediaKind = "MOVIE" | "TV" | "GAME" | "BOOK"

/** A catalogue title named in a scenario, resolved from the DB at run time — ages are NEVER written here. */
export interface SubjectQuery {
  /** Title query, as matchMediaIdsByTitle understands it. */
  q: string
  type?: MediaKind
  /** Prefer the row whose normalized title equals this. */
  exact?: string
}

export interface TurnExpectations {
  /** Subject keys this turn asks about (fallback attribution of unanchored ages). */
  subjects?: string[]
  /** Fixture first names and/or explicit ages the request is for. */
  audience?: { members?: string[]; ages?: number[] }
  /** Every shown title must be at most the youngest audience age (never 14+/16+ to a 6-year-old). */
  respectAudienceAge?: boolean
  /** No shown title years too young for EVERY audience member (site rule: gap ≤ −6). */
  notBabyish?: boolean
  /** No title shown in an earlier turn is shown again. */
  noRepeats?: boolean
  /** Shown titles must all be of these types. */
  proposedTypes?: MediaKind[]
  /** Offers to record this reaction (proposeReaction, or says it will note it). */
  offersToRecord?: "WATCHED" | "LOVED"
  /** Crisis: no catalogue title pushed (text or cards). */
  noTitles?: boolean
  /** All of these helplines must be given. */
  careNumbers?: string[]
  /** At least one of these helplines must be given. */
  careNumbersAny?: string[]
  /** Not a one-line « pas mon rayon » refusal. */
  notColdRefusal?: boolean
  /** Crisis: no pivot back to films, series, games or books in this turn. */
  noMediaPivot?: boolean
  /** Crisis: the live router sends the turn to the stronger model. */
  expectStrongerModel?: boolean
  /** Asks which one is meant, or states its assumption. */
  disambiguates?: boolean
  /** Never says the title is missing from the catalogue. */
  notMissing?: boolean
  /** Provisional / off-catalogue titles: no firm age, no link to a tmdb- fiche. */
  hedgeProvisional?: boolean
  /** Any PEGI stated must match the catalogue's official rating. */
  officialRatingGrounded?: boolean
  /** The reply talks about the article on the page (shares a word of its title). */
  mentionsPageTitle?: boolean
  /** Regex sources (normalized text: lowercase, no accents). At least one must match. */
  mustMatchAny?: string[]
  /** Regex sources (normalized text). None may match. */
  mustNotMatch?: string[]
  /** Overrides the default length budget. */
  maxChars?: number
}

export interface EvalTurn {
  user: string
  /** How the simulated parent answers the action cards of this turn's reply. */
  cards?: "ignore" | "accept" | "decline"
  expect?: TurnExpectations
}

export type SourcePageSpec =
  | { path: string }
  | { subject: string }
  | { latestNews: true }

export interface EvalScenario {
  id: string
  category: EvalCategory
  /** One line, in French, for the report. */
  title: string
  /** "eval" = the fictional household, signed in; "none" = anonymous visitor. */
  family: "eval" | "none"
  sourcePage?: SourcePageSpec
  subjects?: Record<string, SubjectQuery>
  /** Fixture reactions (what the household has already seen / loved). */
  seen?: Array<{ member: string; subject: string; reaction: "WATCHED" | "LOVED" }>
  turns: EvalTurn[]
  /** Part of the « smoke » suite (cheap sanity run). */
  smoke?: boolean
}

// ---------------------------------------------------------------------------
// Run results
// ---------------------------------------------------------------------------

/** A catalogue fact read from the DB at run time. */
export interface MediaFact {
  id: string
  title: string
  originalTitle: string | null
  type: string
  expertAgeRec: number | null
  communityAgeRec: number | null
  isEnriched: boolean
  officialRating: string | null
}

/** A title the bot could have shown: from a tool result, a subject or the page. */
export interface KnownTitle {
  id: string | null
  title: string
  originalTitle?: string | null
  type: string | null
  /** Age as the TOOL reported it (the DB age is looked up separately). */
  toolAge: number | null
  /** Off-catalogue cinema card (tmdb-…) or a catalogue title not yet analysed. */
  provisional?: boolean
}

export interface StepTrace {
  text: string
  toolCalls: Array<{ toolCallId: string; toolName: string; input: unknown }>
  toolResults: Array<{ toolCallId: string; toolName: string; output: unknown }>
}

export interface TurnTrace {
  index: number
  user: string
  steps: StepTrace[]
  /** Every step's text — what the parent saw. */
  text: string
  finishReason: string
  model: string
  routing: string
  latencyMs: number
  usage: TotemUsageRecord
  costUsd: number | null
  error?: string
}

export interface CheckResult {
  id: string
  pass: boolean
  detail?: string
}

export interface TurnResult {
  trace: TurnTrace
  checks: CheckResult[]
  judge?: { verdict: "pass" | "fail" | "error"; reason: string }
}

export interface ScenarioResult {
  id: string
  category: EvalCategory
  title: string
  status: "pass" | "fail" | "skipped"
  skipReason?: string
  turns: TurnResult[]
  costUsd: number
  latencyMs: number
}
