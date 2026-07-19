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
}

export async function recordUserMessage(params: RecordUserMessageParams) {
  return prisma.totemMessage.create({
    data: {
      conversationId: params.conversationId,
      role: "user",
      content: params.content,
    },
  })
}

export interface RecordAssistantMessageParams {
  conversationId: string
  content: string
  toolCalls?: Prisma.InputJsonValue
  toolResults?: Prisma.InputJsonValue
  citedMediaIds?: string[]
  modelUsed: string
  latencyMs: number
  // Token usage (nullable — null means "unmeasured", never 0).
  inputTokens?: number | null
  outputTokens?: number | null
  cachedInputTokens?: number | null
}

export async function recordAssistantMessage(params: RecordAssistantMessageParams) {
  await prisma.$transaction([
    prisma.totemMessage.create({
      data: {
        conversationId: params.conversationId,
        role: "assistant",
        content: params.content,
        toolCalls: params.toolCalls,
        toolResults: params.toolResults,
        citedMediaIds: params.citedMediaIds ?? [],
        modelUsed: params.modelUsed,
        latencyMs: params.latencyMs,
        inputTokens: params.inputTokens ?? null,
        outputTokens: params.outputTokens ?? null,
        cachedInputTokens: params.cachedInputTokens ?? null,
      },
    }),
    prisma.totemConversation.update({
      where: { id: params.conversationId },
      data: { lastMessageAt: new Date() },
    }),
  ])
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
