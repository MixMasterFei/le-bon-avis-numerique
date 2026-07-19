/**
 * Totem Assistant cost model — one module for both the generation cap and
 * the admin dashboard's cost estimate, so they can never drift apart.
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

export interface TotemModelPricing {
  inputPerMTok: number
  outputPerMTok: number
  /** Prompt-cache READ price (≈ 0.1× input list price). */
  cachedInputPerMTok: number
}

export const TOTEM_MODEL_PRICING: Record<string, TotemModelPricing> = {
  "claude-haiku-4-5-20251001": { inputPerMTok: 1, outputPerMTok: 5, cachedInputPerMTok: 0.1 },
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5, cachedInputPerMTok: 0.1 },
  "claude-sonnet-4-6": { inputPerMTok: 3, outputPerMTok: 15, cachedInputPerMTok: 0.3 },
}

export interface TotemUsageLike {
  inputTokens: number | null
  outputTokens: number | null
  cachedInputTokens: number | null
}

/**
 * Estimated USD cost of one assistant message. Returns null when the model
 * is unknown or no usage was recorded (pre-migration rows) — callers must
 * treat null as "not measurable", never as 0.
 */
export function estimateCostUsd(model: string | null, usage: TotemUsageLike): number | null {
  if (!model) return null
  const pricing = TOTEM_MODEL_PRICING[model]
  if (!pricing) return null
  const { inputTokens, outputTokens, cachedInputTokens } = usage
  if (inputTokens == null && outputTokens == null && cachedInputTokens == null) return null
  return (
    ((inputTokens ?? 0) * pricing.inputPerMTok +
      (outputTokens ?? 0) * pricing.outputPerMTok +
      (cachedInputTokens ?? 0) * pricing.cachedInputPerMTok) /
    1_000_000
  )
}
