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
import type { NlIntent, NlResolutionStatus } from "./types"

const CACHE_TTL_DAYS = 7

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
  model?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  latencyMs?: number | null
}

export async function recordNlSearch(input: RecordNlSearchInput): Promise<void> {
  try {
    await prisma.nlSearchQuery.create({
      data: {
        query: input.query.slice(0, 500),
        queryHash: input.queryHash,
        status: input.status,
        userId: input.userId,
        intent: input.intent ? (input.intent as unknown as object) : undefined,
        model: input.model ?? null,
        inputTokens: input.inputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
        latencyMs: input.latencyMs ?? null,
      },
    })
  } catch (error) {
    console.error("[nl-search] telemetry write failed:", error)
  }
}

/**
 * Most recent stored interpretation for this query, if it is still fresh.
 * Returns null on a miss or any error — the caller then parses normally.
 */
export async function findCachedParse(queryHash: string): Promise<NlIntent | null> {
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
    // Re-validated on read: a cached row is still untrusted input (it may
    // predate a vocabulary change), so it goes through the same clamps.
    return validateNlIntent(row.intent)
  } catch (error) {
    console.error("[nl-search] parse-cache lookup failed:", error)
    return null
  }
}
