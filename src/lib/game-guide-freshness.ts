/**
 * Freshness audit for the Parents' Guide "état du jeu" blocks.
 *
 * WHAT THIS CAN AND CANNOT DO — read before trusting it.
 *
 * This module answers "when was this last checked?", NOT "is this still
 * true?". Those are different questions and only the first one can be
 * answered mechanically.
 *
 * A publisher can change a parental control the day after a human verifies
 * the block. The page would then show a 1-day-old date next to a false
 * statement, and no amount of cron scheduling detects that. The date is an
 * honesty signal to the reader — "this was true on X, go check the official
 * link" — not a correctness guarantee.
 *
 * So the audit deliberately stops at signals that are actually reliable:
 *   1. Age of the human verification (deterministic).
 *   2. Whether `verifiedOn` is even a trustworthy value (a typo'd future
 *      date would otherwise read as eternally fresh — silent and permanent).
 *   3. Whether the official links still resolve (checked in the cron route,
 *      not here). Publishers reorganise their safety docs constantly; a 404
 *      is both a broken reader path AND the best available proxy for "the
 *      underlying documentation moved, so the facts may have moved too".
 *
 * What it pointedly does NOT do is ask a model whether the facts are still
 * accurate. That path fails silently and confidently — the same failure mode
 * that produced fabricated day-0 enrichment on this project. A "still fine"
 * from a model would be worse than no check at all, because it would clear
 * the flag without anyone having looked.
 *
 * Pure and synchronous so it can be unit-tested without network or DB.
 */

import { GAME_GUIDES, type GameGuide } from "@/lib/game-guides"

/** Target cadence: a human re-reads each "état du jeu" block monthly. */
export const REVIEW_INTERVAL_DAYS = 30

/**
 * Grace before "due" becomes "stale". The monthly cron fires on the 1st, so
 * a 30-day target on a 31-day month would flag as overdue every single run.
 */
export const STALE_AFTER_DAYS = 38

export type FreshnessState = "fresh" | "due" | "stale" | "invalid"

export interface GuideFreshness {
  key: string
  name: string
  verifiedOn: string
  /** Whole days since verification. Null when the date is unusable. */
  ageDays: number | null
  state: FreshnessState
  /** Present only for `invalid` — why the date can't be trusted. */
  problem?: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Parse a YYYY-MM-DD as UTC midnight. Null if malformed or not a real date. */
function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return null
  // Rejects "2026-02-31", which Date would silently roll into March.
  if (parsed.toISOString().slice(0, 10) !== value) return null
  return parsed
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Freshness verdict for one guide, relative to `now`. */
export function guideFreshness(guide: GameGuide, now: Date = new Date()): GuideFreshness {
  const base = { key: guide.key, name: guide.name, verifiedOn: guide.stateOfPlay.verifiedOn }
  const verified = parseIsoDate(guide.stateOfPlay.verifiedOn)

  if (!verified) {
    return { ...base, ageDays: null, state: "invalid", problem: "date de vérification illisible" }
  }

  const ageDays = Math.floor((now.getTime() - verified.getTime()) / MS_PER_DAY)

  // A future date is a typo, and it is the dangerous kind: it would keep the
  // block permanently "fresh" and permanently unreviewed. Fail loud.
  if (ageDays < 0) {
    return { ...base, ageDays, state: "invalid", problem: "date de vérification dans le futur" }
  }

  let state: FreshnessState = "fresh"
  if (ageDays > STALE_AFTER_DAYS) state = "stale"
  else if (ageDays >= REVIEW_INTERVAL_DAYS) state = "due"

  return { ...base, ageDays, state }
}

export interface FreshnessAudit {
  checked: number
  fresh: GuideFreshness[]
  due: GuideFreshness[]
  stale: GuideFreshness[]
  invalid: GuideFreshness[]
  /** True when something needs a human: overdue, stale, or an unusable date. */
  needsAttention: boolean
}

/** Freshness verdicts across every guide, bucketed by state. */
export function auditGuideFreshness(
  now: Date = new Date(),
  guides: GameGuide[] = GAME_GUIDES,
): FreshnessAudit {
  const results = guides.map((g) => guideFreshness(g, now))
  const bucket = (s: FreshnessState) => results.filter((r) => r.state === s)

  const due = bucket("due")
  const stale = bucket("stale")
  const invalid = bucket("invalid")

  return {
    checked: results.length,
    fresh: bucket("fresh"),
    due,
    stale,
    invalid,
    needsAttention: due.length + stale.length + invalid.length > 0,
  }
}
