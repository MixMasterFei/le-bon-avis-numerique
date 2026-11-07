import { NextResponse, type NextRequest } from "next/server"
import { convertToModelMessages, type UIMessage } from "ai"
import { auth } from "@/lib/auth"
import type { FamilyMemberSnapshot } from "@/lib/totem/system-prompt"
import { loadFamilyContext, resolvePageContext, startTotemTurn } from "@/lib/totem/pipeline"
import { checkTotemRateLimit, getClientIpFromHeaders } from "@/lib/totem/rate-limit"
import { canUseTotem } from "@/lib/totem/access"
import { extractUsage } from "@/lib/totem/usage"
import { truncateHistory, TOTEM_BODY_MAX_MESSAGES } from "@/lib/totem/history"
import { checkDailyCaps, secondsUntilNextUtcDay } from "@/lib/totem/daily-cap"
import {
  countTurnsInConversation,
  getOrCreateConversation,
  lastAssistantMentionedNudge,
  newSessionId,
  recordAssistantMessage,
  recordUserMessage,
  TOTEM_SESSION_COOKIE,
  TOTEM_TURN_CAP,
} from "@/lib/totem/persistence"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_INPUT_CHARS = 1500

interface ChatBody {
  messages: UIMessage[]
  conversationId?: string
  sourcePage?: string | null
}

export async function POST(req: NextRequest) {
  let body: ChatBody
  try {
    body = (await req.json()) as ChatBody
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "missing_messages" }, { status: 400 })
  }

  // The history array is client-controlled; nothing legitimate approaches
  // this (the turn cap is 20). Reject outright rather than paying to
  // truncate a hostile payload.
  if (body.messages.length > TOTEM_BODY_MAX_MESSAGES) {
    return NextResponse.json({ error: "history_too_long" }, { status: 413 })
  }

  const lastUserMsg = [...body.messages].reverse().find((m) => m.role === "user")
  if (!lastUserMsg) {
    return NextResponse.json({ error: "no_user_message" }, { status: 400 })
  }

  // Extract plain-text content from the last user message (UIMessage parts)
  const userText = (lastUserMsg.parts ?? [])
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim()

  if (!userText) {
    return NextResponse.json({ error: "empty_user_message" }, { status: 400 })
  }

  if (userText.length > MAX_INPUT_CHARS) {
    return NextResponse.json(
      { error: "message_too_long", limit: MAX_INPUT_CHARS },
      { status: 413 },
    )
  }

  // Resolve auth and rate-limit identity
  const session = await auth()
  const userId = session?.user?.id ?? null
  const ip = getClientIpFromHeaders(req.headers)

  // Access gate — admin-only during alpha unless TOTEM_PUBLIC=true.
  if (!canUseTotem({ isAuthenticated: !!session?.user, role: session?.user?.role ?? null })) {
    return NextResponse.json({ error: "totem_disabled" }, { status: 403 })
  }

  const rateCheck = await checkTotemRateLimit({ userId, ip })
  if (rateCheck.unavailable) {
    return NextResponse.json(
      {
        error: "totem_unavailable",
        message: "Totem est momentanément indisponible. Réessayez dans un instant.",
        retryAfterSec: rateCheck.retryAfterSec,
      },
      { status: 503, headers: { "Retry-After": String(rateCheck.retryAfterSec), "Cache-Control": "no-store" } },
    )
  }
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        retryAfterSec: rateCheck.retryAfterSec,
        limit: rateCheck.limit,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSec) },
      },
    )
  }

  // Daily caps count persisted responses across instances. The hourly guard
  // above reserves requests atomically before any model call.
  const dailyCheck = await checkDailyCaps({ userId })
  if (!dailyCheck.allowed) {
    const retryAfterSec = secondsUntilNextUtcDay()
    if (dailyCheck.scope === "user") {
      return NextResponse.json(
        {
          error: "daily_cap_reached",
          message: "Vous avez atteint la limite quotidienne d'échanges avec Totem. Revenez demain !",
          retryAfterSec,
        },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
      )
    }
    return NextResponse.json(
      {
        error: "totem_resting",
        message: "Totem se repose pour aujourd'hui. Revenez demain !",
        retryAfterSec,
      },
      { status: 503, headers: { "Retry-After": String(retryAfterSec) } },
    )
  }

  // Resolve / create the anon session id
  let sessionId = req.cookies.get(TOTEM_SESSION_COOKIE)?.value
  let setSessionCookie = false
  if (!sessionId) {
    sessionId = newSessionId()
    setSessionCookie = true
  }

  // Page context (media fiche / news article) and the signed-in household,
  // both resolved by the shared pipeline so the bench sees the same prompt.
  const pageContext = await resolvePageContext(body.sourcePage)
  const familyContext: FamilyMemberSnapshot[] | undefined = userId
    ? await loadFamilyContext(userId)
    : undefined

  // Get or create conversation
  const conversation = await getOrCreateConversation({
    conversationId: body.conversationId,
    userId,
    sessionId,
    sourcePage: body.sourcePage ?? null,
    familyMemberContext: familyContext ? (familyContext as unknown as never) : undefined,
  })

  const turnsSoFar = await countTurnsInConversation(conversation.id)
  if (turnsSoFar >= TOTEM_TURN_CAP) {
    return NextResponse.json(
      { error: "turn_cap_reached", limit: TOTEM_TURN_CAP },
      { status: 409 },
    )
  }

  await recordUserMessage({ conversationId: conversation.id, content: userText })

  // Personalisation nudge gating
  const nudgeRecentlyShown = await lastAssistantMentionedNudge(conversation.id)
  const personalizationNudgeAllowed =
    !userId && turnsSoFar >= 1 && !nudgeRecentlyShown

  // Previous assistant turn's tool count (router input): tool parts in the
  // most recent assistant message of the incoming list.
  const lastAssistant = [...body.messages].reverse().find((m) => m.role === "assistant")
  const lastTurnToolCount = lastAssistant
    ? (lastAssistant.parts ?? []).filter((p) => typeof p.type === "string" && p.type.startsWith("tool-")).length
    : 0

  const startedAt = Date.now()

  const { result, model: modelUsed } = startTotemTurn({
    // Server-side history bound: the client array is truncated to the last
    // ~6 exchanges / 16K chars — the server, not the client, decides how
    // much history reaches the model (input-token cost control).
    messages: await convertToModelMessages(truncateHistory(body.messages)),
    userText,
    userId,
    familyContext,
    sourcePage: body.sourcePage ?? null,
    pageContext,
    turnsSoFar,
    personalizationNudgeAllowed,
    lastTurnToolCount,
    toolContext: {
      origin: req.nextUrl.origin,
      cookieHeader: req.headers.get("cookie"),
      userId,
    },
    onFinish: async ({ text, toolCalls, toolResults, totalUsage }) => {
      try {
        const citedMediaIds = extractCitedMediaIds(toolResults)
        await recordAssistantMessage({
          conversationId: conversation.id,
          content: text,
          toolCalls: toolCalls?.length ? (toolCalls as unknown as never) : undefined,
          toolResults: toolResults?.length ? (toolResults as unknown as never) : undefined,
          citedMediaIds,
          modelUsed,
          latencyMs: Date.now() - startedAt,
          // Summed across all steps of the turn; null = unmeasured.
          ...extractUsage(totalUsage),
        })
      } catch (err) {
        console.error("[totem] failed to persist assistant message", err)
      }
    },
  })

  const response = result.toUIMessageStreamResponse({
    sendReasoning: false,
    headers: {
      "x-totem-conversation-id": conversation.id,
      "x-totem-rate-remaining": String(rateCheck.remaining),
    },
  })

  // Attach the anon session cookie on first response
  if (setSessionCookie) {
    response.headers.append(
      "Set-Cookie",
      `${TOTEM_SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`,
    )
  }

  return response
}

function extractCitedMediaIds(
  toolResults: ReadonlyArray<{ toolName: string; output?: unknown }> | undefined,
): string[] {
  if (!toolResults?.length) return []
  const ids = new Set<string>()
  for (const tr of toolResults) {
    const out = tr.output as unknown
    if (!out || typeof out !== "object") continue
    if ("results" in out && Array.isArray((out as { results?: unknown[] }).results)) {
      for (const r of (out as { results: Array<{ id?: string }> }).results) {
        if (r && typeof r.id === "string") ids.add(r.id)
      }
    }
    if ("id" in out && typeof (out as { id?: unknown }).id === "string") {
      ids.add((out as { id: string }).id)
    }
  }
  return Array.from(ids)
}
