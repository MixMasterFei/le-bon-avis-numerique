import { describe, expect, it } from "vitest"
import type { LanguageModelUsage, UIMessage } from "ai"
import {
  truncateHistory,
  TOTEM_HISTORY_MAX_MESSAGES,
  TOTEM_HISTORY_MAX_CHARS,
} from "../totem/history"
import { extractUsage } from "../totem/usage"
import { estimateCostUsd, TOTEM_MAX_OUTPUT_TOKENS } from "../totem/cost"
import {
  startOfUtcDay,
  secondsUntilNextUtcDay,
  getDailyCaps,
  TOTEM_DAILY_USER_CAP_DEFAULT,
  TOTEM_GLOBAL_DAILY_CAP_DEFAULT,
} from "../totem/daily-cap"

function msg(role: "user" | "assistant", text: string, id = Math.random().toString(36).slice(2)): UIMessage {
  return { id, role, parts: [{ type: "text", text }] } as UIMessage
}

describe("truncateHistory (server-side history bound)", () => {
  it("passes short conversations through untouched", () => {
    const messages = [msg("user", "bonjour"), msg("assistant", "bonjour !"), msg("user", "un film ?")]
    expect(truncateHistory(messages)).toEqual(messages)
  })

  it("keeps only the trailing MAX_MESSAGES", () => {
    const messages: UIMessage[] = []
    for (let i = 0; i < 30; i++) {
      messages.push(msg(i % 2 === 0 ? "user" : "assistant", `m${i}`))
    }
    const out = truncateHistory(messages)
    expect(out.length).toBeLessThanOrEqual(TOTEM_HISTORY_MAX_MESSAGES)
    expect(out[out.length - 1]).toBe(messages[messages.length - 1])
  })

  it("drops older messages once the char budget is spent", () => {
    const big = "x".repeat(TOTEM_HISTORY_MAX_CHARS) // alone eats the whole budget
    const messages = [msg("user", big), msg("assistant", "ok"), msg("user", "et pour un ado ?")]
    const out = truncateHistory(messages)
    // The oversized head must be gone; the final user message survives.
    expect(out.some((m) => messageText(m) === big)).toBe(false)
    expect(messageText(out[out.length - 1])).toBe("et pour un ado ?")
  })

  it("always keeps the final user message even when it alone exceeds the budget", () => {
    const huge = "y".repeat(TOTEM_HISTORY_MAX_CHARS * 2)
    const out = truncateHistory([msg("user", huge)])
    expect(out).toHaveLength(1)
  })

  it("never leaves a leading assistant message after trimming", () => {
    const messages: UIMessage[] = [msg("assistant", "orphan")]
    for (let i = 0; i < 20; i++) {
      messages.push(msg(i % 2 === 0 ? "user" : "assistant", `m${i}`))
    }
    const out = truncateHistory(messages)
    expect(out[0].role).toBe("user")
  })
})

function messageText(m: UIMessage): string {
  return (m.parts ?? [])
    .map((p) => ("text" in p && typeof p.text === "string" ? p.text : ""))
    .join("")
}

describe("extractUsage (token telemetry mapper)", () => {
  it("maps a normal usage object", () => {
    expect(
      extractUsage({
        inputTokens: 1200,
        outputTokens: 340,
        cachedInputTokens: 8000,
        totalTokens: 9540,
      } as LanguageModelUsage),
    ).toEqual({ inputTokens: 1200, outputTokens: 340, cachedInputTokens: 8000 })
  })

  it("turns undefined usage into all-null (unmeasured, not zero)", () => {
    expect(extractUsage(undefined)).toEqual({
      inputTokens: null,
      outputTokens: null,
      cachedInputTokens: null,
    })
  })

  it("turns NaN / negative / missing fields into null", () => {
    expect(
      extractUsage({ inputTokens: NaN, outputTokens: -5, totalTokens: NaN } as never),
    ).toEqual({ inputTokens: null, outputTokens: null, cachedInputTokens: null })
  })
})

describe("estimateCostUsd", () => {
  it("prices a Haiku turn (input + cached discount + output)", () => {
    // 1M in @$1 + 1M cached @$0.1 + 1M out @$5 = $6.10
    expect(
      estimateCostUsd("claude-haiku-4-5-20251001", {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        cachedInputTokens: 1_000_000,
      }),
    ).toBeCloseTo(6.1, 5)
  })

  it("prices a Sonnet turn at the higher tier", () => {
    expect(
      estimateCostUsd("claude-sonnet-4-6", {
        inputTokens: 1_000_000,
        outputTokens: 0,
        cachedInputTokens: 0,
      }),
    ).toBeCloseTo(3, 5)
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
