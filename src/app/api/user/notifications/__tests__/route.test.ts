import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

// ---------------------------------------------------------------------------
// The bell's write endpoints. The property that matters here is OWNERSHIP: the
// notification id arrives from the client, so every mutation has to carry
// userId in its WHERE clause or one account could read the count of — or
// delete — another account's notifications.
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { DELETE } from "../route"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const mockedAuth = vi.mocked(auth)
const mockedPrisma = vi.mocked(prisma, true)

const BASE = "http://localhost/api/user/notifications"

function loggedIn(userId = "user-1") {
  mockedAuth.mockResolvedValue({ user: { id: userId } } as never)
}

function deleteRequest(query: string): NextRequest {
  return new NextRequest(`${BASE}${query}`, { method: "DELETE" })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedPrisma.notification.deleteMany.mockResolvedValue({ count: 1 } as never)
  mockedPrisma.notification.count.mockResolvedValue(0 as never)
})

describe("DELETE /api/user/notifications", () => {
  it("refuses an anonymous caller", async () => {
    mockedAuth.mockResolvedValue(null as never)
    const res = await DELETE(deleteRequest("?id=notif-1"))
    expect(res.status).toBe(401)
    expect(mockedPrisma.notification.deleteMany).not.toHaveBeenCalled()
  })

  it("requires an id", async () => {
    loggedIn()
    const res = await DELETE(deleteRequest(""))
    expect(res.status).toBe(400)
    expect(mockedPrisma.notification.deleteMany).not.toHaveBeenCalled()
  })

  it("scopes the delete to the caller — never by id alone", async () => {
    loggedIn("user-1")
    const res = await DELETE(deleteRequest("?id=notif-1"))

    expect(res.status).toBe(200)
    // The guarantee: userId is part of the WHERE clause, so someone else's id
    // matches nothing. A bare `delete({ where: { id } })` would delete it.
    expect(mockedPrisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { id: "notif-1", userId: "user-1" },
    })
  })

  it("returns the same shape for a foreign id (no existence oracle)", async () => {
    loggedIn("user-1")
    mockedPrisma.notification.deleteMany.mockResolvedValue({ count: 0 } as never)
    mockedPrisma.notification.count.mockResolvedValue(3 as never)

    const res = await DELETE(deleteRequest("?id=someone-elses-notif"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ success: true, deleted: 0, unreadCount: 3 })
  })

  it("returns the refreshed unread count so the badge can resync", async () => {
    loggedIn()
    mockedPrisma.notification.count.mockResolvedValue(2 as never)
    const body = await (await DELETE(deleteRequest("?id=notif-1"))).json()
    expect(body.unreadCount).toBe(2)
  })

  it("survives a database failure with a 500 rather than throwing", async () => {
    loggedIn()
    mockedPrisma.notification.deleteMany.mockRejectedValue(new Error("db down") as never)
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const res = await DELETE(deleteRequest("?id=notif-1"))
    expect(res.status).toBe(500)
    spy.mockRestore()
  })
})
