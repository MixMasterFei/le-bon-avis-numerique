import { prisma } from "@/lib/prisma"
import { toMediaRouteId } from "@/lib/media-route"
import {
  AUTONOMY_LABELS,
  graduationHint,
  isAutonomyLevel,
  type ActionTrackRecord,
  type AutonomyLevel,
} from "./policy"
import { ACTION_HANDLERS, AGENT_LABELS, getHandler } from "./registry"
import { expireStalePending } from "./ledger"

/** Window for the per-type track record and the cost table. */
export const TRACK_RECORD_DAYS = 90
export const COST_DAYS = 30

export interface LedgerActionView {
  id: string
  agent: string
  agentLabel: string
  actionType: string
  actionLabel: string
  fieldLabel: string
  status: string
  autonomy: string
  needsReview: boolean
  confidence: number | null
  targetType: string | null
  targetId: string | null
  targetLabel: string | null
  /** Public page of the target, when it has one. */
  targetHref: string | null
  rationale: string | null
  before: string | null
  after: string | null
  error: string | null
  decision: string | null
  createdAt: string
  decidedAt: string | null
}

export interface LedgerPolicyView {
  actionType: string
  actionLabel: string
  agentLabel: string
  level: AutonomyLevel
  levelLabel: string
  minConfidence: number | null
  isDefault: boolean
  trackRecord: ActionTrackRecord
  hint: string | null
}

export interface LedgerCostView {
  agent: string
  agentLabel: string
  runs: number
  llmCalls: number
  costUsd: number | null
  /** Runs whose cost couldn't be estimated (unpriced model). */
  unpricedRuns: number
  actionsProposed: number
  actionsApplied: number
  lastRunAt: string | null
}

export interface LedgerOverview {
  available: boolean
  pending: LedgerActionView[]
  toReview: LedgerActionView[]
  history: LedgerActionView[]
  policies: LedgerPolicyView[]
  costs: LedgerCostView[]
  totalCostUsd: number | null
}

type ActionRow = Awaited<ReturnType<typeof prisma.agentAction.findMany>>[number]

function toView(a: ActionRow, hrefs: Map<string, string>): LedgerActionView {
  const handler = getHandler(a.actionType)
  const diff = handler?.diff(a.payload, a.previous) ?? { before: null, after: null }
  return {
    id: a.id,
    agent: a.agent,
    agentLabel: AGENT_LABELS[a.agent] ?? a.agent,
    actionType: a.actionType,
    actionLabel: handler?.label ?? a.actionType,
    fieldLabel: handler?.fieldLabel ?? "Valeur",
    status: a.status,
    autonomy: a.autonomy,
    needsReview: a.needsReview,
    confidence: a.confidence,
    targetType: a.targetType,
    targetId: a.targetId,
    targetLabel: a.targetLabel,
    targetHref: a.targetType === "media" && a.targetId ? hrefs.get(a.targetId) ?? null : null,
    rationale: a.rationale,
    before: diff.before,
    after: diff.after,
    error: a.error,
    decision: a.decision,
    createdAt: a.createdAt.toISOString(),
    decidedAt: a.decidedAt?.toISOString() ?? null,
  }
}

const EMPTY_RECORD: ActionTrackRecord = { approved: 0, acknowledged: 0, rejected: 0, reverted: 0 }

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

export async function getLedgerOverview(): Promise<LedgerOverview> {
  try {
    // A proposal nobody decided on in 30 days is stale (the query it
    // answered has moved on). Expired = never applied.
    await expireStalePending()

    const [pending, toReview, history, policyRows, verdicts, costRows, unpriced] = await Promise.all([
      prisma.agentAction.findMany({ where: { status: "pending" }, orderBy: { createdAt: "asc" }, take: 100 }),
      prisma.agentAction.findMany({
        where: { status: "applied", needsReview: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.agentAction.findMany({
        where: { NOT: [{ status: "pending" }, { status: "applied", needsReview: true }] },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      prisma.agentAutonomy.findMany(),
      prisma.agentAction.groupBy({
        by: ["actionType", "decision"],
        where: { decision: { not: null }, decidedAt: { gte: daysAgo(TRACK_RECORD_DAYS) } },
        _count: { _all: true },
      }),
      prisma.agentRun.groupBy({
        by: ["agent"],
        where: { startedAt: { gte: daysAgo(COST_DAYS) } },
        _count: { _all: true },
        _sum: { llmCalls: true, costUsd: true, actionsProposed: true, actionsApplied: true },
        _max: { startedAt: true },
      }),
      prisma.agentRun.groupBy({
        by: ["agent"],
        where: { startedAt: { gte: daysAgo(COST_DAYS) }, costUsd: null, llmCalls: { gt: 0 } },
        _count: { _all: true },
      }),
    ])

    const records = new Map<string, ActionTrackRecord>()
    for (const v of verdicts) {
      const r = records.get(v.actionType) ?? { ...EMPTY_RECORD }
      const n = v._count._all
      if (v.decision === "approved") r.approved += n
      else if (v.decision === "acknowledged") r.acknowledged += n
      else if (v.decision === "rejected") r.rejected += n
      else if (v.decision === "reverted") r.reverted += n
      records.set(v.actionType, r)
    }

    const rowsByType = new Map(policyRows.map((r) => [r.actionType, r]))
    const policies: LedgerPolicyView[] = Object.values(ACTION_HANDLERS).map((h) => {
      const row = rowsByType.get(h.type)
      const level = row && isAutonomyLevel(row.level) ? row.level : h.defaultLevel
      const trackRecord = records.get(h.type) ?? { ...EMPTY_RECORD }
      return {
        actionType: h.type,
        actionLabel: h.label,
        agentLabel: AGENT_LABELS[h.agent] ?? h.agent,
        level,
        levelLabel: AUTONOMY_LABELS[level],
        minConfidence: row ? row.minConfidence : h.defaultMinConfidence,
        isDefault: !row,
        trackRecord,
        hint: graduationHint(level, trackRecord),
      }
    })

    const mediaIds = [...new Set(
      [...pending, ...toReview, ...history]
        .filter((a) => a.targetType === "media" && a.targetId)
        .map((a) => a.targetId as string),
    )]
    const mediaRows = mediaIds.length
      ? await prisma.mediaItem.findMany({ where: { id: { in: mediaIds } }, select: { id: true, type: true } })
      : []
    const hrefs = new Map(mediaRows.map((m) => [m.id, `/media/${toMediaRouteId(m.type, m.id)}`]))
    const view = (a: ActionRow) => toView(a, hrefs)

    const unpricedByAgent = new Map(unpriced.map((u) => [u.agent, u._count._all]))
    const costs: LedgerCostView[] = costRows
      .map((c) => ({
        agent: c.agent,
        agentLabel: AGENT_LABELS[c.agent] ?? c.agent,
        runs: c._count._all,
        llmCalls: c._sum.llmCalls ?? 0,
        costUsd: c._sum.costUsd ?? (c._sum.llmCalls ? null : 0),
        unpricedRuns: unpricedByAgent.get(c.agent) ?? 0,
        actionsProposed: c._sum.actionsProposed ?? 0,
        actionsApplied: c._sum.actionsApplied ?? 0,
        lastRunAt: c._max.startedAt?.toISOString() ?? null,
      }))
      .sort((a, b) => (b.costUsd ?? 0) - (a.costUsd ?? 0))

    return {
      available: true,
      pending: pending.map(view),
      toReview: toReview.map(view),
      history: history.map(view),
      policies,
      costs,
      totalCostUsd: costs.reduce<number | null>((s, c) => (s == null || c.costUsd == null ? s : s + c.costUsd), 0),
    }
  } catch (e) {
    console.warn("[agent-ledger] overview unavailable:", e instanceof Error ? e.message : e)
    // Before migration 015: show the defaults so the panel still explains
    // what each agent may do.
    return {
      available: false,
      pending: [],
      toReview: [],
      history: [],
      policies: Object.values(ACTION_HANDLERS).map((h) => ({
        actionType: h.type,
        actionLabel: h.label,
        agentLabel: AGENT_LABELS[h.agent] ?? h.agent,
        level: h.defaultLevel,
        levelLabel: AUTONOMY_LABELS[h.defaultLevel],
        minConfidence: h.defaultMinConfidence,
        isDefault: true,
        trackRecord: { ...EMPTY_RECORD },
        hint: null,
      })),
      costs: [],
      totalCostUsd: null,
    }
  }
}

/** Counts for badges (admin dashboard, digests). Never throws. */
export async function getLedgerCounts(): Promise<{ pending: number; toReview: number } | null> {
  try {
    const [pending, toReview] = await Promise.all([
      prisma.agentAction.count({ where: { status: "pending" } }),
      prisma.agentAction.count({ where: { status: "applied", needsReview: true } }),
    ])
    return { pending, toReview }
  } catch {
    return null
  }
}
