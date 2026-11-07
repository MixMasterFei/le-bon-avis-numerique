import type { LanguageModelUsage } from "ai"

/**
 * Maps the AI SDK's usage object (streamText onFinish `totalUsage`, summed
 * across all tool-loop steps of the turn) to the columns persisted on
 * totem_messages.
 *
 * AI SDK 6 semantics (verified in ai 6.0.303 / @ai-sdk/anthropic 3.0.129):
 * `inputTokens` is the TOTAL input — uncached + cache reads + cache writes —
 * and `inputTokenDetails` carries the split. The three parts are billed at
 * 1×, 0.1× and 1.25× the input price, so they are stored separately:
 *
 *   input_tokens               total input (unchanged column meaning)
 *   cached_input_tokens        cache reads
 *   uncached_input_tokens      uncached input      (added 2026-11)
 *   cache_write_input_tokens   cache writes        (added 2026-11)
 *
 * Unknown counts (undefined or NaN) become null — "unmeasured", never 0 — so
 * the admin cost estimate can tell "unmeasured" from "free".
 */
export interface TotemUsageRecord {
  inputTokens: number | null
  outputTokens: number | null
  cachedInputTokens: number | null
  uncachedInputTokens: number | null
  cacheWriteInputTokens: number | null
}

function toCount(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null
}

export function extractUsage(usage: LanguageModelUsage | undefined): TotemUsageRecord {
  return {
    inputTokens: toCount(usage?.inputTokens),
    outputTokens: toCount(usage?.outputTokens),
    cachedInputTokens: toCount(usage?.inputTokenDetails?.cacheReadTokens),
    uncachedInputTokens: toCount(usage?.inputTokenDetails?.noCacheTokens),
    cacheWriteInputTokens: toCount(usage?.inputTokenDetails?.cacheWriteTokens),
  }
}

/** Adds two usage records (null + null stays null; null + n = n). */
export function addUsage(a: TotemUsageRecord, b: TotemUsageRecord): TotemUsageRecord {
  const add = (x: number | null, y: number | null) => (x == null && y == null ? null : (x ?? 0) + (y ?? 0))
  return {
    inputTokens: add(a.inputTokens, b.inputTokens),
    outputTokens: add(a.outputTokens, b.outputTokens),
    cachedInputTokens: add(a.cachedInputTokens, b.cachedInputTokens),
    uncachedInputTokens: add(a.uncachedInputTokens, b.uncachedInputTokens),
    cacheWriteInputTokens: add(a.cacheWriteInputTokens, b.cacheWriteInputTokens),
  }
}

export const EMPTY_USAGE: TotemUsageRecord = {
  inputTokens: null,
  outputTokens: null,
  cachedInputTokens: null,
  uncachedInputTokens: null,
  cacheWriteInputTokens: null,
}
