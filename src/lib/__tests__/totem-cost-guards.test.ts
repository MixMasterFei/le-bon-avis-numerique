import { describe, expect, it } from "vitest"
import type { LanguageModelUsage } from "ai"
import { extractUsage } from "../totem/usage"
import { estimateCostUsd, splitInputTokens, TOTEM_MAX_OUTPUT_TOKENS } from "../totem/cost"
import {
  startOfUtcDay,
  secondsUntilNextUtcDay,
  getDailyCaps,
  TOTEM_DAILY_USER_CAP_DEFAULT,
  TOTEM_GLOBAL_DAILY_CAP_DEFAULT,
} from "../totem/daily-cap"

// The history bounds moved to the trusted server-side history (F07): see
// totem-history.test.ts and totem-chat-request.test.ts.

/** AI SDK 6 usage: inputTokens is the TOTAL (uncached + reads + writes). */
function sdkUsage(noCache: number, read: number, write: number, out: number): LanguageModelUsage {
  return {
    inputTokens: noCache + read + write,
    inputTokenDetails: { noCacheTokens: noCache, cacheReadTokens: read, cacheWriteTokens: write },
    outputTokens: out,
    outputTokenDetails: { textTokens: out, reasoningTokens: undefined },
    totalTokens: noCache + read + write + out,
  } as LanguageModelUsage
}

describe("extractUsage (token telemetry mapper)", () => {
  it("stores the total and the three billed input buckets", () => {
    expect(extractUsage(sdkUsage(200, 900, 100, 40))).toEqual({
      inputTokens: 1200,
      outputTokens: 40,
      cachedInputTokens: 900,
      uncachedInputTokens: 200,
      cacheWriteInputTokens: 100,
    })
  })

  it("turns undefined usage into all-null (unmeasured, not zero)", () => {
    expect(extractUsage(undefined)).toEqual({
      inputTokens: null,
      outputTokens: null,
      cachedInputTokens: null,
      uncachedInputTokens: null,
      cacheWriteInputTokens: null,
    })
  })

  it("turns NaN / negative / missing fields into null", () => {
    expect(
      extractUsage({ inputTokens: NaN, outputTokens: -5, totalTokens: NaN } as never),
    ).toEqual({
      inputTokens: null,
      outputTokens: null,
      cachedInputTokens: null,
      uncachedInputTokens: null,
      cacheWriteInputTokens: null,
    })
  })
})

describe("estimateCostUsd", () => {
  it("prices uncached, cache reads and cache writes at 1×, 0.1× and 1.25× (review #7)", () => {
    // Haiku 4.5: 0.2M × $1 + 0.9M × $0.1 + 0.1M × $1.25 + 1M out × $5
    expect(
      estimateCostUsd("claude-haiku-4-5-20251001", extractUsage(sdkUsage(200_000, 900_000, 100_000, 1_000_000))),
    ).toBeCloseTo(0.2 + 0.09 + 0.125 + 5, 6)
  })

  it("no longer bills cache reads twice on rows stored before the split", () => {
    // A legacy row: input_tokens is the SDK total, cached_input_tokens the
    // reads. Old formula: 1M × $1 + 0.6M × $0.1 = $1.06 (reads counted twice).
    const legacy = { inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 600_000 }
    expect(splitInputTokens(legacy)).toEqual({ uncached: 400_000, cacheRead: 600_000, cacheWrite: 0 })
    expect(estimateCostUsd("claude-haiku-4-5-20251001", legacy)).toBeCloseTo(0.4 + 0.06, 6)
  })

  it("matches the Director's measured profile: ~44k input (55 % reads) + 440 out ≈ 2.5 ¢ on Haiku 4.5", () => {
    const cost = estimateCostUsd("claude-haiku-4-5-20251001", extractUsage(sdkUsage(19_800, 24_200, 0, 440)))
    expect(cost).toBeCloseTo(0.0244, 4)
  })

  it("knows the current-generation models", () => {
    const usage = extractUsage(sdkUsage(1_000_000, 0, 0, 1_000_000))
    expect(estimateCostUsd("claude-haiku-5-5", usage)).toBeCloseTo(0.6, 6)
    expect(estimateCostUsd("claude-sonnet-5-5", usage)).toBeCloseTo(12, 6)
    expect(estimateCostUsd("claude-sonnet-4-6", usage)).toBeCloseTo(18, 6)
  })

  it("returns null for unknown models and unmeasured usage", () => {
    expect(
      estimateCostUsd("some-future-model", { inputTokens: 10, outputTokens: 10, cachedInputTokens: 0 }),
    ).toBeNull()
    expect(
      estimateCostUsd("claude-sonnet-4-6", { inputTokens: null, outputTokens: null, cachedInputTokens: null }),
    ).toBeNull()
    expect(estimateCostUsd(null, { inputTokens: 1, outputTokens: 1, cachedInputTokens: 0 })).toBeNull()
  })

  it("exports a bounded output cap", () => {
    expect(TOTEM_MAX_OUTPUT_TOKENS).toBeGreaterThan(0)
    expect(TOTEM_MAX_OUTPUT_TOKENS).toBeLessThanOrEqual(4000)
  })
})

describe("daily caps", () => {
  function withEnv<T>(key: string, value: string | undefined, fn: () => T): T {
    const prev = process.env[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
    try {
      return fn()
    } finally {
      if (prev === undefined) delete process.env[key]
      else process.env[key] = prev
    }
  }

  it("startOfUtcDay floors to UTC midnight", () => {
    const d = startOfUtcDay(new Date("2026-07-18T15:42:11.000Z"))
    expect(d.toISOString()).toBe("2026-07-18T00:00:00.000Z")
  })

  it("secondsUntilNextUtcDay counts down to the next midnight", () => {
    expect(secondsUntilNextUtcDay(new Date("2026-07-18T23:59:00.000Z"))).toBe(60)
    expect(secondsUntilNextUtcDay(new Date("2026-07-18T00:00:00.000Z"))).toBe(86_400)
  })

  it("uses defaults when env vars are unset or invalid", () => {
    withEnv("TOTEM_DAILY_USER_CAP", undefined, () => {
      withEnv("TOTEM_GLOBAL_DAILY_CAP", "not-a-number", () => {
        expect(getDailyCaps()).toEqual({
          user: TOTEM_DAILY_USER_CAP_DEFAULT,
          global: TOTEM_GLOBAL_DAILY_CAP_DEFAULT,
        })
      })
    })
  })

  it("reads valid env overrides (floored to integers)", () => {
    withEnv("TOTEM_DAILY_USER_CAP", "80.9", () => {
      withEnv("TOTEM_GLOBAL_DAILY_CAP", "2000", () => {
        expect(getDailyCaps()).toEqual({ user: 80, global: 2000 })
      })
    })
  })

  it("rejects zero/negative caps back to defaults (a 0 cap would be a silent kill switch)", () => {
    withEnv("TOTEM_DAILY_USER_CAP", "0", () => {
      expect(getDailyCaps().user).toBe(TOTEM_DAILY_USER_CAP_DEFAULT)
    })
  })
})
