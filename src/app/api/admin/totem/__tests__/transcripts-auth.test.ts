// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

// The transcript readers must answer only to a current ADMIN session — even if
// the middleware were bypassed or misconfigured, and never to the automation
// credential (Bearer CRON_SECRET), which is not a session.
const { auth, kpis } = vi.hoisted(() => ({
  auth: vi.fn(),
  kpis: {
    fetchTotemConversationList: vi.fn(),
    fetchTotemConversationDetail: vi.fn(),
    fetchTotemAdminOverview: vi.fn(),
  },
}))
vi.mock("@/lib/auth", () => ({ auth }))
vi.mock("@/lib/totem-admin-kpis", () => kpis)

import { GET as overview } from "../route"
import { GET as list } from "../conversations/route"
import { GET as detail } from "../conversations/[id]/route"

const SECRET = "transcripts-test-secret-0123456789"
const withCron = { authorization: `Bearer ${SECRET}` }

const routes = {
  "GET /api/admin/totem": (headers: Record<string, string> = {}) =>
    overview(new NextRequest("https://totemavise.com/api/admin/totem?export=conversations", { headers })),
  "GET /api/admin/totem/conversations": (headers: Record<string, string> = {}) =>
    list(new NextRequest("https://totemavise.com/api/admin/totem/conversations", { headers })),
  "GET /api/admin/totem/conversations/[id]": (headers: Record<string, string> = {}) =>
    detail(new Request("https://totemavise.com/api/admin/totem/conversations/conv-1", { headers }), {
      params: Promise.resolve({ id: "conv-1" }),
    }),
}

function anyTranscriptRead() {
  return (
    kpis.fetchTotemConversationList.mock.calls.length +
    kpis.fetchTotemConversationDetail.mock.calls.length +
    kpis.fetchTotemAdminOverview.mock.calls.length
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("CRON_SECRET", SECRET)
  auth.mockResolvedValue(null)
  kpis.fetchTotemConversationList.mockResolvedValue({ conversations: [], total: 0 })
  kpis.fetchTotemConversationDetail.mockResolvedValue({ id: "conv-1", messages: [] })
  kpis.fetchTotemAdminOverview.mockResolvedValue({})
})
afterEach(() => vi.unstubAllEnvs())

describe.each(Object.entries(routes))("%s", (_name, call) => {
  it("refuses the cron credential (it is not a session)", async () => {
    const response = await call(withCron)
    expect(response.status).toBe(401)
    expect(anyTranscriptRead()).toBe(0)
  })

  it("refuses a deleted account (no session resolves)", async () => {
    expect((await call()).status).toBe(401)
    expect(anyTranscriptRead()).toBe(0)
  })

  it.each(["MODERATOR", "USER"])("refuses an account demoted to %s", async (role) => {
    auth.mockResolvedValue({ user: { id: "u-1", role } })
    expect((await call()).status).toBe(403)
    expect(anyTranscriptRead()).toBe(0)
  })

  it("serves a current ADMIN session", async () => {
    auth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } })
    const response = await call()
    expect(response.status).toBe(200)
    expect(anyTranscriptRead()).toBeGreaterThan(0)
  })
})
