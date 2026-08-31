/**
 * Persistence for /decouverte resolutions: cost telemetry, cap counter and
 * parse cache in one table (see prisma/migrations/manual/011_nl_search.sql).
 *
 * Every write is best-effort — a telemetry failure must never take down a
 * search. The cache is what makes a shared or re-typed question free: the same
 * normalized query within CACHE_TTL_DAYS reuses the stored interpretation
 * instead of paying for a new one.
 */
import { createHash } from "crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { validateNlIntent } from "./validate"
import { buildPlan, type NlPlan } from "./blocks"
import type { NlIntent, NlResolutionStatus } from "./types"

const CACHE_TTL_DAYS = 7
/** Raw query text can contain what people type about their children, so rows
 *  are not kept forever: pruned opportunistically past this age. Aggregate
 *  cost dashboards only ever look at recent windows. */
const RETENTION_DAYS = 90
/** Roughly one prune per N writes — enough to keep the table bounded without
 *  adding a cron, cheap enough to ride on a request. */
const PRUNE_EVERY = 50

/** Normalized cache key: case/accent/whitespace-insensitive. */
export function hashQuery(query: string): string {
  const normalized = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return createHash("sha256").update(normalized).digest("hex")
}

export interface RecordNlSearchInput {
  query: string
  queryHash: string
  status: NlResolutionStatus
  userId: string | null
  intent?: NlIntent | null
  plan?: NlPlan | null
  model?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  latencyMs?: number | null
}

/**
 * Stored cache payload. The plan travels WITH the intent so that a chip edit —
 * which resolves from URL params and never calls the model — can still rebuild
 * the same composed board instead of collapsing to the default layout.
 */
interface CachedPayload {
  intent: NlIntent
  plan: NlPlan
}

export async function recordNlSearch(input: RecordNlSearchInput): Promise<void> {
  try {
    const payload: CachedPayload | undefined = input.intent
      ? { intent: input.intent, plan: input.plan ?? [] }
      : undefined

    await prisma.nlSearchQuery.create({
      data: {
        query: input.query.slice(0, 500),
        queryHash: input.queryHash,
        status: input.status,
        userId: input.userId,
        intent: payload ? (payload as unknown as object) : undefined,
        model: input.model ?? null,
        inputTokens: input.inputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
        latencyMs: input.latencyMs ?? null,
      },
    })
  } catch (error) {
    console.error("[nl-search] telemetry write failed:", error)
  }

  // Fire-and-forget retention sweep: personal-ish text ages out by itself.
  if (Math.floor(Math.random() * PRUNE_EVERY) === 0) {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
    prisma.nlSearchQuery
      .deleteMany({ where: { createdAt: { lt: cutoff } } })
      .catch(() => {
        // A missed sweep is caught by a later one.
      })
  }
}

/**
 * Most recent stored interpretation + plan for this query, if still fresh.
 * Returns null on a miss or any error — the caller then parses normally.
 */
export async function findCachedParse(
  queryHash: string,
): Promise<{ intent: NlIntent; plan: NlPlan } | null> {
  try {
    const since = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000)
    const row = await prisma.nlSearchQuery.findFirst({
      where: {
        queryHash,
        status: { in: ["llm", "cache"] },
        intent: { not: Prisma.DbNull },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      select: { intent: true },
    })
    if (!row?.intent) return null

    // Rows written before boards existed hold a bare intent; newer ones hold
    // { intent, plan }. Detect by shape rather than by date so neither needs a
    // migration.
    const stored = row.intent as Record<string, unknown>
    const isWrapped = stored !== null && typeof stored === "object" && "intent" in stored

    // Re-validated on read: a cached row is still untrusted input (it may
    // predate a vocabulary change), so it goes through the same clamps — and
    // the plan goes back through the director for the same reason.
    const intent = validateNlIntent(isWrapped ? stored.intent : stored)
    const plan = buildPlan(isWrapped ? stored.plan : null, intent)
    return { intent, plan }
  } catch (error) {
    console.error("[nl-search] parse-cache lookup failed:", error)
    return null
  }
}
