import { NextResponse, type NextRequest } from "next/server"
import { streamText, stepCountIs, convertToModelMessages, type UIMessage } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getMemberAge } from "@/lib/age-utils"
import { buildSystemPrompt, type FamilyMemberSnapshot } from "@/lib/totem/system-prompt"
import { buildTotemTools } from "@/lib/totem/tools"
import { checkTotemRateLimit, getClientIpFromHeaders } from "@/lib/totem/rate-limit"
import { canUseTotem } from "@/lib/totem/access"
import { pickModel } from "@/lib/totem/model-router"
import { parseMediaRouteId } from "@/lib/media-route"
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

  const rateCheck = checkTotemRateLimit({ userId, ip })
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

  // Resolve / create the anon session id
  let sessionId = req.cookies.get(TOTEM_SESSION_COOKIE)?.value
  let setSessionCookie = false
  if (!sessionId) {
    sessionId = newSessionId()
    setSessionCookie = true
  }

  // Page context — when the user is on a media detail page or a news
  // article page, resolve the title/topic so Totem understands "cet
  // article" / "ce film" / "celui-là" without having to ask. Cheap:
  // one Prisma call, only when the path matches.
  let pageContext:
    | {
        type: "media"
        id: string
        title: string
        mediaType: string
        expertAgeRec: number | null
        year: number | null
      }
    | {
        type: "news"
        slug: string
        title: string
        category: string | null
        summary: string
        publishedAt: string | null
      }
    | null = null

  // News article page: /apercudecouverte/[slug]
  // Special-case the index/list views (/apercudecouverte and
  // /apercudecouverte/actualites) where there's no specific article in
  // view — we don't try to resolve a single story for those.
  if (
    typeof body.sourcePage === "string" &&
    body.sourcePage.startsWith("/apercudecouverte/") &&
    !body.sourcePage.startsWith("/apercudecouverte/actualites")
  ) {
    const rawSlug = body.sourcePage.replace(/^\/apercudecouverte\//, "").split(/[?#]/)[0]
    if (rawSlug.length > 0 && rawSlug.length < 200) {
      try {
        const n = await prisma.newsStory.findUnique({
          where: { slug: rawSlug },
          select: {
            slug: true,
            title: true,
            category: true,
            summary: true,
            publishedAt: true,
            status: true,
          },
        })
        if (n && n.status === "PUBLISHED") {
          pageContext = {
            type: "news",
            slug: n.slug,
            title: n.title,
            category: n.category,
            summary: n.summary,
            publishedAt: n.publishedAt ? n.publishedAt.toISOString() : null,
          }
        }
      } catch {
        /* ignore — page context is enrichment, not required */
      }
    }
  }

  if (
    pageContext == null &&
    typeof body.sourcePage === "string" &&
    body.sourcePage.startsWith("/media/")
  ) {
    const rawSegment = body.sourcePage.replace(/^\/media\//, "").split(/[?#]/)[0]
    if (rawSegment.length > 0 && rawSegment.length < 200) {
      // Route format is `<type>:<id>` (e.g. movie:abc-123). Fall back to
      // the raw segment if the colon is missing.
      const { id: parsedId } = parseMediaRouteId(rawSegment)
      const candidates = [parsedId, rawSegment].filter(
        (s, i, arr) => s && s.length > 0 && arr.indexOf(s) === i,
      )
      try {
        for (const candidate of candidates) {
          const m = await prisma.mediaItem.findUnique({
            where: { id: candidate },
            select: {
              id: true,
              title: true,
              type: true,
              expertAgeRec: true,
              releaseDate: true,
            },
          })
          if (m) {
            pageContext = {
              type: "media",
              id: m.id,
              title: m.title,
              mediaType: m.type,
              expertAgeRec: m.expertAgeRec,
              year: m.releaseDate ? new Date(m.releaseDate).getFullYear() : null,
            }
            break
          }
        }
      } catch {
        /* ignore — page context is enrichment, not required */
      }
    }
  }

  // Family snapshot for logged-in users (for richer system prompt context)
  let familyContext: FamilyMemberSnapshot[] | undefined
  if (userId) {
    const members = await prisma.familyMember.findMany({
      where: { userId },
      take: 10,
    })
    familyContext = members.map((m) => ({
      name: m.name,
      age: getMemberAge(m.birthYear, m.birthMonth),
      sensitivities: {
        violence: m.sensitivityViolence,
        scary: m.sensitivityScary,
        sexual: m.sensitivitySexual,
        language: m.sensitivityLanguage,
        substances: m.sensitivitySubstances,
      },
      favoriteGenres: m.favoriteGenres,
      avoidTopics: m.avoidTopics,
    }))
  }

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

  // System prompt (static head + dynamic tail)
  const { staticHead, dynamicTail } = buildSystemPrompt({
    userIsAnonymous: !userId,
    familyContext,
    currentDate: new Date().toISOString().slice(0, 10),
    sourcePage: body.sourcePage ?? null,
    pageContext,
    conversationTurnCount: turnsSoFar + 1,
    personalizationNudgeAllowed,
  })

  // Tools — server tools have execute(), proposeNavigation is client-resolved
  const origin = req.nextUrl.origin
  const cookieHeader = req.headers.get("cookie")
  const tools = buildTotemTools({ origin, cookieHeader, userId })

  // Decide whether to escalate to Sonnet for this turn.
  // Count tool parts in the most recent assistant message in the
  // incoming UIMessage list (cheap; no extra DB call).
  const lastAssistant = [...body.messages].reverse().find((m) => m.role === "assistant")
  const lastTurnToolCount = lastAssistant
    ? (lastAssistant.parts ?? []).filter((p) => typeof p.type === "string" && p.type.startsWith("tool-")).length
    : 0
  const decision = pickModel({
    turnCount: turnsSoFar + 1,
    lastTurnToolCount,
    userText,
  })
  const modelUsed = decision.model

  const startedAt = Date.now()

  const result = streamText({
    model: anthropic(modelUsed),
    // Cache the static head; the dynamic tail is sent fresh each turn.
    system: [
      {
        role: "system" as const,
        content: staticHead,
        providerOptions: {
          anthropic: { cacheControl: { type: "ephemeral" } },
        },
      },
      { role: "system" as const, content: dynamicTail },
    ],
    messages: await convertToModelMessages(body.messages),
    tools,
    stopWhen: stepCountIs(6),
    onFinish: async ({ text, toolCalls, toolResults }) => {
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
