// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { checkTotemRateLimit } from "../totem/rate-limit"
import { checkNlRateLimit } from "../nl-search/rate-limit"
import { POST as chat } from "@/app/api/totem/chat/route"
import { POST as refine } from "@/app/api/decouverte/affiner/route"
import { DecouverteResults } from "@/app/decouverte/DecouverteResults"
import { validateNlIntent } from "../nl-search/validate"

const mocks = vi.hoisted(() => ({
  shared: vi.fn(), auth: vi.fn(), dailyChat: vi.fn(), dailyNl: vi.fn(),
  parse: vi.fn(), stream: vi.fn(), cached: vi.fn(), record: vi.fn(),
  board: vi.fn(), conversation: vi.fn(),
}))
vi.mock("../auth-rate-limit", () => ({ checkSharedRateLimit: mocks.shared }))
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "192.0.2.1" }) }))
vi.mock("ai", () => ({ streamText: mocks.stream, stepCountIs: vi.fn(), convertToModelMessages: vi.fn() }))
vi.mock("@ai-sdk/anthropic", () => ({ anthropic: vi.fn() }))
vi.mock("@/lib/totem/tools", () => ({ buildTotemTools: vi.fn() }))
vi.mock("@/lib/totem/access", () => ({ canUseTotem: () => true }))
vi.mock("@/lib/totem/daily-cap", () => ({ checkDailyCaps: mocks.dailyChat, secondsUntilNextUtcDay: () => 3600 }))
vi.mock("@/lib/totem/persistence", () => ({
  countTurnsInConversation: vi.fn(), getOrCreateConversation: mocks.conversation,
  lastAssistantMentionedNudge: vi.fn(), newSessionId: () => "session",
  recordAssistantMessage: vi.fn(), recordUserMessage: vi.fn(),
  TOTEM_SESSION_COOKIE: "totem-session", TOTEM_TURN_CAP: 20,
}))
vi.mock("@/lib/nl-search/access", () => ({ canUseNlSearch: () => true }))
vi.mock("@/lib/nl-search/daily-cap", () => ({ checkNlDailyCaps: mocks.dailyNl }))
vi.mock("@/lib/nl-search/parse", () => ({ parseNlQuery: mocks.parse }))
vi.mock("@/lib/nl-search/telemetry", () => ({ findCachedParse: mocks.cached, hashQuery: (q: string) => q, recordNlSearch: mocks.record }))
vi.mock("@/lib/nl-search/resolve-blocks", () => ({ resolveBoard: mocks.board, computeStripes: () => [] }))
vi.mock("@/app/decouverte/DecouverteView", () => ({ DecouverteView: () => null }))
vi.mock("@/app/decouverte/blocks/DeferredBlock", () => ({ DeferredBlock: () => null, DeferredBlockSkeleton: () => null }))

const unavailable = { allowed: false, remaining: 0, resetIn: 60_000, unavailable: true }
const exhausted = { allowed: false, remaining: 0, resetIn: 90_001 }
const allowed = { allowed: true, remaining: 4, resetIn: 3_600_000 }
const ip = "192.0.2.1"

function chatRequest() {
  return new NextRequest("http://localhost/api/totem/chat", {
    method: "POST", headers: { "x-real-ip": ip },
    body: JSON.stringify({ messages: [{ id: "msg", role: "user", parts: [{ type: "text", text: "Un film ce soir ?" }] }] }),
  })
}
function refineRequest() {
  return new Request("http://localhost/api/decouverte/affiner", {
    method: "POST", body: JSON.stringify({ suite: "moins longs", params: {} }),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue(null)
  mocks.shared.mockResolvedValue(allowed)
  mocks.dailyChat.mockResolvedValue({ allowed: false, scope: "global" })
  mocks.dailyNl.mockResolvedValue({ allowed: true })
  mocks.cached.mockResolvedValue(null)
  mocks.board.mockResolvedValue({ blocks: [], personalized: false, members: [], mainCount: 0 })
})

describe("shared paid hourly budgets", () => {
  it.each([
    ["chat", checkTotemRateLimit, "totem-hourly", 5],
    ["search", checkNlRateLimit, "nl-search-hourly", 10],
  ] as const)("keeps the %s anonymous hourly budget", async (_name, check, namespace, limit) => {
    const result = await check({ userId: null, ip })
    expect(result).toMatchObject({ allowed: true, limit, retryAfterSec: 0 })
    expect(mocks.shared).toHaveBeenCalledWith(`anon:${ip}`, { namespace, maxRequests: limit, windowMs: 3_600_000 })
  })

  it.each([checkTotemRateLimit, checkNlRateLimit])("keys signed-in budgets by user across IP changes", async (check) => {
    await check({ userId: "parent-a", ip })
    await check({ userId: "parent-a", ip: "192.0.2.2" })
    expect(mocks.shared).toHaveBeenNthCalledWith(1, "user:parent-a", expect.objectContaining({ maxRequests: 30 }))
    expect(mocks.shared).toHaveBeenNthCalledWith(2, "user:parent-a", expect.objectContaining({ maxRequests: 30 }))
  })

  it.each([checkTotemRateLimit, checkNlRateLimit])("propagates unavailable shared storage without a local fallback", async (check) => {
    mocks.shared.mockResolvedValue(unavailable)
    expect(await check({ userId: null, ip })).toMatchObject({ allowed: false, unavailable: true, retryAfterSec: 60 })
  })

  it("rounds the shared retry window up to seconds", async () => {
    mocks.shared.mockResolvedValue(exhausted)
    expect(await checkTotemRateLimit({ userId: null, ip })).toMatchObject({ allowed: false, retryAfterSec: 91 })
  })
})

describe("paid entrypoints fail closed before calling a model", () => {
  it("returns 503 from chat when the shared counter is unavailable", async () => {
    mocks.shared.mockResolvedValue(unavailable)
    const response = await chat(chatRequest())
    expect(response.status).toBe(503)
    expect(response.headers.get("Retry-After")).toBe("60")
    expect(await response.json()).toMatchObject({ error: "totem_unavailable", retryAfterSec: 60 })
    expect(mocks.dailyChat).not.toHaveBeenCalled()
    expect(mocks.conversation).not.toHaveBeenCalled()
    expect(mocks.stream).not.toHaveBeenCalled()
  })

  it("keeps chat's exhausted-budget response format", async () => {
    mocks.shared.mockResolvedValue(exhausted)
    const response = await chat(chatRequest())
    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({ error: "rate_limited", retryAfterSec: 91, limit: 5 })
    expect(mocks.stream).not.toHaveBeenCalled()
  })

  it("awaits the shared result before chat's daily check", async () => {
    let release!: (result: typeof allowed) => void
    mocks.shared.mockReturnValue(new Promise((resolve) => { release = resolve }))
    const pending = chat(chatRequest())
    await vi.waitFor(() => expect(mocks.shared).toHaveBeenCalled())
    expect(mocks.dailyChat).not.toHaveBeenCalled()
    expect(mocks.stream).not.toHaveBeenCalled()
    release(allowed)
    await pending
    expect(mocks.dailyChat).toHaveBeenCalledOnce()
  })

  it("returns 503 from refinement before interpretation when the counter is unavailable", async () => {
    mocks.shared.mockResolvedValue(unavailable)
    const response = await refine(refineRequest())
    expect(response.status).toBe(503)
    expect(response.headers.get("Retry-After")).toBe("60")
    expect(await response.json()).toHaveProperty("error")
    expect(mocks.dailyNl).not.toHaveBeenCalled()
    expect(mocks.parse).not.toHaveBeenCalled()
  })

  it("keeps refinement's exhausted-budget response format", async () => {
    mocks.shared.mockResolvedValue(exhausted)
    expect((await refine(refineRequest())).status).toBe(429)
    expect(mocks.parse).not.toHaveBeenCalled()
  })

  it.each([
    ["refinement", () => refine(refineRequest())],
    ["discovery", () => DecouverteResults({ params: { q: "film sympa" }, userId: null })],
  ] as const)("awaits the shared result before %s interpretation", async (_name, run) => {
    let release!: (result: typeof allowed) => void
    mocks.shared.mockReturnValue(new Promise((resolve) => { release = resolve }))
    mocks.parse.mockResolvedValue(null)
    const pending = run()
    await vi.waitFor(() => expect(mocks.shared).toHaveBeenCalled())
    expect(mocks.dailyNl).not.toHaveBeenCalled()
    expect(mocks.parse).not.toHaveBeenCalled()
    release(allowed)
    await pending
    expect(mocks.dailyNl).toHaveBeenCalledOnce()
    expect(mocks.parse).toHaveBeenCalledOnce()
  })

  it("degrades server-rendered interpretation to existing keyword results when unavailable", async () => {
    mocks.shared.mockResolvedValue(unavailable)
    const result = await DecouverteResults({ params: { q: "film sympa" }, userId: null })
    expect(result.props.degraded).toBe(true)
    expect(mocks.parse).not.toHaveBeenCalled()
    expect(mocks.dailyNl).not.toHaveBeenCalled()
    expect(mocks.board).toHaveBeenCalledWith(expect.objectContaining({ intent: expect.objectContaining({ mode: "texte" }) }))
  })

  it("keeps cached interpretations available without spending a paid budget", async () => {
    mocks.cached.mockResolvedValue({ intent: validateNlIntent(null), plan: [] })
    const result = await DecouverteResults({ params: { q: "film sympa" }, userId: null })
    expect(result.props.degraded).toBe(false)
    expect(mocks.shared).not.toHaveBeenCalled()
    expect(mocks.parse).not.toHaveBeenCalled()
  })
})
