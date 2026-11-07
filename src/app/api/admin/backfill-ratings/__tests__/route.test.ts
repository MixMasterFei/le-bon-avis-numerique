import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/cron-auth", () => ({ isCronOrAdminAuthorized: vi.fn() }))
vi.mock("@/lib/cron-log", () => ({ logCronRun: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: { mediaItem: { findMany: vi.fn(), count: vi.fn() } },
}))
// The per-title TMDB loop is covered in src/lib/__tests__/tmdb-refresh.test.ts;
// here only the queue logic matters (and the real loop sleeps 150 ms a title).
vi.mock("@/lib/tmdb-refresh", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb-refresh")>()),
  refreshFromTmdb: vi.fn(),
}))

import { POST } from "../route"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"
import { refreshFromTmdb, type TmdbRefreshResult } from "@/lib/tmdb-refresh"
import { prisma } from "@/lib/prisma"

const db = vi.mocked(prisma, true)
const refresh = vi.mocked(refreshFromTmdb)
const post = () => new NextRequest("http://localhost/api/admin/backfill-ratings", { method: "POST" })

const film = (id: string, over: Record<string, unknown> = {}) => ({
  id, title: id, type: "MOVIE", tmdbId: 1, releaseStatus: "Released",
  releaseDate: new Date("2026-10-01"), tmdbRating: 0, tmdbVoteCount: 0, ...over,
})

const result = (over: Partial<TmdbRefreshResult> = {}): TmdbRefreshResult => ({
  examined: 0, updated: 0, unchanged: 0, notFound: 0, errors: 0,
  nowReleased: [], votesGained: 0, bailedOnTime: false, ...over,
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(isCronOrAdminAuthorized).mockResolvedValue(true)
  db.mediaItem.findMany.mockResolvedValue([] as never)
  db.mediaItem.count.mockResolvedValue(0 as never)
  refresh.mockResolvedValue(result())
})

describe("POST /api/admin/backfill-ratings", () => {
  it("refuses an unauthenticated caller", async () => {
    vi.mocked(isCronOrAdminAuthorized).mockResolvedValue(false)
    expect((await POST(post())).status).toBe(401)
    expect(db.mediaItem.findMany).not.toHaveBeenCalled()
  })

  it("tops the batch up with recent releases once the never-rated queue is short", async () => {
    const unrated = film("unrated", { tmdbRating: null, tmdbVoteCount: null })
    const recent = film("recent", { tmdbRating: 6.2, tmdbVoteCount: 5 })
    db.mediaItem.findMany.mockResolvedValueOnce([unrated] as never).mockResolvedValueOnce([recent] as never)
    refresh.mockResolvedValue(result({ examined: 2, updated: 2, votesGained: 1 }))

    const json = await (await POST(post())).json()

    const [unratedQuery, recentQuery] = db.mediaItem.findMany.mock.calls.map((c) => c[0] as { where: Record<string, unknown>; take: number })
    expect(unratedQuery.where).toMatchObject({ tmdbRating: null })
    // Any vote count below the 500 ceiling, not only 0 (see recentReleaseVotesWhere).
    expect(recentQuery.where).toMatchObject({ tmdbRating: { not: null }, releaseDate: { lte: expect.any(Date) } })
    expect(recentQuery.where).not.toHaveProperty("tmdbVoteCount")
    expect(recentQuery.take).toBe(49)
    expect(refresh).toHaveBeenCalledWith([unrated, recent], expect.objectContaining({ delayMs: 150, deadline: expect.any(Number) }))
    expect(json).toMatchObject({ updated: 2, changed: 2, votesGained: 1 })
  })

  it("leaves the recent-release queue alone while the never-rated queue fills a whole batch", async () => {
    db.mediaItem.findMany.mockResolvedValueOnce(
      Array.from({ length: 50 }, (_, i) => film(`u${i}`, { tmdbRating: null, tmdbVoteCount: null })) as never,
    )
    await POST(post())
    expect(db.mediaItem.findMany).toHaveBeenCalledTimes(1)
  })

  it("counts a re-read that found no new votes as progress, so the Saturday loop drains instead of stopping", async () => {
    db.mediaItem.findMany.mockResolvedValueOnce([] as never).mockResolvedValueOnce([film("recent")] as never)
    refresh.mockResolvedValue(result({ examined: 1, unchanged: 1 }))

    const json = await (await POST(post())).json()

    // The workflow stops on `updated == 0 && unratable == 0`: a stamped
    // re-read must count, or one still-unvoted title would end the run.
    expect(json).toMatchObject({ updated: 1, changed: 0, unratable: 0 })
  })

  it("reports both queues in `remaining`", async () => {
    db.mediaItem.findMany.mockResolvedValueOnce([] as never).mockResolvedValueOnce([film("recent")] as never)
    db.mediaItem.count.mockResolvedValueOnce(3 as never).mockResolvedValueOnce(40 as never)
    refresh.mockResolvedValue(result({ examined: 1, updated: 1, votesGained: 1 }))

    const json = await (await POST(post())).json()

    expect(json).toMatchObject({ remaining: 43, remainingUnrated: 3, remainingRecent: 40 })
    expect(logCronRun).toHaveBeenCalledWith(expect.objectContaining({
      task: "backfill-ratings",
      status: "success",
      details: expect.objectContaining({ votesGained: 1, remaining: 43 }),
    }))
  })

  it("marks the run partial when TMDB failed on some titles", async () => {
    db.mediaItem.findMany.mockResolvedValueOnce([film("u", { tmdbRating: null })] as never)
    refresh.mockResolvedValue(result({ errors: 1 }))
    await POST(post())
    expect(logCronRun).toHaveBeenCalledWith(expect.objectContaining({ task: "backfill-ratings", status: "partial" }))
  })

  it("does nothing when both queues are empty", async () => {
    const json = await (await POST(post())).json()
    expect(refresh).not.toHaveBeenCalled()
    expect(json).toMatchObject({ updated: 0, remaining: 0 })
  })
})
