import { randomUUID } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import { createUIMessageStreamResponse } from "ai"
import { auth } from "@/lib/auth"
import type { FamilyMemberSnapshot } from "@/lib/totem/system-prompt"
import { loadFamilyContext, resolvePageContext, startTotemTurn, type TotemTools } from "@/lib/totem/pipeline"
import { checkTotemRateLimit, getClientIpFromHeaders } from "@/lib/totem/rate-limit"
import { canUseTotem } from "@/lib/totem/access"
import { parseChatRequest, TOTEM_BODY_MAX_BYTES } from "@/lib/totem/chat-request"
import { buildTrustedHistory } from "@/lib/totem/history"
import { createTurnRecorder } from "@/lib/totem/turn-record"
import { checkDailyCaps, secondsUntilNextUtcDay } from "@/lib/totem/daily-cap"
import {
  countTurnsInConversation,
  getOrCreateConversation,
  lastAssistantMentionedNudge,
  loadConversationRows,
  newSessionId,
  recordAssistantMessage,
  recordUserMessage,
  TOTEM_SESSION_COOKIE,
  TOTEM_TURN_CAP,
} from "@/lib/totem/persistence"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Pipes the UI stream through untouched and settles the turn when it closes:
 * a normal end is a no-op (onFinish already persisted it), a fatal error is
 * logged as "error", and a browser that goes away mid-answer as
 * "client_disconnected" — both used to leave no assistant row at all.
 */
function settleWhenClosed<T>(
  stream: ReadableStream<T>,
  hooks: { end: () => Promise<void>; disconnect: () => Promise<void> },
): ReadableStream<T> {
  const reader = stream.getReader()
  return new ReadableStream<T>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          await hooks.end()
          controller.close()
          return
        }
        controller.enqueue(value)
      } catch (err) {
        await hooks.end()
        controller.error(err)
      }
    },
    async cancel(reason) {
      await hooks.disconnect()
      await reader.cancel(reason)
    },
  })
}

export async function POST(req: NextRequest) {
  // Size first, before reading or parsing anything (F07): the compact body
  // the chat sends is a few hundred bytes.
  const declaredLength = Number(req.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > TOTEM_BODY_MAX_BYTES) {
    return NextResponse.json({ error: "body_too_large", limit: TOTEM_BODY_MAX_BYTES }, { status: 413 })
  }
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  // Roles, part types, ordering, sizes, action-card outcomes, sourcePage —
  // all validated before any auth, quota, database or model work.
  const parsed = parseChatRequest(rawBody)
  if (!parsed.ok) {
    const { status, ...error } = parsed.error
    return NextResponse.json(error, { status })
  }
  const { userText, userMessage, sourcePage, trigger, toolOutcomes } = parsed.value

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
  const pageContext = await resolvePageContext(sourcePage)
  const familyContext: FamilyMemberSnapshot[] | undefined = userId
    ? await loadFamilyContext(userId)
    : undefined

  // Get or create conversation (ownership checked: a foreign id starts a new one)
  const conversation = await getOrCreateConversation({
    conversationId: parsed.value.conversationId,
    userId,
    sessionId,
    sourcePage,
    familyMemberContext: familyContext ? (familyContext as unknown as never) : undefined,
  })

  const turnsSoFar = await countTurnsInConversation(conversation.id)
  if (turnsSoFar >= TOTEM_TURN_CAP) {
    return NextResponse.json(
      { error: "turn_cap_reached", limit: TOTEM_TURN_CAP },
      { status: 409 },
    )
  }

  // Trusted history: the rows this route wrote, read before the new message.
  const rows = await loadConversationRows(conversation.id)

  await recordUserMessage({
    conversationId: conversation.id,
    content: userText,
    regenerate: trigger === "regenerate-message",
  })

  // Personalisation nudge gating
  const nudgeRecentlyShown = await lastAssistantMentionedNudge(conversation.id)
  const personalizationNudgeAllowed =
    !userId && turnsSoFar >= 1 && !nudgeRecentlyShown

  // Bounded history (6 exchanges / 48K serialized chars, tool outputs
  // included) + the new message. The router's "previous turn used several
  // tools" input comes from the stored turn, not from the client.
  const history = buildTrustedHistory({ rows, userText, trigger, outcomes: toolOutcomes })

  // The id the browser will show (start chunk) is the id the row gets, so
  // feedback on this answer finds it.
  const assistantMessageId = randomUUID()
  const startedAt = Date.now()
  let modelUsed = ""
  let routingReason = ""

  const recorder = createTurnRecorder<TotemTools>(async (record) => {
    try {
      await recordAssistantMessage({
        id: assistantMessageId,
        conversationId: conversation.id,
        content: record.content,
        toolCalls: record.toolCalls.length ? (record.toolCalls as unknown as never) : undefined,
        toolResults: record.toolResults.length ? (record.toolResults as unknown as never) : undefined,
        modelMessages: record.modelMessages.length ? (record.modelMessages as unknown as never) : undefined,
        citedMediaIds: record.citedMediaIds,
        modelUsed,
        routingReason,
        finishReason: record.finishReason,
        latencyMs: Date.now() - startedAt,
        // Summed across all steps of the turn; null = unmeasured.
        ...record.usage,
      })
    } catch (err) {
      console.error("[totem] failed to persist assistant message", err)
    }
  })

  const turn = startTotemTurn({
    messages: history.messages,
    userText,
    userId,
    familyContext,
    sourcePage,
    pageContext,
    turnsSoFar,
    personalizationNudgeAllowed,
    lastTurnToolCount: history.lastTurnToolCount,
    toolContext: {
      origin: req.nextUrl.origin,
      cookieHeader: req.headers.get("cookie"),
      userId,
    },
    onStepFinish: (step) => recorder.onStepFinish(step),
    onFinish: (event) => recorder.finish(event),
    onAbort: (event) => recorder.abort(event),
    onError: ({ error }) => recorder.onError(error),
  })
  modelUsed = turn.model
  routingReason = turn.routing

  const response = createUIMessageStreamResponse({
    stream: settleWhenClosed(
      turn.result.toUIMessageStream({
        originalMessages: [userMessage],
        generateMessageId: () => assistantMessageId,
        sendReasoning: false,
      }),
      { end: () => recorder.end(), disconnect: () => recorder.disconnect() },
    ),
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
