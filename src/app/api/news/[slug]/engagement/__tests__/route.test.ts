import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

// Focused tests for the reaction+reason path of the news engagement route —
// the write side of the reader-feedback loop that trains news-discover.

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    newsStory: { findUnique: vi.fn() },
    newsStoryReaction: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    newsSavedStory: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  },
}))

import { POST } from "../route"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const mockedAuth = vi.mocked(auth)
const mockedPrisma = vi.mocked(prisma, true)

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/news/some-story/engagement", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

const ctx = { params: Promise.resolve({ slug: "some-story" }) }

beforeEach(() => {
  vi.clearAllMocks()
  mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
  mockedPrisma.newsStory.findUnique.mockResolvedValue({ id: "story-1" } as never)
  mockedPrisma.newsStoryReaction.findUnique.mockResolvedValue(null)
  mockedPrisma.newsStoryReaction.count.mockResolvedValue(0 as never)
  mockedPrisma.newsSavedStory.findUnique.mockResolvedValue(null)
})

describe("POST /api/news/[slug]/engagement — reaction + reason", () => {
  it("401 when not authenticated", async () => {
    mockedAuth.mockResolvedValue(null as never)
    const res = await POST(req({ action: "reaction", type: "DISLIKE" }), ctx)
    expect(res.status).toBe(401)
  })

  it("400 on an invalid reaction type", async () => {
    const res = await POST(req({ action: "reaction", type: "MEH" }), ctx)
    expect(res.status).toBe(400)
    expect(mockedPrisma.newsStoryReaction.upsert).not.toHaveBeenCalled()
  })

  it("stores a DISLIKE with a vocabulary reason and a plain-text note (control chars stripped, capped)", async () => {
    const res = await POST(
      req({
        action: "reaction",
        type: "DISLIKE",
        reasonCode: "anxiogene",
        reasonNote: "l'article  d'O'Connor & fils " + "x".repeat(400),
      }),
      ctx,
    )
    expect(res.status).toBe(200)
    const call = mockedPrisma.newsStoryReaction.upsert.mock.calls[0][0]
    expect(call.create).toMatchObject({ type: "DISLIKE", reasonCode: "anxiogene" })
    const note = call.create.reasonNote as string
    // Plain Unicode preserved verbatim — apostrophes and & must NOT become
    // HTML entities (React escapes at render; entities corrupt French text).
    expect(note).toContain("d'O'Connor & fils")
    expect(note).not.toContain("")
    expect(note).not.toContain("&#x27;")
    expect(note.length).toBeLessThanOrEqual(200)
  })

  it.each([["DROP TABLE"], ["toString"], ["__proto__"], ["constructor"]])(
    "drops the out-of-vocabulary reason code %j but keeps the dislike",
    async (bad) => {
      await POST(req({ action: "reaction", type: "DISLIKE", reasonCode: bad }), ctx)
      const call = mockedPrisma.newsStoryReaction.upsert.mock.calls[0][0]
      expect(call.create).toMatchObject({ type: "DISLIKE", reasonCode: null })
    },
  )

  it("ignores reasons sent with a LIKE", async () => {
    await POST(req({ action: "reaction", type: "LIKE", reasonCode: "anxiogene", reasonNote: "x" }), ctx)
    const call = mockedPrisma.newsStoryReaction.upsert.mock.calls[0][0]
    expect(call.create).toMatchObject({ type: "LIKE", reasonCode: null, reasonNote: null })
  })

  it("toggles off on an explicit remove:true", async () => {
    mockedPrisma.newsStoryReaction.findUnique.mockResolvedValue({ id: "r1", type: "DISLIKE" } as never)
    await POST(req({ action: "reaction", type: "DISLIKE", remove: true }), ctx)
    expect(mockedPrisma.newsStoryReaction.deleteMany).toHaveBeenCalledWith({
      where: { newsStoryId: "story-1", userId: "user-1" },
    })
    expect(mockedPrisma.newsStoryReaction.upsert).not.toHaveBeenCalled()
  })

  it("legacy clients (no remove flag): same reasonless reaction still toggles off", async () => {
    mockedPrisma.newsStoryReaction.findUnique.mockResolvedValue({ id: "r1", type: "DISLIKE" } as never)
    await POST(req({ action: "reaction", type: "DISLIKE" }), ctx)
    expect(mockedPrisma.newsStoryReaction.deleteMany).toHaveBeenCalled()
    expect(mockedPrisma.newsStoryReaction.upsert).not.toHaveBeenCalled()
  })

  it("remove:false with same type does NOT toggle off (the race guard) and preserves the stored reason", async () => {
    // The exact race GPT flagged: the reason request landed first and created
    // the row; the reasonless dislike request arrives after. With explicit
    // remove:false it must neither delete the row nor wipe the reason.
    mockedPrisma.newsStoryReaction.findUnique.mockResolvedValue(
      { id: "r1", type: "DISLIKE", reasonCode: "anxiogene", reasonNote: "note" } as never,
    )
    await POST(req({ action: "reaction", type: "DISLIKE", remove: false }), ctx)
    expect(mockedPrisma.newsStoryReaction.deleteMany).not.toHaveBeenCalled()
    const call = mockedPrisma.newsStoryReaction.upsert.mock.calls[0][0]
    // Reason fields absent from the update — the stored reason survives.
    expect(call.update).toEqual({ type: "DISLIKE" })
  })

  it("upgrades an existing DISLIKE in place when a reason arrives afterwards", async () => {
    mockedPrisma.newsStoryReaction.findUnique.mockResolvedValue({ id: "r1", type: "DISLIKE" } as never)
    await POST(req({ action: "reaction", type: "DISLIKE", reasonCode: "not_family" }), ctx)
    expect(mockedPrisma.newsStoryReaction.delete).not.toHaveBeenCalled()
    expect(mockedPrisma.newsStoryReaction.deleteMany).not.toHaveBeenCalled()
    const call = mockedPrisma.newsStoryReaction.upsert.mock.calls[0][0]
    expect(call.update).toMatchObject({ type: "DISLIKE", reasonCode: "not_family" })
  })

  it("switching type clears the stale reason", async () => {
    mockedPrisma.newsStoryReaction.findUnique.mockResolvedValue(
      { id: "r1", type: "DISLIKE", reasonCode: "anxiogene", reasonNote: "x" } as never,
    )
    await POST(req({ action: "reaction", type: "LIKE", remove: false }), ctx)
    const call = mockedPrisma.newsStoryReaction.upsert.mock.calls[0][0]
    expect(call.update).toEqual({ type: "LIKE", reasonCode: null, reasonNote: null })
  })

  it("only a missing-column error triggers the reasonless retry; other DB errors bubble", async () => {
    mockedPrisma.newsStoryReaction.findUnique.mockResolvedValue(null)
    mockedPrisma.newsStoryReaction.upsert.mockRejectedValueOnce(new Error("connection reset"))
    const res = await POST(
      req({ action: "reaction", type: "DISLIKE", reasonCode: "not_family" }),
      ctx,
    )
    // Real failure → 500, and NO silent retry that would drop the reason.
    expect(res.status).toBe(500)
    expect(mockedPrisma.newsStoryReaction.upsert).toHaveBeenCalledTimes(1)
  })

  it("404 when the story slug is unknown", async () => {
    mockedPrisma.newsStory.findUnique.mockResolvedValue(null)
    const res = await POST(req({ action: "reaction", type: "LIKE" }), ctx)
    expect(res.status).toBe(404)
  })
})
