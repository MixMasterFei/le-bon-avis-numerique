import { prisma } from "@/lib/prisma"
import { estimateCostUsd } from "@/lib/totem/cost"

const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface TotemDailyVolumePoint {
  day: string
  conversations: number
  userMessages: number
  assistantMessages: number
}

export interface TotemDailyFeedbackPoint {
  day: string
  up: number
  down: number
}

export interface TotemToolUsageRow {
  tool: string
  count: number
}

export interface TotemModelUsageRow {
  model: string
  count: number
}

export interface TotemSourcePageRow {
  path: string
  count: number
}

export interface TotemCitedMediaRow {
  mediaId: string
  title: string
  type: string
  count: number
}

export interface TotemRecentFeedbackRow {
  id: string
  rating: string
  reason: string | null
  createdAt: string
  messagePreview: string
  conversationId: string
  userEmail: string | null
}

export interface TotemAdminOverview {
  periodDays: number
  generatedAt: string
  totals: {
    conversations: number
    userMessages: number
    assistantMessages: number
    authenticatedUsers: number
    anonymousSessions: number
    feedbackUp: number
    feedbackDown: number
    satisfactionPct: number | null
    avgLatencyMs: number | null
    avgUserTurnsPerConversation: number | null
    sonnetTurnPct: number | null
    // Token totals over the period (assistant messages with recorded usage
    // only — rows predating the cost migration don't count) and the
    // resulting cost ESTIMATE in USD (null when nothing measurable).
    inputTokens: number
    outputTokens: number
    cachedInputTokens: number
    estimatedCostUsd: number | null
  }
  wow: {
    conversations: number
    userMessages: number
    prevConversations: number
    prevUserMessages: number
  }
  dailyVolume: TotemDailyVolumePoint[]
  dailyFeedback: TotemDailyFeedbackPoint[]
  toolUsage: TotemToolUsageRow[]
  modelUsage: TotemModelUsageRow[]
  topSourcePages: TotemSourcePageRow[]
  topCitedMedia: TotemCitedMediaRow[]
  recentNegativeFeedback: TotemRecentFeedbackRow[]
}

export interface TotemConversationListItem {
  id: string
  startedAt: string
  lastMessageAt: string
  sourcePage: string | null
  userEmail: string | null
  userName: string | null
  isAnonymous: boolean
  userTurns: number
  messageCount: number
  feedbackDown: number
  feedbackUp: number
  preview: string
  lastModel: string | null
  avgLatencyMs: number | null
}

export interface TotemConversationListResult {
  conversations: TotemConversationListItem[]
  total: number
  page: number
  pageSize: number
}

export interface TotemMessageDetail {
  id: string
  role: string
  content: string
  createdAt: string
  modelUsed: string | null
  latencyMs: number | null
  inputTokens: number | null
  outputTokens: number | null
  cachedInputTokens: number | null
  /** Per-message cost ESTIMATE (USD); null = unmeasured or unknown model. */
  estimatedCostUsd: number | null
  citedMediaIds: string[]
  toolCalls: unknown
  toolResults: unknown
  feedback: Array<{ id: string; rating: string; reason: string | null; createdAt: string }>
}

export interface TotemConversationDetail {
  id: string
  startedAt: string
  lastMessageAt: string
  sourcePage: string | null
  user: { id: string; email: string; name: string | null } | null
  sessionId: string
  familyMemberContext: unknown
  messages: TotemMessageDetail[]
}

function sinceDays(days: number): Date {
  return new Date(Date.now() - days * MS_PER_DAY)
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function buildDailySeries<T extends { day: string }>(
  days: number,
  fill: (day: string) => T,
): T[] {
  const out: T[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * MS_PER_DAY)
    out.push(fill(dayKey(d)))
  }
  return out
}

function extractToolNames(toolCalls: unknown): string[] {
  if (!Array.isArray(toolCalls)) return []
  const names: string[] = []
  for (const tc of toolCalls) {
    if (tc && typeof tc === "object") {
      const o = tc as Record<string, unknown>
      if (typeof o.toolName === "string") names.push(o.toolName)
      else if (typeof o.name === "string") names.push(o.name)
    }
  }
  return names
}

export async function fetchTotemAdminOverview(periodDays = 30): Promise<TotemAdminOverview> {
  const since = sinceDays(periodDays)
  const prevSince = sinceDays(periodDays * 2)
  const prevUntil = since

  const [
    conversations,
    prevConversations,
    userMessages,
    prevUserMessages,
    assistantMessages,
    authUsers,
    anonSessions,
    feedbackGroups,
    latencyAgg,
    turnAgg,
    convByDay,
    userMsgByDay,
    asstMsgByDay,
    feedbackByDay,
    recentAssistantWithTools,
    modelGroups,
    tokenGroups,
    sourcePageGroups,
    citedRows,
    recentDown,
  ] = await Promise.all([
    prisma.totemConversation.count({ where: { startedAt: { gte: since } } }),
    prisma.totemConversation.count({
      where: { startedAt: { gte: prevSince, lt: prevUntil } },
    }),
    prisma.totemMessage.count({ where: { role: "user", createdAt: { gte: since } } }),
    prisma.totemMessage.count({
      where: { role: "user", createdAt: { gte: prevSince, lt: prevUntil } },
    }),
    prisma.totemMessage.count({ where: { role: "assistant", createdAt: { gte: since } } }),
    prisma.totemConversation.groupBy({
      by: ["userId"],
      where: { startedAt: { gte: since }, userId: { not: null } },
    }),
    prisma.totemConversation.groupBy({
      by: ["sessionId"],
      where: { startedAt: { gte: since }, userId: null },
    }),
    prisma.totemFeedback.groupBy({
      by: ["rating"],
      where: { createdAt: { gte: since } },
      _count: true,
    }),
    prisma.totemMessage.aggregate({
      where: { role: "assistant", createdAt: { gte: since }, latencyMs: { not: null } },
      _avg: { latencyMs: true },
    }),
    prisma.$queryRaw<Array<{ avg_turns: number | null }>>`
      SELECT AVG(turns)::float AS avg_turns
      FROM (
        SELECT COUNT(*) FILTER (WHERE m.role = 'user') AS turns
        FROM totem_conversations c
        JOIN totem_messages m ON m.conversation_id = c.id
        WHERE c.started_at >= ${since}
        GROUP BY c.id
      ) t
    `,
    prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT date_trunc('day', started_at AT TIME ZONE 'UTC') AS day, COUNT(*)::bigint AS count
      FROM totem_conversations
      WHERE started_at >= ${since}
      GROUP BY 1 ORDER BY 1
    `,
    prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT date_trunc('day', created_at AT TIME ZONE 'UTC') AS day, COUNT(*)::bigint AS count
      FROM totem_messages
      WHERE role = 'user' AND created_at >= ${since}
      GROUP BY 1 ORDER BY 1
    `,
    prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT date_trunc('day', created_at AT TIME ZONE 'UTC') AS day, COUNT(*)::bigint AS count
      FROM totem_messages
      WHERE role = 'assistant' AND created_at >= ${since}
      GROUP BY 1 ORDER BY 1
    `,
    prisma.$queryRaw<Array<{ day: Date; rating: string; count: bigint }>>`
      SELECT date_trunc('day', created_at AT TIME ZONE 'UTC') AS day, rating, COUNT(*)::bigint AS count
      FROM totem_feedback
      WHERE created_at >= ${since}
      GROUP BY 1, 2 ORDER BY 1
    `,
    prisma.totemMessage.findMany({
      where: {
        role: "assistant",
        createdAt: { gte: since },
      },
      select: { toolCalls: true },
      take: 5000,
      orderBy: { createdAt: "desc" },
    }),
    prisma.totemMessage.groupBy({
      by: ["modelUsed"],
      where: { role: "assistant", createdAt: { gte: since }, modelUsed: { not: null } },
      _count: true,
    }),
    // Token sums per model — folded through the per-model pricing map for
    // the « Coût estimé » tile.
    prisma.totemMessage.groupBy({
      by: ["modelUsed"],
      where: { role: "assistant", createdAt: { gte: since } },
      _sum: { inputTokens: true, outputTokens: true, cachedInputTokens: true },
    }),
    prisma.totemConversation.groupBy({
      by: ["sourcePage"],
      where: { startedAt: { gte: since }, sourcePage: { not: null } },
      _count: true,
      orderBy: { _count: { sourcePage: "desc" } },
      take: 12,
    }),
    prisma.$queryRaw<Array<{ media_id: string; count: bigint }>>`
      SELECT unnest(cited_media_ids) AS media_id, COUNT(*)::bigint AS count
      FROM totem_messages
      WHERE created_at >= ${since}
        AND cited_media_ids IS NOT NULL
        AND cardinality(cited_media_ids) > 0
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 10
    `,
    prisma.totemFeedback.findMany({
      where: { rating: "DOWN", createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        message: {
          select: {
            content: true,
            conversationId: true,
            conversation: {
              select: {
                user: { select: { email: true } },
              },
            },
          },
        },
      },
    }),
  ])

  const feedbackUp = feedbackGroups.find((g) => g.rating === "UP")?._count ?? 0
  const feedbackDown = feedbackGroups.find((g) => g.rating === "DOWN")?._count ?? 0
  const feedbackTotal = feedbackUp + feedbackDown
  const satisfactionPct =
    feedbackTotal > 0 ? Math.round((feedbackUp / feedbackTotal) * 1000) / 10 : null

  const toolMap = new Map<string, number>()
  for (const row of recentAssistantWithTools) {
    for (const name of extractToolNames(row.toolCalls)) {
      toolMap.set(name, (toolMap.get(name) ?? 0) + 1)
    }
  }
  const toolUsage = [...toolMap.entries()]
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count)

  const modelUsage: TotemModelUsageRow[] = modelGroups
    .filter((g) => g.modelUsed)
    .map((g) => ({ model: g.modelUsed!, count: g._count }))
    .sort((a, b) => b.count - a.count)

  const sonnetCount = modelUsage
    .filter((m) => m.model.toLowerCase().includes("sonnet"))
    .reduce((s, m) => s + m.count, 0)
  const modelTotal = modelUsage.reduce((s, m) => s + m.count, 0)
  const sonnetTurnPct =
    modelTotal > 0 ? Math.round((sonnetCount / modelTotal) * 1000) / 10 : null

  // Token totals + per-model cost estimate (null when no usage recorded).
  let inputTokens = 0
  let outputTokens = 0
  let cachedInputTokens = 0
  let estimatedCostUsd: number | null = null
  for (const g of tokenGroups) {
    const usage = {
      inputTokens: g._sum.inputTokens,
      outputTokens: g._sum.outputTokens,
      cachedInputTokens: g._sum.cachedInputTokens,
    }
    inputTokens += usage.inputTokens ?? 0
    outputTokens += usage.outputTokens ?? 0
    cachedInputTokens += usage.cachedInputTokens ?? 0
    const cost = estimateCostUsd(g.modelUsed, usage)
    if (cost != null) estimatedCostUsd = (estimatedCostUsd ?? 0) + cost
  }

  const convDayMap = new Map(
    convByDay.map((r) => [dayKey(new Date(r.day)), Number(r.count)]),
  )
  const userDayMap = new Map(
    userMsgByDay.map((r) => [dayKey(new Date(r.day)), Number(r.count)]),
  )
  const asstDayMap = new Map(
    asstMsgByDay.map((r) => [dayKey(new Date(r.day)), Number(r.count)]),
  )

  const dailyVolume = buildDailySeries(periodDays, (day) => ({
    day,
    conversations: convDayMap.get(day) ?? 0,
    userMessages: userDayMap.get(day) ?? 0,
    assistantMessages: asstDayMap.get(day) ?? 0,
  }))

  const fbByDay = new Map<string, { up: number; down: number }>()
  for (const row of feedbackByDay) {
    const k = dayKey(new Date(row.day))
    const cur = fbByDay.get(k) ?? { up: 0, down: 0 }
    if (row.rating === "UP") cur.up += Number(row.count)
    else if (row.rating === "DOWN") cur.down += Number(row.count)
    fbByDay.set(k, cur)
  }
  const dailyFeedback = buildDailySeries(periodDays, (day) => {
    const v = fbByDay.get(day) ?? { up: 0, down: 0 }
    return { day, up: v.up, down: v.down }
  })

  const mediaIds = citedRows.map((r) => r.media_id)
  const mediaTitles =
    mediaIds.length > 0
      ? await prisma.mediaItem.findMany({
          where: { id: { in: mediaIds } },
          select: { id: true, title: true, type: true },
        })
      : []
  const mediaMap = new Map(mediaTitles.map((m) => [m.id, m]))

  const topCitedMedia: TotemCitedMediaRow[] = citedRows.map((r) => {
    const m = mediaMap.get(r.media_id)
    return {
      mediaId: r.media_id,
      title: m?.title ?? r.media_id.slice(0, 8) + "…",
      type: m?.type ?? "?",
      count: Number(r.count),
    }
  })

  return {
    periodDays,
    generatedAt: new Date().toISOString(),
    totals: {
      conversations,
      userMessages,
      assistantMessages,
      authenticatedUsers: authUsers.length,
      anonymousSessions: anonSessions.length,
      feedbackUp,
      feedbackDown,
      satisfactionPct,
      avgLatencyMs: latencyAgg._avg.latencyMs
        ? Math.round(latencyAgg._avg.latencyMs)
        : null,
      avgUserTurnsPerConversation: turnAgg[0]?.avg_turns
        ? Math.round(turnAgg[0].avg_turns * 10) / 10
        : null,
      sonnetTurnPct,
      inputTokens,
      outputTokens,
      cachedInputTokens,
      estimatedCostUsd,
    },
    wow: {
      conversations,
      userMessages,
      prevConversations,
      prevUserMessages,
    },
    dailyVolume,
    dailyFeedback,
    toolUsage,
    modelUsage,
    topSourcePages: sourcePageGroups
      .filter((g) => g.sourcePage)
      .map((g) => ({ path: g.sourcePage!, count: g._count })),
    topCitedMedia,
    recentNegativeFeedback: recentDown.map((f) => ({
      id: f.id,
      rating: f.rating,
      reason: f.reason,
      createdAt: f.createdAt.toISOString(),
      messagePreview: f.message.content.slice(0, 160),
      conversationId: f.message.conversationId,
      userEmail: f.message.conversation.user?.email ?? null,
    })),
  }
}

function previewText(content: string | undefined, max = 80): string {
  if (!content) return "—"
  const t = content.trim().replace(/\s+/g, " ")
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`
}

export async function fetchTotemConversationList(opts: {
  page?: number
  pageSize?: number
  q?: string
  onlyDown?: boolean
  days?: number
}): Promise<TotemConversationListResult> {
  const page = Math.max(1, opts.page ?? 1)
  const pageSize = Math.min(50, Math.max(10, opts.pageSize ?? 20))
  const skip = (page - 1) * pageSize
  const since = opts.days ? sinceDays(opts.days) : undefined

  const whereBase: { startedAt?: { gte: Date } } = {}
  if (since) whereBase.startedAt = { gte: since }

  let conversationIdsFilter: string[] | undefined
  if (opts.q?.trim()) {
    const q = opts.q.trim()
    const hits = await prisma.totemMessage.findMany({
      where: {
        content: { contains: q, mode: "insensitive" },
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      select: { conversationId: true },
      distinct: ["conversationId"],
      take: 200,
    })
    conversationIdsFilter = hits.map((h) => h.conversationId)
    if (conversationIdsFilter.length === 0) {
      return { conversations: [], total: 0, page, pageSize }
    }
  }

  if (opts.onlyDown) {
    const downConvIds = await prisma.totemFeedback.findMany({
      where: {
        rating: "DOWN",
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      select: {
        message: { select: { conversationId: true } },
      },
      distinct: ["messageId"],
      take: 500,
    })
    const ids = [...new Set(downConvIds.map((d) => d.message.conversationId))]
    conversationIdsFilter = conversationIdsFilter
      ? conversationIdsFilter.filter((id) => ids.includes(id))
      : ids
    if (conversationIdsFilter.length === 0) {
      return { conversations: [], total: 0, page, pageSize }
    }
  }

  const where = {
    ...whereBase,
    ...(conversationIdsFilter ? { id: { in: conversationIdsFilter } } : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.totemConversation.count({ where }),
    prisma.totemConversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        startedAt: true,
        lastMessageAt: true,
        sourcePage: true,
        userId: true,
        user: { select: { email: true, name: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            role: true,
            content: true,
            modelUsed: true,
            latencyMs: true,
            feedback: { select: { rating: true } },
          },
        },
      },
    }),
  ])

  const conversations: TotemConversationListItem[] = rows.map((c) => {
    const userTurns = c.messages.filter((m) => m.role === "user").length
    const firstUser = c.messages.find((m) => m.role === "user")
    const assistantMsgs = c.messages.filter((m) => m.role === "assistant")
    const lastAsst = assistantMsgs[assistantMsgs.length - 1]
    const latencies = assistantMsgs
      .map((m) => m.latencyMs)
      .filter((v): v is number => v != null)
    const avgLatencyMs =
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null
    let feedbackUp = 0
    let feedbackDown = 0
    for (const m of c.messages) {
      for (const f of m.feedback) {
        if (f.rating === "UP") feedbackUp++
        else if (f.rating === "DOWN") feedbackDown++
      }
    }
    return {
      id: c.id,
      startedAt: c.startedAt.toISOString(),
      lastMessageAt: c.lastMessageAt.toISOString(),
      sourcePage: c.sourcePage,
      userEmail: c.user?.email ?? null,
      userName: c.user?.name ?? null,
      isAnonymous: !c.userId,
      userTurns,
      messageCount: c.messages.length,
      feedbackDown,
      feedbackUp,
      preview: previewText(firstUser?.content),
      lastModel: lastAsst?.modelUsed ?? null,
      avgLatencyMs,
    }
  })

  return { conversations, total, page, pageSize }
}

export async function fetchTotemConversationDetail(
  id: string,
): Promise<TotemConversationDetail | null> {
  const c = await prisma.totemConversation.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          feedback: {
            select: { id: true, rating: true, reason: true, createdAt: true },
          },
        },
      },
    },
  })
  if (!c) return null

  return {
    id: c.id,
    startedAt: c.startedAt.toISOString(),
    lastMessageAt: c.lastMessageAt.toISOString(),
    sourcePage: c.sourcePage,
    user: c.user,
    sessionId: c.sessionId,
    familyMemberContext: c.familyMemberContext,
    messages: c.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      modelUsed: m.modelUsed,
      latencyMs: m.latencyMs,
      inputTokens: m.inputTokens,
      outputTokens: m.outputTokens,
      cachedInputTokens: m.cachedInputTokens,
      estimatedCostUsd: estimateCostUsd(m.modelUsed, {
        inputTokens: m.inputTokens,
        outputTokens: m.outputTokens,
        cachedInputTokens: m.cachedInputTokens,
      }),
      citedMediaIds: m.citedMediaIds,
      toolCalls: m.toolCalls,
      toolResults: m.toolResults,
      feedback: m.feedback.map((f) => ({
        id: f.id,
        rating: f.rating,
        reason: f.reason,
        createdAt: f.createdAt.toISOString(),
      })),
    })),
  }
}
