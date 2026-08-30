import { Suspense, type ReactNode } from "react"
import { headers } from "next/headers"
import { getClientIpFromHeaders } from "@/lib/totem/rate-limit"
import { sanitizeSearchQuery } from "@/lib/security"
import { resolveBoard } from "@/lib/nl-search/resolve-blocks"
import { fallbackPlan, type NlPlan } from "@/lib/nl-search/blocks"
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
import { DeferredBlock, DeferredBlockSkeleton } from "./blocks/DeferredBlock"
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
): Promise<{ intent: NlIntent; plan: NlPlan; status: NlResolutionStatus; degraded: boolean }> {
  // 1. The URL already carries an interpretation. The COMPOSITION, however, is
  //    not in the URL — it would make shared links unwieldy — so we still look
  //    the plan up by question. That is a cached read, never a model call: a
  //    chip edit keeps the board it was composed as, instead of collapsing back
  //    to the default layout.
  if (hasStructuredParams(params)) {
    const intent = intentFromSearchParams(params)
    const cachedPlan = query ? (await findCachedParse(hashQuery(query)))?.plan : null
    return {
      intent,
      plan: cachedPlan && cachedPlan.length > 0 ? cachedPlan : fallbackPlan(intent),
      status: "params",
      degraded: false,
    }
  }

  if (!query) {
    const intent = validateNlIntent(null)
    return { intent, plan: fallbackPlan(intent), status: "params", degraded: false }
  }

  const queryHash = hashQuery(query)

  // 2. Someone already asked this — reuse the reading and its composition.
  const cached = await findCachedParse(queryHash)
  if (cached) {
    await recordNlSearch({
      query, queryHash, status: "cache", userId,
      intent: cached.intent, plan: cached.plan,
    })
    return { intent: cached.intent, plan: cached.plan, status: "cache", degraded: false }
  }

  // 3. Budget guards. Both DEGRADE rather than erroring: the visitor still gets
  //    keyword results, just without the interpretation niceties.
  const ip = getClientIpFromHeaders(await headers())
  const rate = checkNlRateLimit({ userId, ip })
  const caps = rate.allowed ? await checkNlDailyCaps({ userId }) : null
  if (!rate.allowed || (caps && !caps.allowed)) {
    const intent = validateNlIntent(null) // → mode "texte"
    await recordNlSearch({ query, queryHash, status: "blocked", userId })
    return { intent, plan: fallbackPlan(intent), status: "blocked", degraded: true }
  }

  // 4. The one billable call.
  const parsed = await parseNlQuery(query)
  if (!parsed) {
    const intent = validateNlIntent(null)
    await recordNlSearch({ query, queryHash, status: "fallback", userId })
    return { intent, plan: fallbackPlan(intent), status: "fallback", degraded: true }
  }

  const status: NlResolutionStatus = parsed.intent.mode === "hors_sujet" ? "hors_sujet" : "llm"

  await recordNlSearch({
    query,
    queryHash,
    status,
    userId,
    intent: parsed.intent,
    plan: parsed.plan,
    model: parsed.model,
    inputTokens: parsed.inputTokens,
    outputTokens: parsed.outputTokens,
    latencyMs: parsed.latencyMs,
  })

  return { intent: parsed.intent, plan: parsed.plan, status, degraded: false }
}

export async function DecouverteResults({
  params,
  userId,
}: {
  params: NlSearchParams
  userId: string | null
}) {
  const query = sanitizeSearchQuery(typeof params.q === "string" ? params.q : "")
  const { intent, plan, degraded } = await resolveIntent(params, query, userId)
  const board = await resolveBoard({ intent, plan, query, userId })

  // Sections that reach TMDB or Sanity stream in behind their own boundaries,
  // so a slow third party delays one row instead of the whole answer.
  const seenIds = board.blocks.flatMap((block) =>
    block.kind === "grid" || block.kind === "rail" ? block.items.map((item) => item.id) : [],
  )
  const slots: Record<number, ReactNode> = {}
  for (const block of board.blocks) {
    if (block.kind !== "deferred") continue
    slots[block.index] = (
      <Suspense fallback={<DeferredBlockSkeleton />}>
        <DeferredBlock
          blockKey={block.key}
          meta={block.meta}
          intent={intent}
          query={query}
          seenIds={seenIds}
        />
      </Suspense>
    )
  }

  return (
    <DecouverteView
      query={query}
      intent={intent}
      board={board}
      degraded={degraded}
      isLoggedIn={!!userId}
      slots={slots}
    />
  )
}
