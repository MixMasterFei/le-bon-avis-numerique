// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, type NextFetchEvent } from "next/server"
import { middleware } from "./middleware"

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
