import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/cron-auth", () => ({ isCronOrAdminAuthorized: vi.fn() }))
vi.mock("@/lib/cron-log", () => ({ logCronRun: vi.fn() }))
vi.mock("@/lib/tmdb", () => ({ getMovieDetails: vi.fn(), getTVDetails: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    mediaItem: { findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    $executeRaw: vi.fn(),
  },
}))

import { POST } from "../route"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"
import { getMovieDetails } from "@/lib/tmdb"
import { prisma } from "@/lib/prisma"

const db = vi.mocked(prisma, true)
const BASE = "http://localhost/api/admin/refresh-release-status"
const post = (query = "") => new NextRequest(`${BASE}${query}`, { method: "POST" })

const stuck = [
  { id: "m1", title: "Les Ensorceleuses 2", type: "MOVIE", tmdbId: 1, releaseStatus: "Post Production", releaseDate: new Date("2026-09-09"), tmdbRating: 0, tmdbVoteCount: 0 },
  { id: "m2", title: "Toujours en tournage", type: "MOVIE", tmdbId: 2, releaseStatus: "In Production", releaseDate: new Date("2026-06-01"), tmdbRating: 0, tmdbVoteCount: 0 },
]

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(isCronOrAdminAuthorized).mockResolvedValue(true)
  db.mediaItem.findMany.mockResolvedValue(stuck as never)
  db.mediaItem.count.mockResolvedValue(0 as never)
  db.mediaItem.update.mockResolvedValue({} as never)
  db.$executeRaw.mockResolvedValue(1 as never)
  vi.mocked(getMovieDetails).mockImplementation((async (id: number) =>
    id === 1
      ? { status: "Released", vote_average: 6.8, vote_count: 412 }
      : { status: "In Production", vote_average: 0, vote_count: 0 }) as never)
})

describe("POST /api/admin/refresh-release-status", () => {
  it("refuses an unauthenticated caller", async () => {
    vi.mocked(isCronOrAdminAuthorized).mockResolvedValue(false)
    expect((await POST(post())).status).toBe(401)
    expect(db.mediaItem.findMany).not.toHaveBeenCalled()
  })

  it("re-reads overdue pre-release statuses, least recently checked first", async () => {
    await POST(post())
    const query = db.mediaItem.findMany.mock.calls[0][0] as { where: { releaseStatus: unknown }; orderBy: unknown[]; take: number }
    expect(query.where.releaseStatus).toEqual({ in: ["Planned", "In Production", "Post Production", "Rumored"] })
    expect(query.orderBy[0]).toEqual({ tmdbCheckedAt: { sort: "asc", nulls: "first" } })
    expect(query.take).toBe(80)
  })

  it("caps ?limit", async () => {
    await POST(post("?limit=5000"))
    expect((db.mediaItem.findMany.mock.calls[0][0] as { take: number }).take).toBe(200)
  })

  it("unblocks the titles TMDB now says are out, and only stamps the others", async () => {
    const json = await (await POST(post())).json()

    expect(db.mediaItem.update).toHaveBeenCalledTimes(1)
    expect(db.mediaItem.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "m1" },
      data: expect.objectContaining({ releaseStatus: "Released", tmdbCheckedAt: expect.any(Date) }),
    }))
    expect(db.$executeRaw).toHaveBeenCalledTimes(1) // m2: cursor only
    expect(json).toMatchObject({ success: true, examined: 2, updated: 1, unchanged: 1, remaining: 0, done: true })
    expect(json.nowReleased).toEqual([{ id: "m1", title: "Les Ensorceleuses 2", from: "Post Production", to: "Released" }])
    expect(logCronRun).toHaveBeenCalledWith(expect.objectContaining({
      task: "release-status",
      status: "success",
      summary: expect.stringContaining("1 titre désormais sorti"),
    }))
  })

  it("logs a partial run when TMDB fails on some titles", async () => {
    vi.mocked(getMovieDetails).mockRejectedValue(new Error("TMDB request timeout after 10 seconds"))
    db.mediaItem.count.mockResolvedValue(2 as never)

    const json = await (await POST(post())).json()

    expect(json).toMatchObject({ errors: 2, remaining: 2, done: false })
    expect(logCronRun).toHaveBeenCalledWith(expect.objectContaining({ task: "release-status", status: "partial" }))
  })
})
