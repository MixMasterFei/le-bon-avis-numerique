import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: { mediaItem: { update: vi.fn() }, $executeRaw: vi.fn() },
}))
vi.mock("@/lib/tmdb", () => ({ getMovieDetails: vi.fn(), getTVDetails: vi.fn() }))

import {
  recentReleaseVotesWhere,
  refreshFromTmdb,
  staleReleaseStatusWhere,
  tmdbRefreshPatch,
  type TmdbRefreshRow,
} from "@/lib/tmdb-refresh"
import { prisma } from "@/lib/prisma"
import { getMovieDetails, getTVDetails } from "@/lib/tmdb"
import { matchesWhere } from "@/test/prisma-where"

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

  it("recent releases: weekly for 90 days, every four weeks until 365, retired at 500 votes, plus the zero-vote catch-up", () => {
    expect(recentReleaseVotesWhere(NOW)).toEqual({
      type: { in: ["MOVIE", "TV"] },
      tmdbId: { not: null },
      tmdbRating: { not: null },
      releaseDate: { lte: NOW },
      AND: [
        { OR: [{ tmdbVoteCount: null }, { tmdbVoteCount: { lt: 500 } }] },
        {
          OR: [
            { releaseDate: { gte: daysAgo(90) }, OR: [{ tmdbCheckedAt: null }, { tmdbCheckedAt: { lt: daysAgo(6) } }] },
            {
              releaseDate: { gte: daysAgo(365), lt: daysAgo(90) },
              OR: [{ tmdbCheckedAt: null }, { tmdbCheckedAt: { lt: daysAgo(27) } }],
            },
            { tmdbVoteCount: 0, tmdbCheckedAt: null },
          ],
        },
      ],
    })
  })
})

describe("recentReleaseVotesWhere — which rows are due", () => {
  const row = (over: Partial<TmdbRefreshRow & { tmdbCheckedAt: Date | null }>) => ({
    ...ensorceleuses,
    releaseStatus: "Released",
    tmdbRating: 6.1,
    tmdbVoteCount: 5,
    tmdbCheckedAt: null as Date | null,
    ...over,
  })
  const due = (over: Parameters<typeof row>[0]) => matchesWhere(row(over), recentReleaseVotesWhere(NOW) as Record<string, unknown>)

  it("keeps a released title with a few votes in the queue — it used to leave for good at its first vote", () => {
    expect(due({ releaseDate: daysAgo(20), tmdbVoteCount: 5, tmdbCheckedAt: daysAgo(7) })).toBe(true)
    expect(due({ releaseDate: daysAgo(20), tmdbVoteCount: 180, tmdbCheckedAt: daysAgo(7) })).toBe(true)
    expect(due({ releaseDate: daysAgo(20), tmdbVoteCount: 0, tmdbCheckedAt: daysAgo(7) })).toBe(true)
  })

  it("weekly in the first 90 days: not before six days, whatever the count", () => {
    expect(due({ releaseDate: daysAgo(20), tmdbCheckedAt: daysAgo(5) })).toBe(false)
    expect(due({ releaseDate: daysAgo(20), tmdbCheckedAt: daysAgo(6.5) })).toBe(true)
    expect(due({ releaseDate: daysAgo(2), tmdbCheckedAt: null })).toBe(true)
  })

  it("every four weeks from day 90 to day 365", () => {
    expect(due({ releaseDate: daysAgo(120), tmdbCheckedAt: daysAgo(7) })).toBe(false)
    expect(due({ releaseDate: daysAgo(120), tmdbCheckedAt: daysAgo(26) })).toBe(false)
    expect(due({ releaseDate: daysAgo(120), tmdbCheckedAt: daysAgo(28) })).toBe(true)
    expect(due({ releaseDate: daysAgo(364), tmdbCheckedAt: null })).toBe(true)
  })

  it("retires a title past 500 votes or past one year", () => {
    expect(due({ releaseDate: daysAgo(20), tmdbVoteCount: 499, tmdbCheckedAt: daysAgo(7) })).toBe(true)
    expect(due({ releaseDate: daysAgo(20), tmdbVoteCount: 500, tmdbCheckedAt: daysAgo(7) })).toBe(false)
    expect(due({ releaseDate: daysAgo(366), tmdbVoteCount: 40, tmdbCheckedAt: null })).toBe(false)
  })

  it("reads a zero-vote title never re-read since import once, whatever its age, then never again", () => {
    expect(due({ releaseDate: daysAgo(500), tmdbVoteCount: 0, tmdbCheckedAt: null })).toBe(true)
    expect(due({ releaseDate: daysAgo(500), tmdbVoteCount: 0, tmdbCheckedAt: daysAgo(30) })).toBe(false)
  })

  it("leaves never-rated rows, unreleased titles, games and rows without a TMDB id to others", () => {
    expect(due({ releaseDate: daysAgo(20), tmdbRating: null, tmdbVoteCount: null })).toBe(false)
    expect(due({ releaseDate: new Date(NOW.getTime() + 3 * DAY) })).toBe(false)
    expect(due({ releaseDate: null })).toBe(false)
    expect(due({ releaseDate: daysAgo(20), type: "GAME" })).toBe(false)
    expect(due({ releaseDate: daysAgo(20), tmdbId: null })).toBe(false)
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
