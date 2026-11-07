/**
 * Totem Assistant cost model — one module for the generation cap, the admin
 * dashboard's cost estimate and the evaluation bench, so they can never drift
 * apart.
 *
 * Pricing is an ESTIMATION: per-MTok USD list prices, hardcoded because the
 * provider does not expose billing via API. Re-check periodically. Never
 * surface provider names in user-facing UI (CLAUDE.md rule) — the admin
 * dashboard labels this « estimation » only.
 */

/**
 * Per-step output cap passed to streamText. With the tool loop capped at 6
 * steps, worst case per user turn is 6 × this. Assistant answers are short
 * conversational French plus tool cards — 1500 is roomy, not generous.
 */
export const TOTEM_MAX_OUTPUT_TOKENS = 1500

/** Prompt-cache READS are billed at 0.1× the input price. */
export const CACHE_READ_MULTIPLIER = 0.1
/** Prompt-cache WRITES (5-minute ephemeral cache) are billed at 1.25×. */
export const CACHE_WRITE_MULTIPLIER = 1.25

export interface TotemModelPricing {
  inputPerMTok: number
  outputPerMTok: number
}

/**
 * List prices (USD / million tokens). The 5.5 generation prices are for
 * prompts under 100K tokens, which every Totem turn is.
 */
export const TOTEM_MODEL_PRICING: Record<string, TotemModelPricing> = {
  "claude-haiku-4-5-20251001": { inputPerMTok: 1, outputPerMTok: 5 },
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5 },
  "claude-sonnet-4-6": { inputPerMTok: 3, outputPerMTok: 15 },
  "claude-haiku-5-5": { inputPerMTok: 0.1, outputPerMTok: 0.5 },
  "claude-sonnet-5-5": { inputPerMTok: 2, outputPerMTok: 10 },
}

export interface TotemUsageLike {
  /** Total input (uncached + cache reads + cache writes), AI SDK 6 meaning. */
  inputTokens: number | null
  outputTokens: number | null
  /** Cache reads. */
  cachedInputTokens: number | null
  /** Uncached input — null on rows written before 2026-11. */
  uncachedInputTokens?: number | null
  /** Cache writes — null on rows written before 2026-11. */
  cacheWriteInputTokens?: number | null
}

/**
 * Splits a usage row into the three billed input buckets.
 *
 * Rows written before the split was stored (2026-11) only have the total and
 * the cache reads; for them, total − reads is billed as uncached input (the
 * cache writes hidden inside are priced at 1× instead of 1.25×, a slight
 * under-estimate). This replaces the previous formula, which billed the
 * TOTAL at 1× and then the cache reads a second time.
 */
export function splitInputTokens(usage: TotemUsageLike): {
  uncached: number
  cacheRead: number
  cacheWrite: number
} {
  const cacheRead = usage.cachedInputTokens ?? 0
  if (usage.uncachedInputTokens != null || usage.cacheWriteInputTokens != null) {
    return {
      uncached: usage.uncachedInputTokens ?? 0,
      cacheRead,
      cacheWrite: usage.cacheWriteInputTokens ?? 0,
    }
  }
  return {
    uncached: Math.max(0, (usage.inputTokens ?? 0) - cacheRead),
    cacheRead,
    cacheWrite: 0,
  }
}

/**
 * Estimated USD cost of one assistant message (or of a sum of them). Returns
 * null when the model is unknown or no usage was recorded — callers must
 * treat null as "not measurable", never as 0.
 */
export function estimateCostUsd(model: string | null, usage: TotemUsageLike): number | null {
  if (!model) return null
  const pricing = TOTEM_MODEL_PRICING[model]
  if (!pricing) return null
  if (
    usage.inputTokens == null &&
    usage.outputTokens == null &&
    usage.cachedInputTokens == null &&
    usage.uncachedInputTokens == null &&
    usage.cacheWriteInputTokens == null
  ) {
    return null
  }
  const { uncached, cacheRead, cacheWrite } = splitInputTokens(usage)
  return (
    (uncached * pricing.inputPerMTok +
      cacheRead * pricing.inputPerMTok * CACHE_READ_MULTIPLIER +
      cacheWrite * pricing.inputPerMTok * CACHE_WRITE_MULTIPLIER +
      (usage.outputTokens ?? 0) * pricing.outputPerMTok) /
    1_000_000
  )
}
