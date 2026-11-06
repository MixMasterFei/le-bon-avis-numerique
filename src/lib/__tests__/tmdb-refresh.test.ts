import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: { mediaItem: { update: vi.fn() }, $executeRaw: vi.fn() },
}))
vi.mock("@/lib/tmdb", () => ({ getMovieDetails: vi.fn(), getTVDetails: vi.fn() }))

import {
  refreshFromTmdb,
  staleReleaseStatusWhere,
  tmdbRefreshPatch,
  zeroVoteRefreshWhere,
  type TmdbRefreshRow,
} from "@/lib/tmdb-refresh"
import { prisma } from "@/lib/prisma"
import { getMovieDetails, getTVDetails } from "@/lib/tmdb"

const db = vi.mocked(prisma, true)
const movieDetails = vi.mocked(getMovieDetails)
const tvDetails = vi.mocked(getTVDetails)

const NOW = new Date("2026-11-06T03:07:00Z")
const DAY = 86_400_000
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY)

// « Les Ensorceleuses 2 » as stored on 2026-11-06: imported pre-release,
// out since 2026-09-09, still "Post Production" with 0/0 votes.
const ensorceleuses: TmdbRefreshRow = {
  id: "m-ens2",
  title: "Les Ensorceleuses 2",
  type: "MOVIE",
  tmdbId: 1100099,
  releaseStatus: "Post Production",
  releaseDate: new Date("2026-09-09"),
  tmdbRating: 0,
  tmdbVoteCount: 0,
}

describe("tmdbRefreshPatch", () => {
  it("moves a released film out of its pre-release status and picks up its votes", () => {
    expect(tmdbRefreshPatch(ensorceleuses, { status: "Released", vote_average: 6.8, vote_count: 412 })).toEqual({
      releaseStatus: "Released",
      tmdbRating: 6.8,
      tmdbVoteCount: 412,
    })
  })

  it("writes nothing when TMDB has nothing new", () => {
    expect(tmdbRefreshPatch(ensorceleuses, { status: "Post Production", vote_average: 0, vote_count: 0 })).toEqual({})
  })

  it("never blanks a status TMDB didn't return", () => {
    expect(tmdbRefreshPatch(ensorceleuses, { status: "  ", vote_average: 0, vote_count: 0 })).toEqual({})
  })

  it("fills a missing release date (first_air_date for series) but never overwrites one", () => {
    const undatedTv = { ...ensorceleuses, type: "TV", releaseDate: null }
    expect(tmdbRefreshPatch(undatedTv, { status: "Post Production", first_air_date: "2027-03-01", vote_count: 0, vote_average: 0 }))
      .toEqual({ releaseDate: new Date("2027-03-01") })
    expect(tmdbRefreshPatch(ensorceleuses, { status: "Post Production", release_date: "2027-01-01", vote_count: 0, vote_average: 0 }))
      .toEqual({})
  })

  it("stores 0/0 for a never-rated title so it leaves the ratings queue", () => {
    const unrated = { ...ensorceleuses, tmdbRating: null, tmdbVoteCount: null, releaseStatus: null }
    expect(tmdbRefreshPatch(unrated, { status: "", vote_average: 0, vote_count: 0 })).toEqual({ tmdbRating: 0, tmdbVoteCount: 0 })
  })
})

describe("selection windows", () => {
  it("release status: overdue pre-release statuses daily, undated ones weekly", () => {
    const where = staleReleaseStatusWhere(NOW)
    expect(where).toMatchObject({
      type: { in: ["MOVIE", "TV"] },
      tmdbId: { not: null },
      releaseStatus: { in: ["Planned", "In Production", "Post Production", "Rumored"] },
    })
    expect(where.OR).toEqual([
      {
        releaseDate: { lte: NOW },
        OR: [{ tmdbCheckedAt: null }, { tmdbCheckedAt: { lt: new Date(NOW.getTime() - 20 * 3_600_000) } }],
      },
      { releaseDate: null, OR: [{ tmdbCheckedAt: null }, { tmdbCheckedAt: { lt: daysAgo(7) } }] },
    ])
  })

  it("zero votes: weekly inside 7–60 days after release, plus a one-time catch-up of rows never re-read", () => {
    const where = zeroVoteRefreshWhere(NOW)
    expect(where).toMatchObject({
      type: { in: ["MOVIE", "TV"] },
      tmdbId: { not: null },
      tmdbVoteCount: 0,
      releaseDate: { lte: daysAgo(7) },
    })
    expect(where.OR).toEqual([
      { tmdbCheckedAt: null },
      { releaseDate: { gte: daysAgo(60) }, tmdbCheckedAt: { lt: daysAgo(6) } },
    ])
  })
})

describe("refreshFromTmdb", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.mediaItem.update.mockResolvedValue({} as never)
    db.$executeRaw.mockResolvedValue(1 as never)
  })

  it("writes the changed fields plus the cursor, and reports the newly released title", async () => {
    movieDetails.mockResolvedValue({ status: "Released", vote_average: 6.8, vote_count: 412 } as never)

    const result = await refreshFromTmdb([ensorceleuses], { delayMs: 0 })

    expect(movieDetails).toHaveBeenCalledWith(1100099)
    expect(db.mediaItem.update).toHaveBeenCalledWith({
      where: { id: "m-ens2" },
      data: { releaseStatus: "Released", tmdbRating: 6.8, tmdbVoteCount: 412, tmdbCheckedAt: expect.any(Date) },
    })
    expect(result).toMatchObject({
      examined: 1,
      updated: 1,
      votesGained: 1,
      nowReleased: [{ id: "m-ens2", title: "Les Ensorceleuses 2", from: "Post Production", to: "Released" }],
    })
  })

  it("only moves the cursor (raw UPDATE, no updatedAt bump) when TMDB has nothing new", async () => {
    movieDetails.mockResolvedValue({ status: "Post Production", vote_average: 0, vote_count: 0 } as never)

    const result = await refreshFromTmdb([ensorceleuses], { delayMs: 0 })

    expect(db.mediaItem.update).not.toHaveBeenCalled()
    expect(db.$executeRaw).toHaveBeenCalledTimes(1)
    const [sql, id] = db.$executeRaw.mock.calls[0] as unknown as [TemplateStringsArray, string]
    expect(sql.join("?")).toContain("SET tmdb_checked_at = now()")
    expect(id).toBe("m-ens2")
    expect(result).toMatchObject({ examined: 1, unchanged: 1, updated: 0 })
  })

  it("reads series through the TV endpoint", async () => {
    tvDetails.mockResolvedValue({ status: "Returning Series", vote_average: 8, vote_count: 30 } as never)
    await refreshFromTmdb([{ ...ensorceleuses, type: "TV", tmdbId: 42 }], { delayMs: 0 })
    expect(tvDetails).toHaveBeenCalledWith(42)
    expect(movieDetails).not.toHaveBeenCalled()
  })

  it("drains a title deleted from TMDB: 0/0 for a never-rated row, cursor either way", async () => {
    movieDetails.mockRejectedValue(new Error("TMDB API error: 404 Not Found"))
    const unrated = { ...ensorceleuses, id: "gone", tmdbRating: null, tmdbVoteCount: null }

    const result = await refreshFromTmdb([unrated, ensorceleuses], { delayMs: 0 })

    expect(db.mediaItem.update).toHaveBeenCalledWith({
      where: { id: "gone" },
      data: { tmdbRating: 0, tmdbVoteCount: 0, tmdbCheckedAt: expect.any(Date) },
    })
    expect(db.$executeRaw).toHaveBeenCalledTimes(1) // the already-rated one: cursor only
    expect(result).toMatchObject({ notFound: 2, errors: 0 })
  })

  it("leaves a transient failure unstamped so the next run retries it", async () => {
    movieDetails.mockRejectedValue(new Error("TMDB request timeout after 10 seconds"))

    const result = await refreshFromTmdb([ensorceleuses], { delayMs: 0 })

    expect(db.mediaItem.update).not.toHaveBeenCalled()
    expect(db.$executeRaw).not.toHaveBeenCalled()
    expect(result).toMatchObject({ errors: 1, examined: 0 })
  })

  it("stops at the deadline instead of running past the function budget", async () => {
    const result = await refreshFromTmdb([ensorceleuses], { deadline: Date.now() - 1, delayMs: 0 })
    expect(movieDetails).not.toHaveBeenCalled()
    expect(result.bailedOnTime).toBe(true)
  })
})
