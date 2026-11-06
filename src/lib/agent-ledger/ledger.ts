import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { estimateLlmCostUsd, type LlmUsage } from "@/lib/llm-pricing"
import {
  decideDisposition,
  isAutonomyLevel,
  type AutonomyLevel,
} from "./policy"
import { AgentActionConflict, getHandler } from "./registry"

/**
 * Agent ledger — the one place an agent records what it did, how sure it was
 * and what it cost.
 *
 * Failure model (the ledger must never be the reason an agent breaks):
 *  - A ledger WRITE that fails (table missing before migration 015, DB blip)
 *    is logged and swallowed.
 *  - A policy READ that fails falls back to the registry default.
 *  - What fails CLOSED is the queue: if a proposal can't be stored, it is
 *    dropped, never applied — at « Proposer » the only path to the catalogue
 *    goes through a human.
 */

// ---------------------------------------------------------------------------
// Runs + cost
// ---------------------------------------------------------------------------

interface ModelUsage extends LlmUsage {
  calls: number
}

export interface AgentRunTracker {
  /** null when the run row couldn't be created (actions then carry no run id). */
  readonly id: string | null
  readonly agent: string
  recordUsage(model: string, usage: LlmUsage): void
  /** Called by proposeAgentAction; counts toward the run's actions columns. */
  noteAction(applied: boolean): void
  /** Totals so far — for the agent's own report. */
  totals(): { llmCalls: number; costUsd: number | null; actionsProposed: number; actionsApplied: number }
  finish(status: "success" | "partial" | "error", summary?: string): Promise<void>
}

export function summarizeUsage(byModel: Record<string, ModelUsage>) {
  let llmCalls = 0
  let inputTokens = 0
  let outputTokens = 0
  let cachedInputTokens = 0
  let costUsd: number | null = 0
  for (const [model, u] of Object.entries(byModel)) {
    llmCalls += u.calls
    inputTokens += u.inputTokens
    outputTokens += u.outputTokens
    cachedInputTokens += u.cachedInputTokens
    const c = estimateLlmCostUsd(model, u)
    // One unpriced model makes the whole run "not measurable".
    costUsd = c == null || costUsd == null ? null : costUsd + c
  }
  return { llmCalls, inputTokens, outputTokens, cachedInputTokens, costUsd }
}

/** A pending proposal with no decision for this long is expired (never applied). */
export const PENDING_TTL_DAYS = 30

/**
 * Expire stale proposals. Runs when an agent starts (so it may re-propose a
 * fiche whose old proposal nobody decided on — the one-pending-per-target
 * index would otherwise block it forever) and when the admin panel loads.
 */
export async function expireStalePending(): Promise<void> {
  try {
    await prisma.agentAction.updateMany({
      where: { status: "pending", createdAt: { lt: new Date(Date.now() - PENDING_TTL_DAYS * 86_400_000) } },
      data: { status: "expired" },
    })
  } catch {
    // ledger unavailable — nothing to expire
  }
}

export async function startAgentRun(agent: string): Promise<AgentRunTracker> {
  await expireStalePending()
  let id: string | null = null
  try {
    id = (await prisma.agentRun.create({ data: { agent }, select: { id: true } })).id
  } catch (e) {
    console.warn(`[agent-ledger] run not recorded for ${agent}:`, e instanceof Error ? e.message : e)
  }
  const byModel: Record<string, ModelUsage> = {}
  let actionsProposed = 0
  let actionsApplied = 0

  const tracker: AgentRunTracker = {
    id,
    agent,
    recordUsage(model, usage) {
      const m = (byModel[model] ??= { calls: 0, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 })
      m.calls += 1
      m.inputTokens += usage.inputTokens
      m.outputTokens += usage.outputTokens
      m.cachedInputTokens += usage.cachedInputTokens
    },
    totals() {
      const s = summarizeUsage(byModel)
      return { llmCalls: s.llmCalls, costUsd: s.costUsd, actionsProposed, actionsApplied }
    },
    noteAction(applied) {
      actionsProposed += 1
      if (applied) actionsApplied += 1
    },
    async finish(status, summary) {
      if (!id) return
      const s = summarizeUsage(byModel)
      try {
        await prisma.agentRun.update({
          where: { id },
          data: {
            status,
            summary: summary ?? null,
            llmCalls: s.llmCalls,
            inputTokens: s.inputTokens,
            outputTokens: s.outputTokens,
            cachedInputTokens: s.cachedInputTokens,
            costUsd: s.costUsd,
            usageByModel: byModel as unknown as Prisma.InputJsonValue,
            actionsProposed,
            actionsApplied,
            finishedAt: new Date(),
          },
        })
      } catch (e) {
        console.warn(`[agent-ledger] run ${id} not finalized:`, e instanceof Error ? e.message : e)
      }
    },
  }
  return tracker
}

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

export async function resolvePolicy(actionType: string): Promise<{ level: AutonomyLevel; minConfidence: number | null }> {
  const handler = getHandler(actionType)
  const fallback = {
    level: handler?.defaultLevel ?? "suggest",
    minConfidence: handler?.defaultMinConfidence ?? null,
  } as const
  try {
    const row = await prisma.agentAutonomy.findUnique({ where: { actionType } })
    if (row && isAutonomyLevel(row.level)) return { level: row.level, minConfidence: row.minConfidence }
  } catch {
    // table missing / DB blip → registry default
  }
  return fallback
}

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------

export type ProposalOutcome =
  | "applied" // written (act_report → in « À relire »; autonomous → history only)
  | "queued" // waiting in « À valider »
  | "already_pending" // the same type+target already waits for a decision
  | "shadowed" // observation mode: recorded, not written
  | "failed" // the write was refused (conflict) — nothing changed
  | "dropped" // couldn't be queued — NOT applied (fail closed)

export interface ProposalInput {
  run: AgentRunTracker | null
  actionType: string
  targetType: string
  targetId: string
  targetLabel: string
  /** Why the agent wants this, in French — shown to the human deciding. */
  rationale: string
  /** 0..1, only when the agent has a calibrated confidence. */
  confidence?: number | null
  payload: Record<string, unknown>
  /** Value before the write — what a revert restores. */
  previous: Record<string, unknown>
}

/** True when a proposal of this type already waits on this target (skip the LLM call). */
export async function hasPendingProposal(actionType: string, targetId: string): Promise<boolean> {
  try {
    return (await prisma.agentAction.count({ where: { actionType, targetId, status: "pending" } })) > 0
  } catch {
    return false
  }
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
}

async function record(data: Prisma.AgentActionUncheckedCreateInput): Promise<string | null> {
  try {
    return (await prisma.agentAction.create({ data, select: { id: true } })).id
  } catch (e) {
    if (isUniqueViolation(e)) throw e
    console.warn("[agent-ledger] action not recorded:", e instanceof Error ? e.message : e)
    return null
  }
}

export async function proposeAgentAction(input: ProposalInput): Promise<{ outcome: ProposalOutcome; actionId: string | null; error?: string }> {
  const handler = getHandler(input.actionType)
  if (!handler) {
    // A programming error, not a runtime condition: unregistered types must
    // never reach the catalogue.
    return { outcome: "dropped", actionId: null, error: `type d'action inconnu : ${input.actionType}` }
  }
  const confidence = input.confidence ?? null
  const policy = await resolvePolicy(input.actionType)
  const disposition = decideDisposition({ ...policy, confidence })
  const tracker = input.run

  const base = {
    runId: input.run?.id ?? null,
    agent: handler.agent,
    actionType: input.actionType,
    autonomy: policy.level,
    confidence,
    targetType: input.targetType,
    targetId: input.targetId,
    targetLabel: input.targetLabel,
    rationale: input.rationale,
    payload: input.payload as Prisma.InputJsonValue,
    previous: input.previous as Prisma.InputJsonValue,
  }

  if (disposition === "shadow") {
    tracker?.noteAction(false)
    const actionId = await record({ ...base, status: "shadow" })
    return { outcome: "shadowed", actionId }
  }

  if (disposition === "queue") {
    try {
      const actionId = await record({ ...base, status: "pending" })
      if (!actionId) return { outcome: "dropped", actionId: null, error: "file d'attente indisponible" }
      tracker?.noteAction(false)
      return { outcome: "queued", actionId }
    } catch (e) {
      if (isUniqueViolation(e)) return { outcome: "already_pending", actionId: null }
      return { outcome: "dropped", actionId: null, error: e instanceof Error ? e.message : String(e) }
    }
  }

  // apply / apply_report
  try {
    await handler.apply(input.targetId, input.payload, input.previous)
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    tracker?.noteAction(false)
    const actionId = await record({ ...base, status: "failed", error }).catch(() => null)
    return { outcome: "failed", actionId, error }
  }
  tracker?.noteAction(true)
  const actionId = await record({
    ...base,
    status: "applied",
    needsReview: disposition === "apply_report",
    appliedAt: new Date(),
  }).catch(() => null)
  return { outcome: "applied", actionId }
}

// ---------------------------------------------------------------------------
// Human decisions
// ---------------------------------------------------------------------------

export const HUMAN_DECISIONS = ["approve", "reject", "acknowledge", "revert"] as const
export type HumanDecision = (typeof HUMAN_DECISIONS)[number]

export function isHumanDecision(v: unknown): v is HumanDecision {
  return typeof v === "string" && (HUMAN_DECISIONS as readonly string[]).includes(v)
}

export class DecisionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

/**
 * Apply one human verdict. Each transition is claimed with a conditional
 * updateMany on the current status, so two admins clicking at once (or a
 * double click) can't apply the same action twice.
 */
export async function decideAgentAction(id: string, decision: HumanDecision, userId: string) {
  const action = await prisma.agentAction.findUnique({ where: { id } })
  if (!action) throw new DecisionError("Action introuvable.", 404)
  const handler = getHandler(action.actionType)
  if (!handler) throw new DecisionError("Type d'action non pris en charge.", 400)
  const now = new Date()
  const verdict = { decidedBy: userId, decidedAt: now }

  async function claim(where: Prisma.AgentActionWhereInput, data: Prisma.AgentActionUpdateManyMutationInput) {
    const res = await prisma.agentAction.updateMany({ where: { id, ...where }, data })
    if (res.count !== 1) throw new DecisionError("Cette action a déjà été traitée.", 409)
  }

  switch (decision) {
    case "approve": {
      // Claim first (pending → approved), then write; a failed write lands
      // the row in `failed` with the reason rather than back in the queue.
      await claim({ status: "pending" }, { status: "approved", decision: "approved", ...verdict })
      try {
        await handler.apply(action.targetId ?? "", action.payload, action.previous)
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e)
        await prisma.agentAction.update({ where: { id }, data: { status: "failed", error } })
        throw new DecisionError(error, e instanceof AgentActionConflict ? 409 : 500)
      }
      await prisma.agentAction.update({ where: { id }, data: { status: "applied", needsReview: false, appliedAt: now } })
      return { status: "applied" as const }
    }
    case "reject":
      await claim({ status: "pending" }, { status: "rejected", decision: "rejected", ...verdict })
      return { status: "rejected" as const }
    case "acknowledge":
      await claim({ status: "applied", needsReview: true }, { needsReview: false, decision: "acknowledged", ...verdict })
      return { status: "applied" as const }
    case "revert": {
      // Claim `applied` → `reverting` so a concurrent revert can't run twice.
      await claim({ status: "applied" }, { status: "reverting" })
      try {
        await handler.revert(action.targetId ?? "", action.payload, action.previous)
      } catch (e) {
        await prisma.agentAction.update({ where: { id }, data: { status: "applied" } })
        const error = e instanceof Error ? e.message : String(e)
        throw new DecisionError(error, e instanceof AgentActionConflict ? 409 : 500)
      }
      await prisma.agentAction.update({
        where: { id },
        data: { status: "reverted", needsReview: false, decision: "reverted", ...verdict },
      })
      return { status: "reverted" as const }
    }
  }
}

// ---------------------------------------------------------------------------
// Autonomy settings (admin)
// ---------------------------------------------------------------------------

export async function setAutonomy(actionType: string, level: AutonomyLevel, minConfidence: number | null, userId: string) {
  if (!getHandler(actionType)) throw new DecisionError("Type d'action inconnu.", 400)
  return prisma.agentAutonomy.upsert({
    where: { actionType },
    create: { actionType, level, minConfidence, updatedBy: userId },
    update: { level, minConfidence, updatedBy: userId },
  })
}
