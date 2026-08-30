import { headers } from "next/headers"
import { getClientIpFromHeaders } from "@/lib/totem/rate-limit"
import { sanitizeSearchQuery } from "@/lib/security"
import { assembleResults } from "@/lib/nl-search/assemble"
import { checkNlDailyCaps } from "@/lib/nl-search/daily-cap"
import { parseNlQuery } from "@/lib/nl-search/parse"
import { checkNlRateLimit } from "@/lib/nl-search/rate-limit"
import { findCachedParse, hashQuery, recordNlSearch } from "@/lib/nl-search/telemetry"
import {
  hasStructuredParams,
  intentFromSearchParams,
  validateNlIntent,
  type NlSearchParams,
} from "@/lib/nl-search/validate"
import type { NlIntent, NlResolutionStatus } from "@/lib/nl-search/types"
import { DecouverteView } from "./DecouverteView"

/**
 * Resolves the question into an intent, then hands it to the deterministic
 * assembly. The ORDER below is what guarantees the interpretation step runs at
 * most once per genuinely new question:
 *
 *   1. structured URL params  → rebuild from params      (chip edit, shared link)
 *   2. cached parse            → reuse a previous reading (repeat question)
 *   3. rate limit / daily cap  → degrade to keyword search
 *   4. otherwise               → one interpretation call
 *
 * Steps 1-3 never touch the model, and the chips the page renders always link
 * to param URLs — so the first refinement leaves the paid path permanently.
 */
async function resolveIntent(
  params: NlSearchParams,
  query: string,
  userId: string | null,
): Promise<{ intent: NlIntent; status: NlResolutionStatus; degraded: boolean }> {
  // 1. The URL already carries an interpretation.
  if (hasStructuredParams(params)) {
    return { intent: intentFromSearchParams(params), status: "params", degraded: false }
  }

  if (!query) {
    return { intent: validateNlIntent(null), status: "params", degraded: false }
  }

  const queryHash = hashQuery(query)

  // 2. Someone already asked this — reuse the reading.
  const cached = await findCachedParse(queryHash)
  if (cached) {
    await recordNlSearch({ query, queryHash, status: "cache", userId, intent: cached })
    return { intent: cached, status: "cache", degraded: false }
  }

  // 3. Budget guards. Both DEGRADE rather than erroring: the visitor still gets
  //    keyword results, just without the interpretation niceties.
  const ip = getClientIpFromHeaders(await headers())
  const rate = checkNlRateLimit({ userId, ip })
  const caps = rate.allowed ? await checkNlDailyCaps({ userId }) : null
  if (!rate.allowed || (caps && !caps.allowed)) {
    const intent = validateNlIntent(null) // → mode "texte"
    await recordNlSearch({ query, queryHash, status: "blocked", userId })
    return { intent, status: "blocked", degraded: true }
  }

  // 4. The one billable call.
  const parsed = await parseNlQuery(query)
  if (!parsed) {
    const intent = validateNlIntent(null)
    await recordNlSearch({ query, queryHash, status: "fallback", userId })
    return { intent, status: "fallback", degraded: true }
  }

  await recordNlSearch({
    query,
    queryHash,
    status: parsed.intent.mode === "hors_sujet" ? "hors_sujet" : "llm",
    userId,
    intent: parsed.intent,
    model: parsed.model,
    inputTokens: parsed.inputTokens,
    outputTokens: parsed.outputTokens,
    latencyMs: parsed.latencyMs,
  })

  return {
    intent: parsed.intent,
    status: parsed.intent.mode === "hors_sujet" ? "hors_sujet" : "llm",
    degraded: false,
  }
}

export async function DecouverteResults({
  params,
  userId,
}: {
  params: NlSearchParams
  userId: string | null
}) {
  const query = sanitizeSearchQuery(typeof params.q === "string" ? params.q : "")
  const { intent, degraded } = await resolveIntent(params, query, userId)
  const results = await assembleResults({ intent, query, userId })

  return (
    <DecouverteView
      query={query}
      intent={intent}
      results={results}
      degraded={degraded}
      isLoggedIn={!!userId}
    />
  )
}
