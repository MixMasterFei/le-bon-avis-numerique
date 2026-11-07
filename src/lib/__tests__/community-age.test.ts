// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const { prisma } = vi.hoisted(() => ({
  prisma: { review: { findMany: vi.fn() }, mediaItem: { update: vi.fn() } },
}))
vi.mock("@/lib/prisma", () => ({ prisma }))

import { MIN_COMMUNITY_AGE_VOTES, recomputeCommunityAge } from "@/lib/community-age"

beforeEach(() => vi.resetAllMocks())

describe("recomputeCommunityAge", () => {
  it("publishes the average once enough parents suggested an age", async () => {
    prisma.review.findMany.mockResolvedValue([{ ageSuggestion: 10 }, { ageSuggestion: 12 }, { ageSuggestion: 14 }])
    await recomputeCommunityAge("film-1")
    expect(prisma.review.findMany).toHaveBeenCalledWith({
      where: { mediaId: "film-1", ageSuggestion: { not: null } },
      select: { ageSuggestion: true },
    })
    expect(prisma.mediaItem.update).toHaveBeenCalledWith({ where: { id: "film-1" }, data: { communityAgeRec: 12 } })
  })

  it(`clears it below ${MIN_COMMUNITY_AGE_VOTES} suggestions`, async () => {
    prisma.review.findMany.mockResolvedValue([{ ageSuggestion: 10 }, { ageSuggestion: 12 }])
    await recomputeCommunityAge("film-1")
    expect(prisma.mediaItem.update).toHaveBeenCalledWith({ where: { id: "film-1" }, data: { communityAgeRec: null } })
  })

  it("runs on the client it is given (a transaction), not the global one", async () => {
    const tx = { review: { findMany: vi.fn().mockResolvedValue([]) }, mediaItem: { update: vi.fn() } }
    await recomputeCommunityAge("film-1", tx as never)
    expect(tx.mediaItem.update).toHaveBeenCalledOnce()
    expect(prisma.review.findMany).not.toHaveBeenCalled()
    expect(prisma.mediaItem.update).not.toHaveBeenCalled()
  })
})
