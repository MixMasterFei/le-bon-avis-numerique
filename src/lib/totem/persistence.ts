import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export interface ResolveConversationParams {
  conversationId?: string | null
  userId: string | null
  sessionId: string
  sourcePage?: string | null
  familyMemberContext?: Prisma.InputJsonValue
}

/**
 * Get an existing conversation (validating ownership) or create a fresh one.
 * For auth users, the conversation is scoped to their userId. For anon
 * users, it's scoped to their session cookie.
 */
export async function getOrCreateConversation(params: ResolveConversationParams) {
  const { conversationId, userId, sessionId, sourcePage, familyMemberContext } = params

  if (conversationId) {
    const existing = await prisma.totemConversation.findUnique({
      where: { id: conversationId },
    })
    if (existing) {
      const ownsAuth = userId && existing.userId === userId
      const ownsAnon = !userId && !existing.userId && existing.sessionId === sessionId
      if (ownsAuth || ownsAnon) return existing
    }
  }

  return prisma.totemConversation.create({
    data: {
      userId: userId ?? null,
      sessionId,
      sourcePage: sourcePage ?? null,
      familyMemberContext: familyMemberContext ?? Prisma.JsonNull,
    },
  })
}

export interface RecordUserMessageParams {
  conversationId: string
  content: string
  /**
   * « Réessayer »: the browser dropped the previous answer and re-sent the
   * question. Stored as finish_reason = "regenerate" on the user row so the
   * trusted history later skips the superseded exchange, as the browser did.
   */
  regenerate?: boolean
}

export async function recordUserMessage(params: RecordUserMessageParams) {
  return prisma.totemMessage.create({
    data: {
      conversationId: params.conversationId,
      role: "user",
      content: params.content,
      ...(params.regenerate ? { finishReason: "regenerate" } : {}),
    },
  })
}

export interface RecordAssistantMessageParams {
  /**
   * Pre-generated row id. The chat route sends the same id to the browser in
   * the stream's start chunk, so the feedback buttons post an id that exists
   * (they used to post the browser's own id and get a silent 404).
   */
  id?: string
  conversationId: string
  content: string
  /** Every step's tool calls / results (not just the final step's). */
  toolCalls?: Prisma.InputJsonValue
  toolResults?: Prisma.InputJsonValue
  /** The turn's response messages, replayed as trusted history. */
  modelMessages?: Prisma.InputJsonValue
  citedMediaIds?: string[]
  modelUsed: string
  /** Why the router chose modelUsed (or "override" on the bench). */
  routingReason?: string | null
  /** "stop", "tool-calls", "length", "aborted", "client_disconnected", "error"… */
  finishReason?: string | null
  latencyMs: number
  // Token usage (nullable — null means "unmeasured", never 0).
  inputTokens?: number | null
  outputTokens?: number | null
  cachedInputTokens?: number | null
  uncachedInputTokens?: number | null
  cacheWriteInputTokens?: number | null
}

export async function recordAssistantMessage(params: RecordAssistantMessageParams) {
  await prisma.$transaction([
    prisma.totemMessage.create({
      data: {
        ...(params.id ? { id: params.id } : {}),
        conversationId: params.conversationId,
        role: "assistant",
        content: params.content,
        toolCalls: params.toolCalls,
        toolResults: params.toolResults,
        modelMessages: params.modelMessages,
        citedMediaIds: params.citedMediaIds ?? [],
        modelUsed: params.modelUsed,
        routingReason: params.routingReason ?? null,
        finishReason: params.finishReason ?? null,
        latencyMs: params.latencyMs,
        inputTokens: params.inputTokens ?? null,
        outputTokens: params.outputTokens ?? null,
        cachedInputTokens: params.cachedInputTokens ?? null,
        uncachedInputTokens: params.uncachedInputTokens ?? null,
        cacheWriteInputTokens: params.cacheWriteInputTokens ?? null,
      },
    }),
    prisma.totemConversation.update({
      where: { id: params.conversationId },
      data: { lastMessageAt: new Date() },
    }),
  ])
}

/**
 * The stored rows the trusted history is rebuilt from, oldest first. Read
 * BEFORE the new user message is recorded. 40 rows is far more than the
 * history keeps (6 exchanges) — the bound is applied by buildTrustedHistory.
 */
export async function loadConversationRows(conversationId: string) {
  const rows = await prisma.totemMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { role: true, content: true, modelMessages: true, toolCalls: true, finishReason: true },
  })
  return rows.reverse()
}

export async function countTurnsInConversation(conversationId: string): Promise<number> {
  return prisma.totemMessage.count({
    where: { conversationId, role: "user" },
  })
}

/**
 * Returns true if the previous assistant message in this conversation
 * already contained a personalisation nudge (so we don't repeat it).
 */
export async function lastAssistantMentionedNudge(conversationId: string): Promise<boolean> {
  const last = await prisma.totemMessage.findFirst({
    where: { conversationId, role: "assistant" },
    orderBy: { createdAt: "desc" },
    select: { content: true },
  })
  if (!last) return false
  const c = last.content.toLowerCase()
  return (
    c.includes("créez un compte") ||
    c.includes("créer un profil") ||
    c.includes("avec un compte") ||
    c.includes("créer un compte")
  )
}

export function newSessionId(): string {
  return `tt_${randomUUID()}`
}

export const TOTEM_SESSION_COOKIE = "totem_sid"
export const TOTEM_TURN_CAP = 20
