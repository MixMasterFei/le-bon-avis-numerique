// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { checkAuthRateLimit, cleanupAuthRateLimits } from "./auth-rate-limit"

const { query, execute } = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn() }))
vi.mock("./prisma", () => ({ prisma: { $queryRaw: query, $executeRaw: execute } }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("AUTH_SECRET", "test-only-secret")
  vi.stubEnv("NEXTAUTH_SECRET", "")
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe("shared authentication throttle", () => {
  it("reserves each request using one parameterized atomic upsert", async () => {
    query.mockResolvedValue([{ count: 5, resetIn: 40_000 }])
    expect(await checkAuthRateLimit("203.0.113.1")).toEqual({ allowed: true, remaining: 0, resetIn: 40_000 })
    expect(query).toHaveBeenCalledOnce()
    const [sql, key] = query.mock.calls[0]
    expect(sql.join("?")).toContain('ON CONFLICT ("key") DO UPDATE')
    expect(key).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(query.mock.calls)).not.toContain("203.0.113.1")
  })
  it("denies requests beyond the shared limit", async () => {
    query.mockResolvedValue([{ count: 6, resetIn: 25_000 }])
    expect(await checkAuthRateLimit("203.0.113.1")).toEqual({ allowed: false, remaining: 0, resetIn: 25_000 })
  })
  it("uses the same bucket across independent calls, without a process-local allowance", async () => {
    query.mockResolvedValueOnce([{ count: 1, resetIn: 60_000 }]).mockResolvedValueOnce([{ count: 6, resetIn: 10_000 }])
    expect((await checkAuthRateLimit("203.0.113.1")).allowed).toBe(true)
    expect((await checkAuthRateLimit("203.0.113.1")).allowed).toBe(false)
    expect(query.mock.calls[0][1]).toBe(query.mock.calls[1][1])
  })
  it("supports the existing NEXTAUTH_SECRET alias", async () => {
    vi.stubEnv("AUTH_SECRET", "")
    vi.stubEnv("NEXTAUTH_SECRET", "legacy-test-secret")
    query.mockResolvedValue([{ count: 1, resetIn: 60_000 }])
    expect((await checkAuthRateLimit("203.0.113.1")).allowed).toBe(true)
  })
  it("fails closed when the database/migration is unavailable", async () => {
    query.mockRejectedValue(new Error("unavailable"))
    expect(await checkAuthRateLimit("203.0.113.1")).toEqual({ allowed: false, remaining: 0, resetIn: 60_000, unavailable: true })
  })
  it("fails closed without the secret", async () => {
    vi.stubEnv("AUTH_SECRET", "")
    expect((await checkAuthRateLimit("203.0.113.1")).unavailable).toBe(true)
    expect(query).not.toHaveBeenCalled()
  })
  it("rechecks expiry on the deleted row so cleanup cannot erase a renewed bucket", async () => {
    execute.mockResolvedValue(0)
    await cleanupAuthRateLimits()
    expect(execute.mock.calls[0][0].join("?")).toContain('WHERE "expires_at" < CURRENT_TIMESTAMP AND "key" IN')
    expect(execute.mock.calls[0][0].join("?")).toContain("LIMIT 500")
  })
})
