// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const { requireAdminSession, deleteMany, findMany, revalidateTag } = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  deleteMany: vi.fn(),
  findMany: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock("@/lib/admin-session", () => ({ requireAdminSession }))
vi.mock("@/lib/prisma", () => ({ prisma: { homepageSpotlight: { deleteMany, findMany } } }))
vi.mock("next/cache", () => ({ revalidateTag }))
vi.mock("@/lib/homepage-spotlight-data", () => ({
  HOMEPAGE_SPOTLIGHT_TAG: "homepage-spotlight",
  getHomepageSpotlight: vi.fn().mockResolvedValue([]),
}))

import { DELETE, GET } from "../route"

const PIN_ID = "6f1c2f9e-0c1a-4d0e-9a51-1b2c3d4e5f60"
const del = (id: string) => DELETE(new NextRequest(`https://totemavise.com/api/admin/homepage-spotlight?id=${id}`, { method: "DELETE" }))

beforeEach(() => {
  vi.clearAllMocks()
  requireAdminSession.mockResolvedValue(null)
})

describe("/api/admin/homepage-spotlight", () => {
  it("refuses a non-admin, for reading and for removing", async () => {
    requireAdminSession.mockResolvedValue(NextResponse.json({ error: "Accès non autorisé" }, { status: 403 }))
    expect((await GET()).status).toBe(403)
    expect((await del(PIN_ID)).status).toBe(403)
    expect(deleteMany).not.toHaveBeenCalled()
  })

  it("rejects a malformed id without touching the table", async () => {
    expect((await del("1 OR 1=1")).status).toBe(400)
    expect(deleteMany).not.toHaveBeenCalled()
  })

  it("removes one pin and refreshes the band at once", async () => {
    deleteMany.mockResolvedValue({ count: 1 })
    const res = await del(PIN_ID)
    expect(res.status).toBe(200)
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: PIN_ID } })
    expect(revalidateTag).toHaveBeenCalledWith("homepage-spotlight", { expire: 0 })
  })

  it("answers 404 for an unknown pin", async () => {
    deleteMany.mockResolvedValue({ count: 0 })
    expect((await del(PIN_ID)).status).toBe(404)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("reports a missing table (migration not applied) instead of failing", async () => {
    findMany.mockRejectedValue(new Error('relation "homepage_spotlight" does not exist'))
    const body = await (await GET()).json()
    expect(body.tableReady).toBe(false)
    expect(body.pins).toEqual([])
  })
})
