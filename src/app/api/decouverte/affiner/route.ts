import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { sanitizeSearchQuery } from "@/lib/security"
import { getClientIpFromHeaders } from "@/lib/totem/rate-limit"
import { canUseNlSearch } from "@/lib/nl-search/access"
import { checkNlDailyCaps } from "@/lib/nl-search/daily-cap"
import { parseNlQuery } from "@/lib/nl-search/parse"
import { checkNlRateLimit } from "@/lib/nl-search/rate-limit"
import { findCachedParse, hashQuery, recordNlSearch } from "@/lib/nl-search/telemetry"
import {
  hasStructuredParams,
  intentFromSearchParams,
  intentToSearchParams,
  validateNlIntent,
  type NlSearchParams,
} from "@/lib/nl-search/validate"
import type { NlIntent } from "@/lib/nl-search/types"

export const dynamic = "force-dynamic"

const NOT_UNDERSTOOD =
  "Nous n'avons pas compris cette précision. Reformulez-la, ou ajustez directement les critères affichés."

/**
 * The follow-up half of the conversation: « plutôt des séries », « sans
 * frayeurs », « moins longs ». The client sends the question on screen, the
 * current filter params and the new sentence; this route refines the
 * interpretation ONCE and answers with a fully materialized /decouverte URL —
 * structured params only, so the page that renders it never re-interprets.
 *
 * The refined reading is recorded under the COMBINED question (« q · suite »),
 * which becomes the board's question from here on: chip edits keep finding the
 * refined composition, sharing stores it, and the same follow-up asked twice
 * is a cache hit. Removed-title ids ride through untouched — a refinement can
 * never resurrect a title the family already dismissed.
 */
export async function POST(request: Request) {
  const session = await auth()
  const userId = session?.user?.id ?? null

  if (!canUseNlSearch({ isAuthenticated: !!session?.user, role: session?.user?.role })) {
    return NextResponse.json({ error: "Indisponible." }, { status: 403 })
  }

  let body: { q?: unknown; params?: unknown; suite?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 })
  }

  const suite = sanitizeSearchQuery(typeof body.suite === "string" ? body.suite : "")
  if (suite.length < 2) {
    return NextResponse.json({ error: "Précisez ce que vous voulez ajuster." }, { status: 400 })
  }

  const query = sanitizeSearchQuery(typeof body.q === "string" ? body.q : "")
  const params: NlSearchParams =
    body.params && typeof body.params === "object" && !Array.isArray(body.params)
      ? (body.params as NlSearchParams)
      : {}

  // The base is the board as the person SEES it: structured params when the
  // URL carries them (chip edits, removals), else the cached reading of the
  // question. Both go through the same clamps as any other input.
  const base: NlIntent = hasStructuredParams(params)
    ? intentFromSearchParams(params)
    : (query ? (await findCachedParse(hashQuery(query)))?.intent : null) ?? validateNlIntent(null)

  if (base.mode === "hors_sujet") {
    return NextResponse.json({ error: NOT_UNDERSTOOD }, { status: 422 })
  }

  // From here on the combined sentence IS the question — sanitized with the
  // page's own function so both sides hash identical text.
  const combined = sanitizeSearchQuery(query ? `${query} · ${suite}` : suite)
  const combinedHash = hashQuery(combined)

  const respond = (intent: NlIntent) =>
    NextResponse.json({ url: `/decouverte?${intentToSearchParams(intent, combined).toString()}` })

  // Same follow-up already interpreted (back button, a retry, another parent
  // with the same chain): free. Exclusions come from the live base, not the
  // cached row — the cache is shared across users and never stores them.
  const cached = await findCachedParse(combinedHash)
  const cachedUsable =
    !!cached &&
    cached.intent.mode !== "hors_sujet" &&
    // A row that would fail the texte-guard below (someone typed the combined
    // text as a fresh keyword question) is not a refinement — parse instead.
    !(base.mode === "filtre" && cached.intent.mode === "texte")
  if (cached && cachedUsable) {
    await recordNlSearch({
      query: combined, queryHash: combinedHash, status: "cache", userId,
      intent: cached.intent, plan: cached.plan,
    })
    return respond({ ...cached.intent, excludedIds: base.excludedIds })
  }

  // Budget guards. A refinement is optional comfort on a board that already
  // renders, so unlike the page there is no keyword degradation — just an
  // honest "later".
  const ip = getClientIpFromHeaders(await headers())
  const rate = await checkNlRateLimit({ userId, ip })
  if (rate.unavailable) {
    return NextResponse.json(
      { error: "L'interprétation est momentanément indisponible. Réessayez dans un instant." },
      { status: 503, headers: { "Retry-After": String(rate.retryAfterSec), "Cache-Control": "no-store" } },
    )
  }
  const caps = rate.allowed ? await checkNlDailyCaps({ userId }) : null
  if (!rate.allowed || (caps && !caps.allowed)) {
    await recordNlSearch({ query: combined, queryHash: combinedHash, status: "blocked", userId })
    return NextResponse.json(
      { error: "Beaucoup de demandes en ce moment. Réessayez dans quelques minutes, ou ajustez les critères affichés." },
      { status: 429 },
    )
  }

  const parsed = await parseNlQuery(suite, base)
  if (!parsed) {
    await recordNlSearch({ query: combined, queryHash: combinedHash, status: "fallback", userId })
    return NextResponse.json(
      { error: "L'interprétation est momentanément indisponible. Réessayez dans un instant." },
      { status: 503 },
    )
  }

  // A refinement that comes back unusable must not wreck a good board: keep it
  // and ask for a reformulation instead of degrading to a keyword search.
  if (parsed.intent.mode === "hors_sujet" || (base.mode === "filtre" && parsed.intent.mode === "texte")) {
    await recordNlSearch({ query: combined, queryHash: combinedHash, status: "hors_sujet", userId })
    return NextResponse.json({ error: NOT_UNDERSTOOD }, { status: 422 })
  }

  await recordNlSearch({
    query: combined,
    queryHash: combinedHash,
    status: "llm",
    userId,
    // Stored WITHOUT the exclusions: the cache row may serve other users.
    intent: { ...parsed.intent, excludedIds: [] },
    plan: parsed.plan,
    model: parsed.model,
    inputTokens: parsed.inputTokens,
    outputTokens: parsed.outputTokens,
    latencyMs: parsed.latencyMs,
  })

  return respond(parsed.intent)
}
