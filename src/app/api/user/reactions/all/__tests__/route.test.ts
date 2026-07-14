import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// The preload endpoint behind useUserReactions: one query returning the whole
// family's sparse reaction map, so poster bars show their saved state on
// load. If this endpoint lies (wrong scoping, wrong shape), marks silently
// vanish on refresh — which reads as data loss to a parent.
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    familyMember: { findMany: vi.fn() },
    mediaReaction: { findMany: vi.fn() },
  },
}))

import { GET } from "../route"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const mockedAuth = vi.mocked(auth)
const mockedPrisma = vi.mocked(prisma, true)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("GET /api/user/reactions/all", () => {
  it("returns an empty map (not an error) when logged out", async () => {
    mockedAuth.mockResolvedValue(null as never)
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ reactions: {} })
    expect(mockedPrisma.familyMember.findMany).not.toHaveBeenCalled()
  })

  it("returns an empty map when the user has no family members", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockedPrisma.familyMember.findMany.mockResolvedValue([])
    const res = await GET()
    expect(await res.json()).toEqual({ reactions: {} })
    expect(mockedPrisma.mediaReaction.findMany).not.toHaveBeenCalled()
  })

  it("builds the { mediaId: { memberId: reaction } } map, scoped to own members", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockedPrisma.familyMember.findMany.mockResolvedValue([{ id: "fm1" }, { id: "fm2" }] as never)
    mockedPrisma.mediaReaction.findMany.mockResolvedValue([
      { mediaId: "m1", familyMemberId: "fm1", reaction: "LOVED" },
      { mediaId: "m1", familyMemberId: "fm2", reaction: "WATCHED" },
      { mediaId: "m2", familyMemberId: "fm1", reaction: "WANTS_TO_WATCH" },
    ] as never)

    const res = await GET()
    const data = await res.json()
    expect(data.reactions).toEqual({
      m1: { fm1: "LOVED", fm2: "WATCHED" },
      m2: { fm1: "WANTS_TO_WATCH" },
    })

    // Family scoping: only the session user's members are queried…
    expect(mockedPrisma.familyMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    )
    // …and reactions are filtered to exactly those member ids.
    expect(mockedPrisma.mediaReaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { familyMemberId: { in: ["fm1", "fm2"] } },
      }),
    )
  })
})
