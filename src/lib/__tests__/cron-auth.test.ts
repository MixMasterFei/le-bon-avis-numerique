// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }))
vi.mock("@/lib/auth", () => ({ auth }))

import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { CRON_JOB_ROUTES } from "@/lib/cron-credential"

const SECRET = "cron-auth-test-secret-0123456789"

function request(method: string, pathname: string, authorization?: string) {
  return new NextRequest(`https://totemavise.com${pathname}`, {
    method,
    headers: authorization === undefined ? {} : { authorization },
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("CRON_SECRET", SECRET)
  auth.mockResolvedValue(null)
})
afterEach(() => vi.unstubAllEnvs())

describe("isCronOrAdminAuthorized", () => {
  it("accepts the credential on every scheduled job route, without a session lookup", async () => {
    for (const route of CRON_JOB_ROUTES) {
      const ok = await isCronOrAdminAuthorized(request(route.method, route.path, `Bearer ${SECRET}`))
      expect(ok, `${route.method} ${route.path}`).toBe(true)
    }
    expect(auth).not.toHaveBeenCalled()
  })

  it("refuses the credential outside the job routes (no session)", async () => {
    for (const [method, pathname] of [
      ["POST", "/api/cron/news-reset-recent"],
      ["GET", "/api/db/health"],
      ["POST", "/api/admin/news/reprocess-images"],
      ["GET", "/api/admin/totem/conversations"],
    ]) {
      expect(await isCronOrAdminAuthorized(request(method, pathname, `Bearer ${SECRET}`))).toBe(false)
    }
  })

  it.each([
    ["absent", undefined, "Bearer undefined"],
    ["empty", "", "Bearer "],
    ["blank", "  ", "Bearer   "],
    ["valid but not presented correctly", SECRET, "Bearer wrong-secret"],
  ])("falls back to the session when the secret is %s", async (_label, configured, header) => {
    vi.stubEnv("CRON_SECRET", configured)
    expect(await isCronOrAdminAuthorized(request("GET", "/api/cron/supervisor", header))).toBe(false)
    expect(auth).toHaveBeenCalledOnce()
  })

  it("accepts a current ADMIN session — the « Vérifier les guides » button", async () => {
    auth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } })
    expect(await isCronOrAdminAuthorized(request("GET", "/api/cron/game-guides-check?dryRun=1"))).toBe(true)
  })

  it("still lets the monthly cron reach the same handler with the credential", async () => {
    expect(
      await isCronOrAdminAuthorized(request("GET", "/api/cron/game-guides-check", `Bearer ${SECRET}`)),
    ).toBe(true)
  })

  it.each([
    ["deleted (the session no longer resolves)", null],
    ["demoted to MODERATOR", { user: { id: "u-1", role: "MODERATOR" } }],
    ["demoted to USER", { user: { id: "u-1", role: "USER" } }],
  ])("refuses an account that was %s", async (_label, session) => {
    auth.mockResolvedValue(session)
    expect(await isCronOrAdminAuthorized(request("GET", "/api/cron/game-guides-check?dryRun=1"))).toBe(false)
  })
})
