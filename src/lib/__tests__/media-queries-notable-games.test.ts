import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Prisma } from "@prisma/client"

// The homepage games row, end to end through fetchGames with the rail's own
// filters: no age cap, launches of the last ~60 days, Switch 2 counted as a
// console, ranked by notability × recency.

const db = vi.hoisted(() => ({
  findMany: vi.fn<(args: Prisma.MediaItemFindManyArgs) => Promise<unknown[]>>(async () => []),
  count: vi.fn(async () => 0),
}))

vi.mock("@/lib/prisma", () => ({ prisma: { mediaItem: { findMany: db.findMany, count: db.count } } }))
vi.mock("@/lib/prisma-retry", () => ({ withPrismaRetry: (run: () => unknown) => run() }))

import { CONSOLE_PLATFORMS, fetchGames } from "../media-queries"
import { GAMES_RAIL_FILTERS } from "../homepage-games-rail"

const today = new Date()
const daysAgo = (n: number) => new Date(today.getTime() - n * 24 * 3_600_000)

function game(title: string, age: number, releasedDaysAgo: number, votes: number, trending: number | null = null) {
  return {
    id: title.toLowerCase().replace(/\W+/g, "-"),
    tmdbId: null,
    igdbId: 1,
    title,
    originalTitle: null,
    type: "GAME",
    synopsisFr: null,
    posterUrl: `https://img/${title}.jpg`,
    backdropUrl: null,
    releaseDate: daysAgo(releasedDaysAgo),
    releaseStatus: null,
    duration: null,
    numberOfSeasons: null,
    director: null,
    genres: [],
    platforms: ["PS5"],
    topics: [],
    officialRating: null,
    expertAgeRec: age,
    communityAgeRec: null,
    contentMetrics: null,
    originalLanguage: null,
    dataQualityScore: 80,
    tmdbRating: null,
    tmdbVoteCount: votes,
    trendingScore: trending,
    trendingUpdatedAt: trending == null ? null : today,
    isEnriched: true,
    reviews: [],
  }
}

beforeEach(() => {
  db.findMany.mockReset()
  db.findMany.mockResolvedValue([
    game("Tape to Tape", 10, 35, 6),
    game("Sulfur", 12, 30, 6),
    game("Lightyear Frontier", 7, 24, 12),
    game("The Legend of Zelda: Ocarina of Time", 12, 22, 61),
    game("Grand Theft Auto VI", 18, 8, 54, 81),
  ])
})

describe("fetchGames sortBy=notable (homepage games row)", () => {
  it("asks for no age cap and only the launch window", async () => {
    await fetchGames({ ...GAMES_RAIL_FILTERS })
    const where = db.findMany.mock.calls[0][0].where as Prisma.MediaItemWhereInput
    expect(where.expertAgeRec).toEqual({ not: null })
    const release = where.releaseDate as { gte: Date; lte: Date }
    expect(today.getTime() - release.gte.getTime()).toBeGreaterThan(59 * 24 * 3_600_000)
    expect(today.getTime() - release.gte.getTime()).toBeLessThan(61 * 24 * 3_600_000)
    expect(release.lte.getTime()).toBeLessThanOrEqual(Date.now())
  })

  it("ranks GTA VI (18) and the Zelda remake ahead of the small releases", async () => {
    const { items } = await fetchGames({ ...GAMES_RAIL_FILTERS })
    expect(items.map((i) => i.title)).toEqual([
      "Grand Theft Auto VI",
      "The Legend of Zelda: Ocarina of Time",
      "Lightyear Frontier",
      "Sulfur",
      "Tape to Tape",
    ])
    expect(items[0].expertAgeRec).toBe(18)
  })

  it("counts Switch 2 as a console (the Zelda remake is Switch 2-only)", () => {
    expect(CONSOLE_PLATFORMS).toContain("Switch 2")
  })

  it("an explicit maxAge still caps the other callers", async () => {
    await fetchGames({ sortBy: "releaseDate", maxAge: 12 })
    const where = db.findMany.mock.calls[0][0].where as Prisma.MediaItemWhereInput
    expect(JSON.stringify(where)).toContain('"lte":12')
  })
})
