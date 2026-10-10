import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// GET /api/user/settings is hit on every page load by SettingsContext. The
// first visit of a new account used to findUnique → create, so two concurrent
// requests both inserted and the loser failed with P2002 on user_id. The read
// must now be a single idempotent upsert that never overwrites a saved row.
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    familySettings: { upsert: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
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

describe("GET /api/user/settings", () => {
  it("returns safe defaults without touching the DB when signed out", async () => {
    mockedAuth.mockResolvedValue(null as never)

    const res = await GET()

    expect(await res.json()).toEqual({ settings: { blur18Plus: true } })
    expect(mockedPrisma.familySettings.upsert).not.toHaveBeenCalled()
  })

  it("reads-or-creates in one upsert that leaves an existing row untouched", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockedPrisma.familySettings.upsert.mockResolvedValue({ userId: "user-1", blur18Plus: false } as never)

    const res = await GET()

    expect(await res.json()).toEqual({ settings: { userId: "user-1", blur18Plus: false } })
    expect(mockedPrisma.familySettings.upsert).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      update: {},
      create: { userId: "user-1", blur18Plus: true },
    })
    // The racy find-then-create path is gone.
    expect(mockedPrisma.familySettings.findUnique).not.toHaveBeenCalled()
    expect(mockedPrisma.familySettings.create).not.toHaveBeenCalled()
  })
})
