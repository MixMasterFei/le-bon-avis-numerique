// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, type NextFetchEvent } from "next/server"
import { middleware } from "./middleware"
import { CRON_JOB_ROUTES } from "@/lib/cron-credential"

const { auth, getToken, throttle } = vi.hoisted(() => ({ auth: vi.fn(), getToken: vi.fn(), throttle: vi.fn() }))
vi.mock("@/lib/auth", () => ({ auth }))
vi.mock("next-auth/jwt", () => ({ getToken }))
vi.mock("@/lib/auth-rate-limit", () => ({ checkAuthRateLimit: throttle, cleanupAuthRateLimits: vi.fn() }))
const event = { waitUntil: vi.fn() } as unknown as NextFetchEvent

beforeEach(() => {
  vi.resetAllMocks()
  getToken.mockResolvedValue(null)
  throttle.mockResolvedValue({ allowed: true, remaining: 4, resetIn: 60_000 })
  vi.spyOn(Math, "random").mockReturnValue(0.5)
})
afterEach(() => vi.restoreAllMocks())

describe("catalogue and authentication middleware", () => {
  it("allows page 222 to reach the catalogue's real total-page validation", async () => {
    const response = await middleware(new NextRequest("https://totemavise.com/films?page=222"), event)
    expect(response.status).toBe(200)
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })
  it("keeps invalid-page 404s and page-one canonical redirects", async () => {
    expect((await middleware(new NextRequest("https://totemavise.com/films?page=2x"), event)).status).toBe(404)
    const response = await middleware(new NextRequest("https://totemavise.com/films?page=1&maxAge=7"), event)
    expect(response.status).toBe(301)
    expect(response.headers.get("location")).toBe("https://totemavise.com/films?maxAge=7")
  })
  it("passes trusted IPs to the shared auth counter and honors its denial", async () => {
    throttle.mockResolvedValue({ allowed: false, remaining: 0, resetIn: 40_000 })
    const response = await middleware(new NextRequest("https://totemavise.com/api/auth/callback/credentials", {
      method: "POST", headers: { "x-real-ip": "203.0.113.1", "cf-connecting-ip": "spoof" },
    }), event)
    expect(throttle).toHaveBeenCalledWith("203.0.113.1")
    expect(response.status).toBe(429)
    expect(response.headers.get("retry-after")).toBe("40")
  })
  it("fails closed with a retryable error if the shared throttle is unavailable", async () => {
    throttle.mockResolvedValue({ allowed: false, remaining: 0, resetIn: 60_000, unavailable: true })
    const response = await middleware(new NextRequest("https://totemavise.com/api/auth/register", { method: "POST" }), event)
    expect(response.status).toBe(503)
    expect(response.headers.get("cache-control")).toBe("no-store")
  })
  it.each([null, { user: { onboardingCompleted: true } }])("does not redirect revoked or already-completed sessions", async session => {
    getToken.mockResolvedValue({ onboardingCompleted: false })
    auth.mockResolvedValue(session)
    const response = await middleware(new NextRequest("https://totemavise.com/"), event)
    expect(response.status).toBe(200)
    expect(getToken).toHaveBeenCalledWith(expect.objectContaining({ secureCookie: true }))
  })
  it("still redirects a currently authenticated, incomplete profile", async () => {
    getToken.mockResolvedValue({ onboardingCompleted: false })
    auth.mockResolvedValue({ user: { onboardingCompleted: false } })
    const response = await middleware(new NextRequest("https://totemavise.com/"), event)
    expect(response.headers.get("location")).toBe("https://totemavise.com/onboarding")
  })
})

describe("automation credential scope (/admin, /api/admin)", () => {
  const SECRET = "middleware-test-secret-0123456789"
  let ip = 0
  // A fresh client IP per request keeps these cases out of each other's
  // in-memory rate-limit bucket.
  function request(method: string, pathname: string, authorization?: string) {
    ip += 1
    const headers: Record<string, string> = { "x-real-ip": `198.51.100.${ip % 250}` }
    if (authorization !== undefined) headers.authorization = authorization
    return new NextRequest(`https://totemavise.com${pathname}`, { method, headers })
  }
  const passedThrough = (response: Response) => response.headers.get("x-middleware-next") === "1"

  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET)
    auth.mockResolvedValue(null)
  })
  afterEach(() => vi.unstubAllEnvs())

  it("lets the credential through to every scheduled /api/admin job, without a session", async () => {
    const adminJobs = CRON_JOB_ROUTES.filter((r) => r.path.startsWith("/api/admin/"))
    expect(adminJobs.length).toBeGreaterThan(10)
    for (const job of adminJobs) {
      const response = await middleware(request(job.method, job.path, `Bearer ${SECRET}`), event)
      expect(passedThrough(response), `${job.method} ${job.path}`).toBe(true)
    }
    expect(auth).not.toHaveBeenCalled()
  })

  it.each([
    ["GET", "/api/admin/totem/conversations"],
    ["GET", "/api/admin/totem/conversations/conv-1"],
    ["GET", "/api/admin/totem?export=conversations"],
    ["GET", "/api/admin/users"],
    ["GET", "/api/admin/dashboard"],
    ["GET", "/api/admin/similarity/compute"],
  ])("refuses the credential on %s %s (not a scheduled job)", async (method, pathname) => {
    const response = await middleware(request(method, pathname, `Bearer ${SECRET}`), event)
    expect(response.status).toBe(401)
    expect(passedThrough(response)).toBe(false)
  })

  it("sends a credential-only visit to the admin UI to the sign-in page", async () => {
    const response = await middleware(request("GET", "/admin", `Bearer ${SECRET}`), event)
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toContain("/connexion")
  })

  it.each([
    ["absent", undefined, "Bearer undefined"],
    ["empty", "", "Bearer "],
    ["blank", "   ", "Bearer    "],
    ["set, but a wrong one is presented", SECRET, "Bearer not-the-secret"],
  ])("fails closed when the secret is %s", async (_label, configured, header) => {
    vi.stubEnv("CRON_SECRET", configured)
    const response = await middleware(request("POST", "/api/admin/enrich", header), event)
    expect(response.status).toBe(401)
  })

  it("keeps a current ADMIN session working on the transcript routes", async () => {
    auth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } })
    for (const pathname of ["/api/admin/totem/conversations", "/api/admin/totem/conversations/conv-1"]) {
      expect(passedThrough(await middleware(request("GET", pathname), event))).toBe(true)
    }
  })

  it.each([
    ["deleted (no session resolves)", null, 401],
    ["demoted to MODERATOR", { user: { id: "u-1", role: "MODERATOR" } }, 403],
    ["demoted to USER", { user: { id: "u-1", role: "USER" } }, 403],
  ])("refuses an account that was %s", async (_label, session, status) => {
    auth.mockResolvedValue(session)
    const response = await middleware(request("GET", "/api/admin/totem/conversations"), event)
    expect(response.status).toBe(status)
  })
})
