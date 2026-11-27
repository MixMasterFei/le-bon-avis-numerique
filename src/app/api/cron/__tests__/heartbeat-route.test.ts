// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { HEARTBEAT_JOBS } from "@/lib/heartbeat-schedule"

const { isCronOrAdminAuthorized, logCronRun, groupBy, findMany } = vi.hoisted(() => ({
  isCronOrAdminAuthorized: vi.fn(),
  logCronRun: vi.fn(),
  groupBy: vi.fn(),
  findMany: vi.fn(),
}))
vi.mock("@/lib/cron-auth", () => ({ isCronOrAdminAuthorized }))
vi.mock("@/lib/cron-log", () => ({ logCronRun }))
vi.mock("@/lib/email", () => ({ sendCronSupervisorDigest: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { cronLog: { groupBy, findMany } } }))

import { GET } from "../heartbeat/route"

const NOW = new Date("2026-11-23T08:00:00Z") // Monday, odd day
const TOKEN = "github_pat_TEST_ONLY_fedcba9876543210"
const fetchMock = vi.fn()

/** cron_logs max(createdAt) per task: every job just ran, except `missing` (last run `lastAt`). */
function lastRuns(missing: string[] = [], lastAt?: Date) {
  return HEARTBEAT_JOBS.flatMap((j) => {
    if (!missing.includes(j.task)) return [{ task: j.task, _max: { createdAt: NOW } }]
    return lastAt ? [{ task: j.task, _max: { createdAt: lastAt } }] : []
  })
}

const call = () => GET(new NextRequest("https://totemavise.com/api/cron/heartbeat"))
const logged = () => logCronRun.mock.calls[0][0] as { status: string; summary: string; details: Record<string, unknown> }

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  isCronOrAdminAuthorized.mockResolvedValue(true)
  findMany.mockResolvedValue([])
  groupBy.mockResolvedValue(lastRuns())
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("VERCEL_ENV", "production")
  vi.stubEnv("GITHUB_DISPATCH_TOKEN", TOKEN)
  vi.stubEnv("HEARTBEAT_AUTODISPATCH", "")
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("GET /api/cron/heartbeat", () => {
  it("refuses an unauthenticated call", async () => {
    isCronOrAdminAuthorized.mockResolvedValue(false)
    expect((await call()).status).toBe(401)
    expect(logCronRun).not.toHaveBeenCalled()
  })

  it("success when every job logged since its last fire, nothing dispatched", async () => {
    await call()
    expect(logged().status).toBe("success")
    expect(logged().summary).toMatch(/^OK/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("23 Nov: names each missed job, logs error and dispatches the allow-listed ones", async () => {
    groupBy.mockResolvedValue(
      lastRuns(["import", "release-status", "enrich", "homepage-watch", "family-content-agent", "games-top-names"], new Date("2026-11-22T12:00:00Z")),
    )
    const res = await call()
    const row = logged()
    expect(row.status).toBe("error")
    expect(row.summary).toContain(
      "Pas encore passés aujourd'hui : import (prévu 03:07), release-status (03:07), enrich (04:11), homepage-watch (05:41), family-content-agent (06:37), games-top-names (06:53)",
    )
    expect(row.summary).toContain("Relancés sur GitHub : import, release-status, enrich, homepage-watch, family-content-agent, games-top-names")
    expect(row.details.missing).toEqual(["import", "release-status", "enrich", "homepage-watch", "family-content-agent", "games-top-names"])
    expect(row.details.dispatched).toHaveLength(6)
    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect((await res.json()).dispatched).toHaveLength(6)
  })

  it("weekly-only misses are partial (no failure email)", async () => {
    groupBy.mockResolvedValue(lastRuns(["games-top-names"], new Date("2026-11-16T16:30:00Z")))
    await call()
    expect(logged().status).toBe("partial")
  })

  it("keeps the « pipeline hors service » wording when nothing ran", async () => {
    groupBy.mockResolvedValue([])
    await call()
    expect(logged().status).toBe("error")
    expect(logged().summary).toMatch(/^Pipeline GitHub Actions HORS SERVICE/)
    expect(logged().details.pipelineDown).toBe(true)
  })

  it("skips a task dispatched by a heartbeat less than 20 h ago", async () => {
    groupBy.mockResolvedValue(lastRuns(["import", "enrich"], new Date("2026-11-22T12:00:00Z")))
    findMany.mockResolvedValue([
      { createdAt: new Date("2026-11-23T02:00:00Z"), details: { dispatched: [{ task: "import", ok: true, status: 204 }] } },
    ])
    await call()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(logged().summary).toContain("déjà relancés il y a moins de 20 h : import")
  })

  it("kill switch: reports, never dispatches", async () => {
    vi.stubEnv("HEARTBEAT_AUTODISPATCH", "false")
    groupBy.mockResolvedValue(lastRuns(["import"], new Date("2026-11-22T12:00:00Z")))
    await call()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(logged().status).toBe("error")
    expect(logged().summary).toContain("relance automatique désactivée (HEARTBEAT_AUTODISPATCH=false)")
  })

  it("missing token: reports, never dispatches", async () => {
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "")
    groupBy.mockResolvedValue(lastRuns(["import"], new Date("2026-11-22T12:00:00Z")))
    await call()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(logged().summary).toContain("relance automatique désactivée (GITHUB_DISPATCH_TOKEN absent)")
    expect(logged().details.dispatched).toEqual([])
  })

  it("a failed dispatch is logged, never thrown — and the token is nowhere in the logs", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    groupBy.mockResolvedValue(lastRuns(["import", "enrich"], new Date("2026-11-22T12:00:00Z")))
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: `Bad credentials: ${TOKEN}` }), { status: 401 }))
      .mockRejectedValueOnce(new Error(`connect ECONNRESET Authorization: Bearer ${TOKEN}`))
    const res = await call()
    expect(res.status).toBe(200)
    const row = logged()
    expect(row.status).toBe("error")
    expect(row.summary).toContain("Relance échouée : import (HTTP 401), enrich (pas de réponse)")
    expect(row.details.dispatchFailures).toHaveLength(2)
    const everything = JSON.stringify([
      logCronRun.mock.calls,
      await res.json(),
      consoleSpy.mock.calls,
      warnSpy.mock.calls,
      logSpy.mock.calls,
    ])
    expect(everything).not.toContain(TOKEN)
    expect(everything).not.toContain("Bearer github_pat")
    consoleSpy.mockRestore()
    warnSpy.mockRestore()
    logSpy.mockRestore()
  })

  it("honours EXPECTED_TASKS' activatedAt (homepage-watch before 21 Nov)", async () => {
    vi.setSystemTime(new Date("2026-11-19T08:00:00Z")) // odd day, before activation
    groupBy.mockResolvedValue(lastRuns(["homepage-watch"]).map((r) => ({ ...r, _max: { createdAt: new Date("2026-11-19T07:59:00Z") } })))
    await call()
    expect(logged().details.missing).toEqual([])
  })
})
