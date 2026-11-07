// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import type { EvalRunResult } from "@/lib/totem/eval/runner"

const h = vi.hoisted(() => ({
  authorized: vi.fn(),
  logCronRun: vi.fn(),
  lockHeld: { value: false },
  shared: vi.fn(),
  runEvalSuite: vi.fn(),
}))

vi.mock("@/lib/cron-auth", () => ({ isCronOrAdminAuthorized: h.authorized }))
vi.mock("@/lib/cron-log", () => ({ logCronRun: h.logCronRun }))
vi.mock("@/lib/cron-lock", () => ({
  withCronLock: async (_task: string, _lease: number, fn: () => Promise<unknown>) => (h.lockHeld.value ? null : fn()),
}))
vi.mock("@/lib/auth-rate-limit", () => ({ checkSharedRateLimit: h.shared }))
vi.mock("@/lib/totem/eval/runner", () => ({ runEvalSuite: h.runEvalSuite }))
vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import { POST } from "../route"

const post = (qs = "") => POST(new NextRequest(`http://localhost/api/cron/totem-eval${qs}`, { method: "POST" }))

function runResult(failing: boolean): EvalRunResult {
  const check = (id: string, pass: boolean) => ({ id, pass, ...(pass ? {} : { detail: "x" }) })
  return {
    model: "live",
    startedAt: "2026-11-08T05:51:00.000Z",
    durationMs: 1000,
    scenarios: [
      {
        id: "age-interstellar",
        category: "grounding",
        title: "Interstellar",
        status: failing ? "fail" : "pass",
        costUsd: 0.02,
        latencyMs: 4000,
        turns: [
          {
            trace: {
              index: 0,
              user: "Interstellar ?",
              steps: [],
              text: "Dès 13 ans.",
              finishReason: "stop",
              model: "claude-haiku-4-5-20251001",
              routing: "default",
              latencyMs: 4000,
              usage: { inputTokens: 50000, outputTokens: 400, cachedInputTokens: 40000, uncachedInputTokens: 10000, cacheWriteInputTokens: 0 },
              costUsd: 0.02,
            },
            checks: [check("not_blank", true), check("ages_match_db", !failing)],
          },
        ],
      },
    ],
  }
}

let runsToday = 0
beforeEach(() => {
  vi.clearAllMocks()
  h.lockHeld.value = false
  runsToday = 0
  h.authorized.mockResolvedValue(true)
  // The shared counter behaves like the real one: 3 per window.
  h.shared.mockImplementation(async (_id: string, cfg: { maxRequests: number }) => {
    runsToday++
    return { allowed: runsToday <= cfg.maxRequests, remaining: Math.max(0, cfg.maxRequests - runsToday), resetIn: 3_600_000 }
  })
  h.runEvalSuite.mockResolvedValue(runResult(true))
})

describe("POST /api/cron/totem-eval", () => {
  it("refuses an unauthenticated caller", async () => {
    h.authorized.mockResolvedValue(false)
    expect((await post()).status).toBe(401)
    expect(h.runEvalSuite).not.toHaveBeenCalled()
  })

  it("only accepts the allowlisted models and known suites", async () => {
    expect((await post("?model=claude-opus-5-5")).status).toBe(400)
    expect((await post("?suite=nimporte")).status).toBe(400)
    expect((await post("?only=pas-un-scenario")).status).toBe(400)
    expect(h.runEvalSuite).not.toHaveBeenCalled()
  })

  it("dryRun lists the scenarios and the estimate without spending anything", async () => {
    const res = await post("?dryRun=1&model=claude-sonnet-5-5")
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.scenarios.length).toBeGreaterThanOrEqual(45)
    expect(json.estimate).toMatchObject({ turns: expect.any(Number), usd: expect.any(Number) })
    expect(json.model).toBe("claude-sonnet-5-5")
    expect(h.runEvalSuite).not.toHaveBeenCalled()
    expect(h.shared).not.toHaveBeenCalled()
    expect(h.logCronRun).not.toHaveBeenCalled()
  })

  it("logs one cron_logs row (task totem-eval), partial when a check fails", async () => {
    const res = await post("?model=claude-haiku-5-5&suite=grounding")
    expect(res.status).toBe(200)
    expect(h.runEvalSuite).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-haiku-5-5", origin: "http://localhost" }),
    )
    expect(h.logCronRun).toHaveBeenCalledTimes(1)
    const row = h.logCronRun.mock.calls[0][0]
    expect(row).toMatchObject({ task: "totem-eval", status: "partial" })
    expect(row.summary).toContain("0/1 scénarios réussis")
    expect(row.details).toMatchObject({
      model: "live",
      totals: { failedChecks: 1, costUsd: 0.02 },
      categories: { grounding: { passRate: 0 } },
      checks: { ages_match_db: { failed: 1 } },
    })
  })

  it("logs success when every check passes", async () => {
    h.runEvalSuite.mockResolvedValue(runResult(false))
    await post()
    expect(h.logCronRun.mock.calls[0][0]).toMatchObject({ status: "success" })
  })

  it("refuses a 4th run in 24 h before any model call", async () => {
    for (let i = 0; i < 3; i++) expect((await post()).status).toBe(200)
    const fourth = await post()
    expect(fourth.status).toBe(429)
    expect(await fourth.json()).toMatchObject({ error: "daily_cap_reached", limit: 3 })
    expect(h.runEvalSuite).toHaveBeenCalledTimes(3)
  })

  it("fails closed when the shared counter is unavailable", async () => {
    h.shared.mockResolvedValue({ allowed: false, remaining: 0, resetIn: 60_000, unavailable: true })
    expect((await post()).status).toBe(503)
    expect(h.runEvalSuite).not.toHaveBeenCalled()
  })

  it("refuses a second concurrent run", async () => {
    h.lockHeld.value = true
    expect((await post()).status).toBe(409)
    expect(h.shared).not.toHaveBeenCalled()
    expect(h.runEvalSuite).not.toHaveBeenCalled()
  })

  it("logs an error row when the bench itself crashes", async () => {
    h.runEvalSuite.mockRejectedValue(new Error("boom"))
    expect((await post()).status).toBe(500)
    expect(h.logCronRun).toHaveBeenCalledWith(expect.objectContaining({ task: "totem-eval", status: "error" }))
  })
})
