// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const { isCronOrAdminAuthorized, logCronRun, sendHomepageWatchReport, runHomepageWatch } = vi.hoisted(() => ({
  isCronOrAdminAuthorized: vi.fn(),
  logCronRun: vi.fn(),
  sendHomepageWatchReport: vi.fn(),
  runHomepageWatch: vi.fn(),
}))
vi.mock("@/lib/cron-auth", () => ({ isCronOrAdminAuthorized }))
vi.mock("@/lib/cron-log", () => ({ logCronRun }))
vi.mock("@/lib/email", () => ({ sendHomepageWatchReport }))
vi.mock("@/lib/homepage-watch-run", () => ({ runHomepageWatch }))

import { GET } from "../homepage-watch/route"

function result(health: string, failedImports = 0) {
  return {
    classified: [],
    pins: [],
    report: "rapport",
    subject: "Veille accueil — rien à faire",
    health,
    remaining: 0,
    outcomes: {
      dryRun: false,
      writesEnabled: true,
      sources: {},
      homepageReadOk: true,
      catalogueReadOk: true,
      imports: { candidates: 0, created: 0, skipped: 0, failed: failedImports, keys: [] },
      pins: { desired: 0, written: 0, failed: false, removed: 0 },
    },
  }
}

const call = (qs = "") => GET(new NextRequest(`https://totemavise.com/api/cron/homepage-watch${qs}`))

beforeEach(() => {
  vi.resetAllMocks()
  isCronOrAdminAuthorized.mockResolvedValue(true)
  runHomepageWatch.mockResolvedValue(result("ok"))
  vi.stubEnv("VERCEL_ENV", "production")
})
afterEach(() => vi.unstubAllEnvs())

describe("GET /api/cron/homepage-watch", () => {
  it("refuses an unauthenticated call without running anything", async () => {
    isCronOrAdminAuthorized.mockResolvedValue(false)
    expect((await call()).status).toBe(401)
    expect(runHomepageWatch).not.toHaveBeenCalled()
  })

  it("writes by default in production", async () => {
    await call()
    expect(runHomepageWatch).toHaveBeenCalledWith({ writesEnabled: true, dryRun: false })
  })

  it("honours the kill switch HOMEPAGE_WATCH_AUTOFIX=false (report only, still logged and emailed)", async () => {
    vi.stubEnv("HOMEPAGE_WATCH_AUTOFIX", "false")
    await call()
    expect(runHomepageWatch).toHaveBeenCalledWith({ writesEnabled: false, dryRun: false })
    expect(logCronRun).toHaveBeenCalledOnce()
    expect(sendHomepageWatchReport).toHaveBeenCalledOnce()
  })

  it("never writes outside production", async () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    await call()
    expect(runHomepageWatch).toHaveBeenCalledWith({ writesEnabled: false, dryRun: false })
  })

  it("?dryRun=1 reports without email or cron_logs row", async () => {
    const res = await call("?dryRun=1")
    expect(runHomepageWatch).toHaveBeenCalledWith({ writesEnabled: true, dryRun: true })
    expect(logCronRun).not.toHaveBeenCalled()
    expect(sendHomepageWatchReport).not.toHaveBeenCalled()
    expect((await res.json()).dryRun).toBe(true)
  })

  it.each([
    ["ok", 0, "success"],
    ["ok", 1, "partial"],
    ["sources-degraded", 0, "partial"],
    ["writes-failed", 0, "partial"],
    ["sources-failed", 0, "error"],
  ])("logs health %s with %i failed import(s) as %s", async (health, failed, status) => {
    runHomepageWatch.mockResolvedValue(result(health, failed))
    await call()
    expect(logCronRun).toHaveBeenCalledWith(expect.objectContaining({ task: "homepage-watch", status }))
  })

  it("still logs the run when the email fails", async () => {
    sendHomepageWatchReport.mockRejectedValue(new Error("resend down"))
    await call()
    expect(logCronRun).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.objectContaining({ emailed: false }) }),
    )
  })
})
