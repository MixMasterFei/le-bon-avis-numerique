import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Prisma } from "@prisma/client"

// Offset pagination over a non-unique sort key let page 2 repeat titles from
// page 1 (and skip others): PostgreSQL orders tied rows differently for
// `LIMIT 10` and `LIMIT 10 OFFSET 10`. Caught by the Daily Filter Tests
// (« pagination: page 2 has different results than page 1 », 7 Nov 2026,
// failing on both attempts). Every catalogue listing must end on the unique id.

const db = vi.hoisted(() => ({
  findMany: vi.fn<(args: Prisma.MediaItemFindManyArgs) => Promise<unknown[]>>(async () => []),
  count: vi.fn(async () => 0),
}))

vi.mock("@/lib/prisma", () => ({ prisma: { mediaItem: { findMany: db.findMany, count: db.count } } }))
vi.mock("@/lib/prisma-retry", () => ({ withPrismaRetry: (run: () => unknown) => run() }))

import { fetchGames, fetchMangas, fetchMovies, fetchSeries, withStableOrder } from "../media-queries"

type OrderBy = Prisma.MediaItemOrderByWithRelationInput

function lastOrderBy(): OrderBy[] {
  const args = db.findMany.mock.calls.at(-1)?.[0]
  expect(args, "findMany was not called").toBeDefined()
  const orderBy = args!.orderBy
  expect(Array.isArray(orderBy), "orderBy must be a list ending on the unique id").toBe(true)
  return orderBy as OrderBy[]
}

function expectTotalOrder(orderBy: OrderBy[]) {
  expect(orderBy.at(-1)).toEqual({ id: "asc" })
  // The tiebreaker comes once, last — never in front of the real sort key.
  expect(orderBy.filter((key) => "id" in key)).toHaveLength(1)
  expect(orderBy.length).toBeGreaterThan(1)
}

const fetchers = {
  movies: fetchMovies,
  series: fetchSeries,
  games: fetchGames,
  mangas: fetchMangas,
} as const

const sorts = [undefined, "releaseDate", "title", "quality", "popularity"] as const

beforeEach(() => {
  db.findMany.mockClear()
  db.count.mockClear()
})

describe("withStableOrder", () => {
  it("appends the unique id to a single sort key", () => {
    expect(withStableOrder({ releaseDate: "desc" })).toEqual([{ releaseDate: "desc" }, { id: "asc" }])
  })

  it("appends the unique id after a compound sort, without mutating it", () => {
    const compound: OrderBy[] = [{ tmdbVoteCount: { sort: "desc", nulls: "last" } }, { dataQualityScore: "desc" }]
    const snapshot = structuredClone(compound)
    expect(withStableOrder(compound)).toEqual([...snapshot, { id: "asc" }])
    expect(compound).toEqual(snapshot)
  })
})

describe("catalogue listings are totally ordered (disjoint, stable pages)", () => {
  for (const [name, fetcher] of Object.entries(fetchers)) {
    for (const sortBy of sorts) {
      it(`${name} · sortBy=${sortBy ?? "(default)"} ends on the unique id`, async () => {
        await fetcher({ page: 2, limit: 10, sortBy })
        expectTotalOrder(lastOrderBy())
      })
    }
  }

  it("keeps each route's real primary sort in front of the tiebreaker", async () => {
    await fetchMovies({ page: 2, limit: 10 })
    expect(lastOrderBy()[0]).toEqual({ releaseDate: "desc" })

    await fetchMovies({ page: 2, limit: 10, sortBy: "title" })
    expect(lastOrderBy()[0]).toEqual({ title: "asc" })

    await fetchSeries({ page: 2, limit: 10 })
    expect(lastOrderBy()[0]).toEqual({ releaseDate: "desc" })

    await fetchGames({ page: 2, limit: 10 })
    expect(lastOrderBy()[0]).toEqual({ tmdbVoteCount: { sort: "desc", nulls: "last" } })
  })

  it("orders the weekly-shuffle candidate pool deterministically too", async () => {
    await fetchMovies({ page: 1, limit: 8, shuffle: "weekly" })
    expectTotalOrder(lastOrderBy())
  })
})
