import { Suspense, type ReactNode } from "react"
import { headers } from "next/headers"
import { getClientIpFromHeaders } from "@/lib/totem/rate-limit"
import { sanitizeSearchQuery } from "@/lib/security"
import { computeStripes, resolveBoard } from "@/lib/nl-search/resolve-blocks"
import { fallbackPlan, type NlPlan } from "@/lib/nl-search/blocks"
import { needsCareBanner } from "@/lib/nl-search/care"
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
  // Nothing asked yet: render the invitation. Resolving a board here would run
  // a keyword search for the empty string and always come back with nothing.
  const isIdle = !query && !hasStructuredParams(params)

  let { intent, plan, degraded } = await resolveIntent(params, query, userId)
  let board = isIdle
    ? { blocks: [], personalized: false, members: [], mainCount: 0 }
    : await resolveBoard({ intent, plan, query, userId })

  // A rejection must still try to help. The classifier is deliberately strict
  // about abuse and system-directed text, which means it sometimes rejects a
  // sincere sentence ("j'adore les animaux"). Before showing "nous n'avons pas
  // compris", sweep the catalogue by keyword: if the words match real titles,
  // the person gets results under an honest keyword headline. True garbage and
  // abuse match nothing in a family catalogue, so the dead end self-selects
  // for exactly the cases that deserve it.
  const MIN_RESCUE_RESULTS = 3
  if (intent.mode === "hors_sujet" && query) {
    const rescueIntent = validateNlIntent(null) // → mode "texte"
    const rescuePlan = fallbackPlan(rescueIntent)
    const rescue = await resolveBoard({ intent: rescueIntent, plan: rescuePlan, query, userId })
    if (rescue.mainCount >= MIN_RESCUE_RESULTS) {
      intent = rescueIntent
      plan = rescuePlan
      board = rescue
      degraded = false
    }
  }

  // Sections that reach TMDB or Sanity stream in behind their own boundaries,
  // so a slow third party delays one row instead of the whole answer.
  const seenIds = board.blocks.flatMap((block) =>
    block.kind === "grid" || block.kind === "rail" ? block.items.map((item) => item.id) : [],
  )
  const stripes = computeStripes(board.blocks)

  const slots: Record<number, ReactNode> = {}
  board.blocks.forEach((block, i) => {
    if (block.kind !== "deferred") return
    slots[block.index] = (
      <Suspense fallback={<DeferredBlockSkeleton />}>
        <DeferredBlock
          blockKey={block.key}
          meta={block.meta}
          intent={intent}
          query={query}
          seenIds={seenIds}
          alt={stripes[i]}
        />
      </Suspense>
    )
  })

  return (
    <DecouverteView
      query={query}
      intent={intent}
      board={board}
      degraded={degraded}
      isLoggedIn={!!userId}
      isIdle={isIdle}
      showCareBanner={needsCareBanner(query)}
      slots={slots}
    />
  )
}
