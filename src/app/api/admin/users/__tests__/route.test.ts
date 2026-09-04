import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

// ---------------------------------------------------------------------------
// This endpoint hands out a role. Everything worth testing here is a refusal:
// the ways it must NOT be usable to widen access.
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { GET, PATCH } from "../route"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const mockedAuth = vi.mocked(auth)
const mockedPrisma = vi.mocked(prisma, true)

const BASE = "http://localhost/api/admin/users"

function asRole(role: string | null, id = "me") {
  mockedAuth.mockResolvedValue(role ? ({ user: { id, role } } as never) : (null as never))
}

function patch(body: unknown): NextRequest {
  return new NextRequest(BASE, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedPrisma.user.findMany.mockResolvedValue([] as never)
  mockedPrisma.user.findUnique.mockResolvedValue({ role: "USER" } as never)
  mockedPrisma.user.update.mockResolvedValue({
    id: "u1", name: "S", email: "s@x.fr", role: "MODERATOR",
  } as never)
})

describe("GET /api/admin/users", () => {
  it("refuses an anonymous caller", async () => {
    asRole(null)
    expect((await GET(new NextRequest(BASE))).status).toBe(403)
    expect(mockedPrisma.user.findMany).not.toHaveBeenCalled()
  })

  it("refuses a plain user", async () => {
    asRole("USER")
    expect((await GET(new NextRequest(BASE))).status).toBe(403)
  })

  // The important one: /steph is open to MODERATOR, so if this route used the
  // usual `ADMIN || MODERATOR` admin check, anyone with pilotage access could
  // read the whole account list and hand the role out further.
  it("refuses a MODERATOR — pilotage access must not confer account access", async () => {
    asRole("MODERATOR")
    expect((await GET(new NextRequest(BASE))).status).toBe(403)
    expect(mockedPrisma.user.findMany).not.toHaveBeenCalled()
  })

  it("lets an admin through", async () => {
    asRole("ADMIN")
    expect((await GET(new NextRequest(BASE))).status).toBe(200)
  })
})

describe("PATCH /api/admin/users", () => {
  it("refuses every caller that is not an admin", async () => {
    for (const role of [null, "USER", "MODERATOR"]) {
      asRole(role)
      const res = await PATCH(patch({ id: "u1", pilotage: true }))
      expect(res.status).toBe(403)
    }
    expect(mockedPrisma.user.update).not.toHaveBeenCalled()
  })

  it("validates the payload", async () => {
    asRole("ADMIN")
    expect((await PATCH(patch({}))).status).toBe(400)
    expect((await PATCH(patch({ id: "u1" }))).status).toBe(400)
    // A truthy string must not pass for a boolean.
    expect((await PATCH(patch({ id: "u1", pilotage: "yes" }))).status).toBe(400)
    expect(mockedPrisma.user.update).not.toHaveBeenCalled()
  })

  it("refuses to change your own role, so the last admin cannot lock himself out", async () => {
    asRole("ADMIN", "me")
    const res = await PATCH(patch({ id: "me", pilotage: false }))
    expect(res.status).toBe(400)
    expect(mockedPrisma.user.update).not.toHaveBeenCalled()
  })

  it("never touches an ADMIN account", async () => {
    asRole("ADMIN")
    mockedPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN" } as never)
    const res = await PATCH(patch({ id: "other-admin", pilotage: false }))
    expect(res.status).toBe(409)
    expect(mockedPrisma.user.update).not.toHaveBeenCalled()
  })

  it("404s on an unknown account rather than creating anything", async () => {
    asRole("ADMIN")
    mockedPrisma.user.findUnique.mockResolvedValue(null as never)
    expect((await PATCH(patch({ id: "ghost", pilotage: true }))).status).toBe(404)
    expect(mockedPrisma.user.update).not.toHaveBeenCalled()
  })

  it("grants exactly MODERATOR — never ADMIN", async () => {
    asRole("ADMIN")
    await PATCH(patch({ id: "u1", pilotage: true }))
    expect(mockedPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1" }, data: { role: "MODERATOR" } }),
    )
  })

  it("revokes back to USER", async () => {
    asRole("ADMIN")
    mockedPrisma.user.findUnique.mockResolvedValue({ role: "MODERATOR" } as never)
    await PATCH(patch({ id: "u1", pilotage: false }))
    expect(mockedPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: "USER" } }),
    )
  })

  it("never writes a role taken from the request body", async () => {
    asRole("ADMIN")
    await PATCH(patch({ id: "u1", pilotage: true, role: "ADMIN" }))
    const call = mockedPrisma.user.update.mock.calls.at(-1)?.[0] as { data: { role: string } }
    expect(call.data.role).toBe("MODERATOR")
  })
})
