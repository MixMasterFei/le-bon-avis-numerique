// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const { upsert } = vi.hoisted(() => ({ upsert: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { aiBotHit: { upsert } } }))

import { POST } from "./route"

const SECRET = "ai-bot-test-secret-0123456789"

function hit(secret?: string) {
  return POST(new NextRequest("https://totemavise.com/api/track/ai-bot", {
    method: "POST",
    headers: secret === undefined ? {} : { "x-track-secret": secret },
    body: JSON.stringify({ bot: "GPTBot", kind: "crawler", surface: "fiche", path: "/media/x" }),
  }))
}

beforeEach(() => {
  vi.resetAllMocks()
  upsert.mockResolvedValue({})
})
afterEach(() => vi.unstubAllEnvs())

describe("POST /api/track/ai-bot — the middleware's telemetry secret", () => {
  it.each([
    ["absent", undefined, "undefined"],
    ["empty", "", ""],
    ["blank", "   ", "   "],
    ["set, wrong one presented", SECRET, "guess"],
    ["set, none presented", SECRET, undefined],
  ])("refuses when the secret is %s", async (_label, configured, presented) => {
    vi.stubEnv("CRON_SECRET", configured)
    expect((await hit(presented)).status).toBe(401)
    expect(upsert).not.toHaveBeenCalled()
  })

  it("records the hit with the right secret", async () => {
    vi.stubEnv("CRON_SECRET", SECRET)
    expect((await hit(SECRET)).status).toBe(200)
    expect(upsert).toHaveBeenCalledOnce()
  })
})
