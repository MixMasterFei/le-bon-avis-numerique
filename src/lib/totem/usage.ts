import type { LanguageModelUsage } from "ai"

/**
 * Maps the AI SDK's usage object (streamText onFinish `totalUsage`, summed
 * across all tool-loop steps of the turn) to the columns persisted on
 * totem_messages. The SDK reports unknown counts as undefined or NaN —
 * both must become null (nullable columns), never 0, so the admin cost
 * estimate can distinguish "unmeasured" from "free".
 */
export interface TotemUsageRecord {
  inputTokens: number | null
  outputTokens: number | null
  cachedInputTokens: number | null
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
    cachedInputTokens: toCount(usage?.cachedInputTokens),
  }
}
