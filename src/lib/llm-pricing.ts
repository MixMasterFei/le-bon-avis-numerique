/**
 * LLM list prices, one table for every cost estimate in the codebase (Totem
 * Assistant dashboard, agent ledger). USD per million tokens, hardcoded
 * because no provider exposes billing over an API: re-check periodically.
 *
 * These are ESTIMATIONS. Admin surfaces must label them « estimation » and
 * never show provider names to end users (CLAUDE.md rule).
 *
 * Token convention, used by `estimateLlmCostUsd`: `inputTokens` counts
 * UNCACHED input only; cache reads go in `cachedInputTokens`. Anthropic's
 * usage already reports it that way; OpenAI's `prompt_tokens` includes the
 * cached part, so go through `fromOpenAiUsage`.
 */

export interface LlmModelPricing {
  inputPerMTok: number
  outputPerMTok: number
  /** Prompt-cache READ price. */
  cachedInputPerMTok: number
}

export const LLM_PRICING: Record<string, LlmModelPricing> = {
  // Anthropic
  "claude-haiku-4-5-20251001": { inputPerMTok: 1, outputPerMTok: 5, cachedInputPerMTok: 0.1 },
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5, cachedInputPerMTok: 0.1 },
  "claude-sonnet-4-6": { inputPerMTok: 3, outputPerMTok: 15, cachedInputPerMTok: 0.3 },
  "claude-opus-4-7": { inputPerMTok: 5, outputPerMTok: 25, cachedInputPerMTok: 0.5 },
  // OpenAI
  "gpt-5-mini": { inputPerMTok: 0.25, outputPerMTok: 2, cachedInputPerMTok: 0.025 },
  "gpt-4o-mini": { inputPerMTok: 0.15, outputPerMTok: 0.6, cachedInputPerMTok: 0.075 },
  "gpt-4o": { inputPerMTok: 2.5, outputPerMTok: 10, cachedInputPerMTok: 1.25 },
}

export interface LlmUsage {
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
}

/** null = unknown model, i.e. "not measurable" — callers must never treat it as 0. */
export function estimateLlmCostUsd(model: string, usage: LlmUsage): number | null {
  const pricing = LLM_PRICING[model]
  if (!pricing) return null
  return (
    (usage.inputTokens * pricing.inputPerMTok +
      usage.outputTokens * pricing.outputPerMTok +
      usage.cachedInputTokens * pricing.cachedInputPerMTok) /
    1_000_000
  )
}

function count(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0
}

/** OpenAI chat-completions `usage` → our convention (cached part split out). */
export function fromOpenAiUsage(usage: unknown): LlmUsage {
  const u = (usage ?? {}) as {
    prompt_tokens?: number
    completion_tokens?: number
    prompt_tokens_details?: { cached_tokens?: number } | null
  }
  const prompt = count(u.prompt_tokens)
  const cached = Math.min(count(u.prompt_tokens_details?.cached_tokens), prompt)
  return { inputTokens: prompt - cached, outputTokens: count(u.completion_tokens), cachedInputTokens: cached }
}

/** Anthropic messages `usage` → our convention (already split). */
export function fromAnthropicUsage(usage: unknown): LlmUsage {
  const u = (usage ?? {}) as {
    input_tokens?: number
    output_tokens?: number
    cache_read_input_tokens?: number | null
    cache_creation_input_tokens?: number | null
  }
  return {
    // Cache WRITES bill at ≥ input price; counting them as plain input keeps
    // the estimate a slight under-count rather than a guess.
    inputTokens: count(u.input_tokens) + count(u.cache_creation_input_tokens),
    outputTokens: count(u.output_tokens),
    cachedInputTokens: count(u.cache_read_input_tokens),
  }
}
