import { describe, expect, it } from "vitest"
import {
  AUTONOMY_LEVELS,
  decideDisposition,
  graduationHint,
  parseMinConfidence,
} from "@/lib/agent-ledger/policy"
import { estimateLlmCostUsd, fromAnthropicUsage, fromOpenAiUsage } from "@/lib/llm-pricing"
import { summarizeUsage } from "@/lib/agent-ledger/ledger"
import { TOTEM_MODEL_PRICING } from "@/lib/totem/cost"

describe("decideDisposition", () => {
  it("never writes in observation or suggest mode, whatever the confidence", () => {
    for (const confidence of [null, 0, 0.5, 1]) {
      expect(decideDisposition({ level: "shadow", minConfidence: null, confidence })).toBe("shadow")
      expect(decideDisposition({ level: "suggest", minConfidence: null, confidence })).toBe("queue")
      expect(decideDisposition({ level: "suggest", minConfidence: 0, confidence })).toBe("queue")
    }
  })

  it("act_report without a floor writes and asks for review", () => {
    expect(decideDisposition({ level: "act_report", minConfidence: null, confidence: null })).toBe("apply_report")
  })

  it("autonomous without a floor writes silently", () => {
    expect(decideDisposition({ level: "autonomous", minConfidence: null, confidence: null })).toBe("apply")
  })

  it("a confidence floor sends unsure — and unscored — actions back to the queue", () => {
    for (const level of ["act_report", "autonomous"] as const) {
      expect(decideDisposition({ level, minConfidence: 0.9, confidence: 0.89 })).toBe("queue")
      // No score while a floor is set: the agent can't prove it clears it.
      expect(decideDisposition({ level, minConfidence: 0.9, confidence: null })).toBe("queue")
    }
    expect(decideDisposition({ level: "act_report", minConfidence: 0.9, confidence: 0.9 })).toBe("apply_report")
    expect(decideDisposition({ level: "autonomous", minConfidence: 0.9, confidence: 0.97 })).toBe("apply")
  })

  it("covers every level", () => {
    for (const level of AUTONOMY_LEVELS) {
      expect(decideDisposition({ level, minConfidence: null, confidence: null })).toBeTruthy()
    }
  })
})

describe("parseMinConfidence", () => {
  it("accepts 0..1 and empty", () => {
    expect(parseMinConfidence(null)).toBeNull()
    expect(parseMinConfidence("")).toBeNull()
    expect(parseMinConfidence(0)).toBe(0)
    expect(parseMinConfidence("0.85")).toBe(0.85)
    expect(parseMinConfidence(1)).toBe(1)
  })
  it("rejects anything else rather than guessing", () => {
    expect(parseMinConfidence(85)).toBe("invalid")
    expect(parseMinConfidence(-0.1)).toBe("invalid")
    expect(parseMinConfidence("abc")).toBe("invalid")
    expect(parseMinConfidence(NaN)).toBe("invalid")
  })
})

describe("graduationHint", () => {
  const clean = { approved: 10, acknowledged: 0, rejected: 0, reverted: 0 }

  it("suggests one step up after 10 clean human verdicts", () => {
    expect(graduationHint("suggest", clean)).toMatch(/Agir et signaler/)
    expect(graduationHint("act_report", { ...clean, approved: 0, acknowledged: 12 })).toMatch(/Autonome/)
  })

  it("stays silent below the bar or after any refusal", () => {
    expect(graduationHint("suggest", { ...clean, approved: 9 })).toBeNull()
    expect(graduationHint("suggest", { ...clean, rejected: 1 })).toBeNull()
    expect(graduationHint("autonomous", clean)).toBeNull()
    expect(graduationHint("shadow", clean)).toBeNull()
  })

  it("suggests stepping down when more than 20% of verdicts undo the agent", () => {
    const shaky = { approved: 0, acknowledged: 3, rejected: 0, reverted: 2 }
    expect(graduationHint("act_report", shaky)).toMatch(/redescendre/)
    expect(graduationHint("autonomous", shaky)).toMatch(/redescendre/)
    // Already at « Proposer »: nothing lower to suggest.
    expect(graduationHint("suggest", shaky)).toBeNull()
  })
})

describe("llm pricing", () => {
  it("splits OpenAI cached prompt tokens out of input", () => {
    expect(
      fromOpenAiUsage({ prompt_tokens: 1000, completion_tokens: 200, prompt_tokens_details: { cached_tokens: 400 } }),
    ).toEqual({ inputTokens: 600, outputTokens: 200, cachedInputTokens: 400 })
    expect(fromOpenAiUsage(undefined)).toEqual({ inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 })
  })

  it("reads Anthropic usage with cache reads separated", () => {
    expect(
      fromAnthropicUsage({ input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 900, cache_creation_input_tokens: 10 }),
    ).toEqual({ inputTokens: 110, outputTokens: 50, cachedInputTokens: 900 })
  })

  it("prices a known model and refuses to guess an unknown one", () => {
    expect(estimateLlmCostUsd("gpt-5-mini", { inputTokens: 1_000_000, outputTokens: 1_000_000, cachedInputTokens: 0 })).toBeCloseTo(2.25)
    expect(estimateLlmCostUsd("mystery-model", { inputTokens: 1, outputTokens: 1, cachedInputTokens: 0 })).toBeNull()
  })

  it("an unpriced model makes the whole run not measurable (null, never 0)", () => {
    const one = { calls: 1, inputTokens: 1000, outputTokens: 100, cachedInputTokens: 0 }
    expect(summarizeUsage({ "gpt-5-mini": one }).costUsd).toBeGreaterThan(0)
    expect(summarizeUsage({ "gpt-5-mini": one, "mystery-model": one }).costUsd).toBeNull()
    expect(summarizeUsage({}).costUsd).toBe(0)
  })

  it("keeps the Totem prices unchanged", () => {
    expect(TOTEM_MODEL_PRICING["claude-haiku-4-5-20251001"]).toEqual({ inputPerMTok: 1, outputPerMTok: 5, cachedInputPerMTok: 0.1 })
    expect(TOTEM_MODEL_PRICING["claude-sonnet-4-6"]).toEqual({ inputPerMTok: 3, outputPerMTok: 15, cachedInputPerMTok: 0.3 })
  })
})
