import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

// The agent-ledger routes approve writes and raise autonomy. The cron bearer
// the middleware accepts on /api/admin must NOT work here: an agent must never
// approve its own proposals.

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/agent-ledger", async (orig) => {
  const real = await orig<typeof import("@/lib/agent-ledger")>()
  return {
    ...real,
    getLedgerOverview: vi.fn().mockResolvedValue({ available: true }),
    decideAgentAction: vi.fn().mockResolvedValue({ status: "applied" }),
    setAutonomy: vi.fn().mockResolvedValue({}),
  }
})

import { GET } from "../route"
import { POST } from "../actions/[id]/route"
import { PUT } from "../autonomy/route"
import { auth } from "@/lib/auth"
import { decideAgentAction, setAutonomy } from "@/lib/agent-ledger"

const mockedAuth = vi.mocked(auth)

function asRole(role: string | null) {
  mockedAuth.mockResolvedValue(role ? ({ user: { id: "u1", role } } as never) : (null as never))
}

function req(url: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const ctx = { params: Promise.resolve({ id: "a1" }) }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = "s3cret"
})

describe("agent ledger routes", () => {
  it("refuse a cron-bearer call with no admin session", async () => {
    asRole(null)
    const r = await POST(req("http://x/api/admin/agents/actions/a1", "POST", { decision: "approve" }, { authorization: "Bearer s3cret" }), ctx)
    expect(r.status).toBe(403)
    expect(decideAgentAction).not.toHaveBeenCalled()
  })

  it("refuse moderators (pilotage is read-only)", async () => {
    asRole("MODERATOR")
    expect((await GET()).status).toBe(403)
    expect((await PUT(req("http://x", "PUT", { actionType: "seo.seo_title", level: "autonomous" }))).status).toBe(403)
    expect(setAutonomy).not.toHaveBeenCalled()
  })

  it("let an admin decide, passing who decided", async () => {
    asRole("ADMIN")
    const r = await POST(req("http://x", "POST", { decision: "approve" }), ctx)
    expect(r.status).toBe(200)
    expect(decideAgentAction).toHaveBeenCalledWith("a1", "approve", "u1")
  })

  it("reject unknown decisions and malformed autonomy", async () => {
    asRole("ADMIN")
    expect((await POST(req("http://x", "POST", { decision: "delete" }), ctx)).status).toBe(400)
    expect((await PUT(req("http://x", "PUT", { actionType: "seo.seo_title", level: "god" }))).status).toBe(400)
    expect((await PUT(req("http://x", "PUT", { actionType: "seo.seo_title", level: "suggest", minConfidence: 90 }))).status).toBe(400)
    expect(setAutonomy).not.toHaveBeenCalled()
  })

  it("save a valid autonomy level", async () => {
    asRole("ADMIN")
    const r = await PUT(req("http://x", "PUT", { actionType: "seo.seo_title", level: "suggest", minConfidence: 0.8 }))
    expect(r.status).toBe(200)
    expect(setAutonomy).toHaveBeenCalledWith("seo.seo_title", "suggest", 0.8, "u1")
  })
})
