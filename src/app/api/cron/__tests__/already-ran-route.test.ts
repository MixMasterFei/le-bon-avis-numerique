// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const { isCronOrAdminAuthorized, groupBy } = vi.hoisted(() => ({
  isCronOrAdminAuthorized: vi.fn(),
  groupBy: vi.fn(),
}))
vi.mock("@/lib/cron-auth", () => ({ isCronOrAdminAuthorized }))
vi.mock("@/lib/prisma", () => ({ prisma: { cronLog: { groupBy } } }))

import { GET } from "../already-ran/route"

const call = (schedule?: string) => {
  const qs = schedule === undefined ? "" : `?schedule=${encodeURIComponent(schedule)}`
  return GET(new NextRequest(`https://totemavise.com/api/cron/already-ran${qs}`))
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-11-23T11:05:00Z")) // late 03:07 run
  isCronOrAdminAuthorized.mockResolvedValue(true)
  groupBy.mockResolvedValue([])
})
afterEach(() => vi.useRealTimers())

describe("GET /api/cron/already-ran", () => {
  it("refuses an unauthenticated call", async () => {
    isCronOrAdminAuthorized.mockResolvedValue(false)
    expect((await call("7 3 * * *")).status).toBe(401)
    expect(groupBy).not.toHaveBeenCalled()
  })

  it("400 without a schedule (cron.yml then skips nothing)", async () => {
    const res = await call()
    expect(res.status).toBe(400)
    expect((await res.json()).skip).toEqual([])
  })

  it("lists the slot's jobs that already logged a success/partial since the slot", async () => {
    groupBy.mockResolvedValue([{ task: "import", _max: { createdAt: new Date("2026-11-23T08:06:00Z") } }])
    const res = await call("7 3 * * *")
    const body = await res.json()
    expect(body.skip).toEqual(["import"])
    expect(body.checks).toHaveLength(2)
    const where = groupBy.mock.calls[0][0].where
    expect(where.status).toEqual({ in: ["success", "partial"] })
    expect(where.task.in.sort()).toEqual(["import", "release-status"])
  })

  it("nothing since the slot → nothing skipped", async () => {
    groupBy.mockResolvedValue([{ task: "import", _max: { createdAt: new Date("2026-11-22T11:05:00Z") } }])
    expect((await (await call("7 3 * * *")).json()).skip).toEqual([])
  })

  it("an unguarded schedule (totem-eval) never reads the database", async () => {
    const body = await (await call("51 5 * * 0")).json()
    expect(body).toEqual({ schedule: "51 5 * * 0", skip: [], checks: [] })
    expect(groupBy).not.toHaveBeenCalled()
  })

  it("fails open on a database error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    groupBy.mockRejectedValue(new Error("db down"))
    const res = await call("11 4 * * *")
    expect(res.status).toBe(500)
    expect((await res.json()).skip).toEqual([])
  })
})
