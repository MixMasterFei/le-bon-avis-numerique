import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

// ---------------------------------------------------------------------------
// Deep tests for the reaction pipe's single write endpoint. Every reaction on
// the site — poster bars, fiche reactions, quiz anchors, member-corner
// corrections — flows through these three handlers, so they carry the whole
// personalization system. Auth, ownership, validation, the one-per-member
// state machine and the vector recompute are all asserted here.
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    familyMember: { findMany: vi.fn(), findFirst: vi.fn() },
    mediaItem: { findUnique: vi.fn() },
    mediaReaction: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
}))

vi.mock("@/lib/preference-vector/recompute", () => ({
  recomputeMemberVectorSafe: vi.fn().mockResolvedValue(undefined),
}))

import { GET, POST, DELETE } from "../route"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { recomputeMemberVectorSafe } from "@/lib/preference-vector/recompute"

const mockedAuth = vi.mocked(auth)
const mockedPrisma = vi.mocked(prisma, true)
const mockedRecompute = vi.mocked(recomputeMemberVectorSafe)

const BASE = "http://localhost/api/user/reaction"

function loggedIn(userId = "user-1") {
  mockedAuth.mockResolvedValue({ user: { id: userId } } as never)
}

function postRequest(body: unknown): NextRequest {
  return new NextRequest(BASE, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// GET — reactions of the whole family for one media
// ---------------------------------------------------------------------------

describe("GET /api/user/reaction", () => {
  it("401 when not authenticated", async () => {
    mockedAuth.mockResolvedValue(null as never)
    const res = await GET(new NextRequest(`${BASE}?mediaId=m1`))
    expect(res.status).toBe(401)
  })

  it("400 when mediaId is missing", async () => {
    loggedIn()
    const res = await GET(new NextRequest(BASE))
    expect(res.status).toBe(400)
  })

  it("returns every member with their reaction (or null) for the media", async () => {
    loggedIn()
    mockedPrisma.familyMember.findMany.mockResolvedValue([
      { id: "fm1", name: "Erwan", birthYear: 2011, birthMonth: null, avatarEmoji: "🦊", avatarStyle: null, avatarSeed: null, avatarOptions: null, reactions: [{ id: "r1", reaction: "LOVED", note: null }] },
      { id: "fm2", name: "Mathis", birthYear: 2013, birthMonth: null, avatarEmoji: "🐼", avatarStyle: null, avatarSeed: null, avatarOptions: null, reactions: [] },
    ] as never)

    const res = await GET(new NextRequest(`${BASE}?mediaId=m1`))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.familyMembers).toHaveLength(2)
    expect(data.familyMembers[0].reaction.reaction).toBe("LOVED")
    expect(data.familyMembers[1].reaction).toBeNull()
    // Scoped to the session user — never someone else's family
    expect(mockedPrisma.familyMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    )
  })
})

// ---------------------------------------------------------------------------
// POST — write / correct a reaction (upsert = per-member state machine)
// ---------------------------------------------------------------------------

describe("POST /api/user/reaction", () => {
  function ownershipOk() {
    mockedPrisma.familyMember.findFirst.mockResolvedValue({ id: "fm1", userId: "user-1" } as never)
    mockedPrisma.mediaItem.findUnique.mockResolvedValue({ id: "m1" } as never)
    mockedPrisma.mediaReaction.upsert.mockResolvedValue({ id: "r1" } as never)
  }

  it("401 when not authenticated", async () => {
    mockedAuth.mockResolvedValue(null as never)
    const res = await POST(postRequest({ familyMemberId: "fm1", mediaId: "m1", reaction: "LOVED" }))
    expect(res.status).toBe(401)
    expect(mockedPrisma.mediaReaction.upsert).not.toHaveBeenCalled()
  })

  it.each([
    [{ mediaId: "m1", reaction: "LOVED" }],
    [{ familyMemberId: "fm1", reaction: "LOVED" }],
    [{ familyMemberId: "fm1", mediaId: "m1" }],
  ])("400 when a required field is missing: %j", async (body) => {
    loggedIn()
    const res = await POST(postRequest(body))
    expect(res.status).toBe(400)
    expect(mockedPrisma.mediaReaction.upsert).not.toHaveBeenCalled()
  })

  it("404 when the member belongs to another account (ownership gate)", async () => {
    loggedIn()
    mockedPrisma.familyMember.findFirst.mockResolvedValue(null)
    const res = await POST(postRequest({ familyMemberId: "someone-elses-kid", mediaId: "m1", reaction: "LOVED" }))
    expect(res.status).toBe(404)
    // The ownership check MUST filter on the session's userId
    expect(mockedPrisma.familyMember.findFirst).toHaveBeenCalledWith({
      where: { id: "someone-elses-kid", userId: "user-1" },
    })
    expect(mockedPrisma.mediaReaction.upsert).not.toHaveBeenCalled()
  })

  it("404 when the media does not exist", async () => {
    loggedIn()
    mockedPrisma.familyMember.findFirst.mockResolvedValue({ id: "fm1" } as never)
    mockedPrisma.mediaItem.findUnique.mockResolvedValue(null)
    const res = await POST(postRequest({ familyMemberId: "fm1", mediaId: "ghost", reaction: "LOVED" }))
    expect(res.status).toBe(404)
    expect(mockedPrisma.mediaReaction.upsert).not.toHaveBeenCalled()
  })

  it.each([["SUPER"], ["loved"], ["DROP TABLE"], [""], [42]])(
    "400 when the reaction value is not in the allow-list: %j",
    async (bad) => {
      loggedIn()
      ownershipOk()
      const res = await POST(postRequest({ familyMemberId: "fm1", mediaId: "m1", reaction: bad }))
      expect(res.status).toBe(400)
      expect(mockedPrisma.mediaReaction.upsert).not.toHaveBeenCalled()
    },
  )

  it("accepts every canonical reaction type end-to-end", async () => {
    const { VALID_REACTIONS } = await import("@/lib/reaction-types")
    for (const reaction of VALID_REACTIONS) {
      vi.clearAllMocks()
      loggedIn()
      ownershipOk()
      const res = await POST(postRequest({ familyMemberId: "fm1", mediaId: "m1", reaction }))
      expect(res.status, `${reaction} should be accepted`).toBe(200)
      expect(mockedPrisma.mediaReaction.upsert).toHaveBeenCalledTimes(1)
    }
  })

  it("upserts on the [familyMemberId, mediaId] unique key — one state per member per title", async () => {
    loggedIn()
    ownershipOk()
    const res = await POST(postRequest({ familyMemberId: "fm1", mediaId: "m1", reaction: "WANTS_TO_WATCH" }))
    expect(res.status).toBe(200)

    const call = mockedPrisma.mediaReaction.upsert.mock.calls[0][0]
    // The where clause is the compound unique — this is what makes a new
    // reaction REPLACE the old one instead of stacking a duplicate row.
    expect(call.where).toEqual({
      familyMemberId_mediaId: { familyMemberId: "fm1", mediaId: "m1" },
    })
    // Both branches write the same reaction (create for first-touch,
    // update for a correction) — the state machine in one query.
    expect(call.create).toMatchObject({ reaction: "WANTS_TO_WATCH", source: "organic" })
    expect(call.update).toMatchObject({ reaction: "WANTS_TO_WATCH", source: "organic" })
  })

  it("recomputes the member's preference vector after every write", async () => {
    loggedIn()
    ownershipOk()
    await POST(postRequest({ familyMemberId: "fm1", mediaId: "m1", reaction: "LOVED" }))
    expect(mockedRecompute).toHaveBeenCalledExactlyOnceWith("fm1")
  })

  it("keeps quiz_anchor source but coerces anything else to organic", async () => {
    loggedIn()
    ownershipOk()
    await POST(postRequest({ familyMemberId: "fm1", mediaId: "m1", reaction: "LOVED", source: "quiz_anchor" }))
    expect(mockedPrisma.mediaReaction.upsert.mock.calls[0][0].create).toMatchObject({ source: "quiz_anchor" })

    vi.clearAllMocks()
    loggedIn()
    ownershipOk()
    await POST(postRequest({ familyMemberId: "fm1", mediaId: "m1", reaction: "LOVED", source: "admin_override" }))
    expect(mockedPrisma.mediaReaction.upsert.mock.calls[0][0].create).toMatchObject({ source: "organic" })
  })

  it("normalizes the free-text note as plain Unicode: verbatim text, control chars stripped, capped", async () => {
    loggedIn()
    ownershipOk()
    await POST(
      postRequest({
        familyMemberId: "fm1",
        mediaId: "m1",
        reaction: "SCARED",
        note: "il a eu peur à l'arrivée d'Ursula & co " + "a".repeat(600),
      }),
    )
    const note = mockedPrisma.mediaReaction.upsert.mock.calls[0][0].create.note as string
    // NOT HTML-escaped (React escapes at render; entities corrupt French
    // apostrophes) — but control chars gone and length capped.
    expect(note).toContain("l'arrivée d'Ursula & co")
    expect(note).not.toContain("&#x27;")
    expect(note.length).toBeLessThanOrEqual(500)

    vi.clearAllMocks()
    loggedIn()
    ownershipOk()
    await POST(postRequest({ familyMemberId: "fm1", mediaId: "m1", reaction: "LOVED", note: "   " }))
    expect(mockedPrisma.mediaReaction.upsert.mock.calls[0][0].create.note).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// DELETE — remove a reaction (member-corner "Retirer", poster-bar un-toggle)
// ---------------------------------------------------------------------------

describe("DELETE /api/user/reaction", () => {
  it("401 when not authenticated", async () => {
    mockedAuth.mockResolvedValue(null as never)
    const res = await DELETE(new NextRequest(`${BASE}?familyMemberId=fm1&mediaId=m1`))
    expect(res.status).toBe(401)
    expect(mockedPrisma.mediaReaction.deleteMany).not.toHaveBeenCalled()
  })

  it("400 when params are missing", async () => {
    loggedIn()
    expect((await DELETE(new NextRequest(`${BASE}?mediaId=m1`))).status).toBe(400)
    expect((await DELETE(new NextRequest(`${BASE}?familyMemberId=fm1`))).status).toBe(400)
    expect(mockedPrisma.mediaReaction.deleteMany).not.toHaveBeenCalled()
  })

  it("404 when the member belongs to another account", async () => {
    loggedIn()
    mockedPrisma.familyMember.findFirst.mockResolvedValue(null)
    const res = await DELETE(new NextRequest(`${BASE}?familyMemberId=not-mine&mediaId=m1`))
    expect(res.status).toBe(404)
    expect(mockedPrisma.mediaReaction.deleteMany).not.toHaveBeenCalled()
  })

  it("deletes exactly the [member, media] pair and recomputes the vector", async () => {
    loggedIn()
    mockedPrisma.familyMember.findFirst.mockResolvedValue({ id: "fm1" } as never)
    mockedPrisma.mediaReaction.deleteMany.mockResolvedValue({ count: 1 } as never)

    const res = await DELETE(new NextRequest(`${BASE}?familyMemberId=fm1&mediaId=m1`))
    expect(res.status).toBe(200)
    expect(mockedPrisma.mediaReaction.deleteMany).toHaveBeenCalledExactlyOnceWith({
      where: { familyMemberId: "fm1", mediaId: "m1" },
    })
    expect(mockedRecompute).toHaveBeenCalledExactlyOnceWith("fm1")
  })
})
