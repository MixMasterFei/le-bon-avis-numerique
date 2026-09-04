// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "./route"

const { auth, db } = vi.hoisted(() => ({
  auth: vi.fn(),
  db: {
    familyMember: { findFirst: vi.fn() },
    review: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    mediaItem: { update: vi.fn() },
  },
}))
vi.mock("@/lib/auth", () => ({ auth }))
vi.mock("@/lib/prisma", () => ({ prisma: db }))

const members = [
  { id: "child-a", userId: "parent-a" },
  { id: "child-b", userId: "parent-b" },
]
function request(familyMemberId: unknown = "child-a") {
  return new NextRequest("http://localhost/api/user/review", {
    method: "POST",
    body: JSON.stringify({ mediaId: "film", role: "PARENT", rating: 4, familyMemberId }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.mockResolvedValue({ user: { id: "parent-a" } })
  db.familyMember.findFirst.mockImplementation(async ({ where }) =>
    members.find((member) => member.id === where.id && member.userId === where.userId) ?? null)
  db.review.findFirst.mockResolvedValue(null)
  db.review.findMany.mockResolvedValue([])
  db.review.create.mockImplementation(async ({ data }) => ({ id: "review", ...data }))
  db.review.update.mockImplementation(async ({ data }) => ({ id: "review", ...data }))
})

describe("review family-member ownership", () => {
  it.each(["create", "update"] as const)("rejects the other household's child on %s", async (operation) => {
    if (operation === "update") db.review.findFirst.mockResolvedValue({ id: "existing-review", userId: "parent-a" })
    expect((await POST(request("child-b"))).status).toBe(404)
    expect(db.review.create).not.toHaveBeenCalled()
    expect(db.review.update).not.toHaveBeenCalled()
    expect(db.mediaItem.update).not.toHaveBeenCalled()
  })

  it("enforces ownership in both directions between two households", async () => {
    auth.mockResolvedValue({ user: { id: "parent-b" } })
    expect((await POST(request("child-a"))).status).toBe(404)
    expect((await POST(request("child-b"))).status).toBe(200)
    expect(db.review.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "parent-b", familyMemberId: "child-b" }),
    })
  })

  it.each(["create", "update"] as const)("allows the owner's child on %s", async (operation) => {
    if (operation === "update") db.review.findFirst.mockResolvedValue({ id: "existing-review", userId: "parent-a" })
    expect((await POST(request())).status).toBe(200)
    expect(db.review[operation]).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ familyMemberId: "child-a" }),
    }))
  })

  it("uses the same response for an unknown and another household's member", async () => {
    const unknown = await POST(request("missing-child"))
    const other = await POST(request("child-b"))
    expect(unknown.status).toBe(other.status)
    expect(await unknown.json()).toEqual(await other.json())
  })

  it.each([null, ""])("allows a review without a family-member attribution (%s)", async (id) => {
    db.review.findFirst.mockResolvedValue({ id: "existing-review", userId: "parent-a" })
    expect((await POST(request(id))).status).toBe(200)
    expect(db.familyMember.findFirst).not.toHaveBeenCalled()
    expect(db.review.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ familyMemberId: null }),
    }))
  })

  it.each([{}, [], 42, false])("rejects non-string member IDs before querying", async (id) => {
    expect((await POST(request(id))).status).toBe(400)
    expect(db.familyMember.findFirst).not.toHaveBeenCalled()
    expect(db.review.create).not.toHaveBeenCalled()
  })

  it("requires authentication", async () => {
    auth.mockResolvedValue(null)
    expect((await POST(request())).status).toBe(401)
    expect(db.familyMember.findFirst).not.toHaveBeenCalled()
  })
})
