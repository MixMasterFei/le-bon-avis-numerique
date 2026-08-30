import { prisma } from "@/lib/prisma"
import { startOfUtcDay } from "@/lib/totem/daily-cap"

/**
 * Daily caps for the interpretation step — the cost circuit breaker.
 *
 * Counts persisted `nl_search_queries` rows with status "llm", so (unlike the
 * hourly in-memory limiter) the number is accurate across Vercel instances and
 * cold starts with no extra infrastructure. Only billable resolutions count:
 * cache hits, chip edits and keyword fallbacks are free and never consume cap.
 *
 * Kept separate from the Totem caps on purpose — one shared counter would let
 * either feature starve the other, and would make a runaway impossible to
 * attribute. Both scopes are env-tunable without a deploy.
 *
 * Ceiling in money: at the global default, ~200 interpretations/day on the fast
 * model is a few tens of cents — a deliberately boring worst case.
 */

export const NL_SEARCH_DAILY_USER_CAP_DEFAULT = 20
export const NL_SEARCH_GLOBAL_DAILY_CAP_DEFAULT = 200

function parseCap(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

export function getNlDailyCaps(): { user: number; global: number } {
  return {
    user: parseCap(process.env.NL_SEARCH_DAILY_USER_CAP, NL_SEARCH_DAILY_USER_CAP_DEFAULT),
    global: parseCap(process.env.NL_SEARCH_GLOBAL_DAILY_CAP, NL_SEARCH_GLOBAL_DAILY_CAP_DEFAULT),
  }
}

export type NlDailyCapResult = { allowed: true } | { allowed: false; scope: "user" | "global" }

export async function checkNlDailyCaps(opts: { userId: string | null }): Promise<NlDailyCapResult> {
  const caps = getNlDailyCaps()
  const since = startOfUtcDay()

  try {
    const [globalCount, userCount] = await Promise.all([
      prisma.nlSearchQuery.count({ where: { status: "llm", createdAt: { gte: since } } }),
      opts.userId
        ? prisma.nlSearchQuery.count({
            where: { status: "llm", createdAt: { gte: since }, userId: opts.userId },
          })
        : Promise.resolve(0),
    ])

    if (globalCount >= caps.global) return { allowed: false, scope: "global" }
    if (opts.userId && userCount >= caps.user) return { allowed: false, scope: "user" }
    return { allowed: true }
  } catch (error) {
    // A counting failure must not open the floodgates: fail CLOSED, so the page
    // degrades to keyword search instead of running uncapped interpretations.
    console.error("[nl-search] daily cap check failed, refusing interpretation:", error)
    return { allowed: false, scope: "global" }
  }
}
