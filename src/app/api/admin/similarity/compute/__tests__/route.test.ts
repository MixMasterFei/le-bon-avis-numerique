import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/cron-log", () => ({ logCronRun: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    mediaItem: { count: vi.fn(), findMany: vi.fn() },
    mediaSimilarity: { findUnique: vi.fn(), upsert: vi.fn() },
    $executeRaw: vi.fn(),
  },
}))

import { POST } from "../route"
import { logCronRun } from "@/lib/cron-log"
import { prisma } from "@/lib/prisma"
import { SIMILARITY_RECOMPUTE_DAYS } from "@/lib/similarity-rotation"

const db = vi.mocked(prisma, true)
const DAY = 86_400_000

interface FakeItem {
  id: string
  type: "MOVIE" | "TV" | "GAME"
  isEnriched: boolean
  similarityComputedAt: Date | null
}

/**
 * A tiny catalogue honouring the two things the rotation relies on: the
 * due/ordered selection and the raw-SQL stamp. Candidate lookups return
 * nothing — pair scoring is not what changed here.
 */
let catalogue: FakeItem[]
let computedLog: string[]

const isDue = (i: FakeItem) =>
  i.isEnriched &&
  (i.type === "MOVIE" || i.type === "TV") &&
  (i.similarityComputedAt === null || i.similarityComputedAt.getTime() < Date.now() - SIMILARITY_RECOMPUTE_DAYS * DAY)

function item(id: string, computedDaysAgo: number | null, over: Partial<FakeItem> = {}): FakeItem {
  return {
    id,
    type: "MOVIE",
    isEnriched: true,
    similarityComputedAt: computedDaysAgo === null ? null : new Date(Date.now() - computedDaysAgo * DAY),
    ...over,
  }
}

const call = (body: unknown, query = "") =>
  POST(new Request(`http://localhost/api/admin/similarity/compute${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }))

beforeEach(() => {
  vi.resetAllMocks()
  computedLog = []
  catalogue = [
    item("a3", null),
    item("a1", null),
    item("a2", null),
    item("a4", null, { type: "TV" }),
    item("a5", null),
    item("stale", SIMILARITY_RECOMPUTE_DAYS + 10),
    item("fresh", 10),
    item("not-enriched", null, { isEnriched: false }),
    item("game", null, { type: "GAME" }),
  ]

  db.mediaItem.count.mockImplementation((async (args: { where: { OR?: unknown } }) =>
    args.where.OR ? catalogue.filter(isDue).length : catalogue.filter((i) => i.isEnriched && i.type !== "GAME").length) as never)

  db.mediaItem.findMany.mockImplementation((async (args: {
    where: { id?: unknown; OR?: { similarityComputedAt: null | { lt: Date } }[] }
    orderBy?: unknown
    take: number
    skip?: number
  }) => {
    if (args.where.id) return [] // candidates of one item
    // The route must ask for exactly this: due titles, least recent first, no skip.
    expect(args.skip).toBeUndefined()
    expect(args.orderBy).toEqual([{ similarityComputedAt: { sort: "asc", nulls: "first" } }, { id: "asc" }])
    expect(args.where).toEqual({
      type: { in: ["MOVIE", "TV"] },
      isEnriched: true,
      OR: [{ similarityComputedAt: null }, { similarityComputedAt: { lt: expect.any(Date) } }],
    })
    const cutoff = (args.where.OR![1].similarityComputedAt as { lt: Date }).lt.getTime()
    expect(Math.abs(cutoff - (Date.now() - SIMILARITY_RECOMPUTE_DAYS * DAY))).toBeLessThan(60_000)
    return catalogue
      .filter(isDue)
      .sort((x, y) => {
        const tx = x.similarityComputedAt?.getTime() ?? -Infinity
        const ty = y.similarityComputedAt?.getTime() ?? -Infinity
        return tx - ty || x.id.localeCompare(y.id)
      })
      .slice(0, args.take)
      .map((i) => ({ id: i.id, title: i.id, type: i.type, genres: ["Drame"], topics: [], director: null, expertAgeRec: 12, contentMetrics: null }))
  }) as never)

  db.$executeRaw.mockImplementation((async (strings: TemplateStringsArray, ids: string[]) => {
    expect(strings.join("?")).toContain("SET similarity_computed_at = now()")
    for (const id of ids) {
      computedLog.push(id)
      catalogue.find((i) => i.id === id)!.similarityComputedAt = new Date()
    }
    return ids.length
  }) as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("POST /api/admin/similarity/compute — rotation", () => {
  it("successive calls cover every due title exactly once, never-computed first, then stop", async () => {
    const first = await (await call({ mode: "full", limit: 3 })).json()
    expect(computedLog).toEqual(["a1", "a2", "a3"])
    expect(first).toMatchObject({ done: false, items: 3, remaining: 3 })

    const second = await (await call({ mode: "full", limit: 3 })).json()
    expect(computedLog.slice(3)).toEqual(["a4", "a5", "stale"])
    expect(second).toMatchObject({ done: true, items: 3, remaining: 0 })

    const third = await (await call({ mode: "full", limit: 3 })).json()
    expect(third).toMatchObject({ done: true, items: 0, remaining: 0 })

    // Recently computed, non-enriched and game rows are never touched.
    expect(new Set(computedLog)).toEqual(new Set(["a1", "a2", "a3", "a4", "a5", "stale"]))
    expect(computedLog).toHaveLength(6)
  })

  it("ignores ?offset= / body offset — the old skip-based paging is gone", async () => {
    await call({ mode: "full", limit: 2, offset: 1000 }, "?offset=1000")
    expect(computedLog).toEqual(["a1", "a2"])
  })

  it("on a time bail, stamps only what was computed so the rest goes first next call", async () => {
    let clock = 1_000_000
    vi.spyOn(Date, "now").mockImplementation(() => clock)
    db.mediaItem.findMany.mockImplementationOnce((async () =>
      catalogue.filter((i) => i.id.startsWith("a")).sort((x, y) => x.id.localeCompare(y.id)).slice(0, 3)
        .map((i) => ({ id: i.id, title: i.id, type: i.type, genres: ["Drame"], topics: [], director: null, expertAgeRec: 12, contentMetrics: null }))) as never)
    // The first item's candidate query eats the whole 260 s budget.
    db.mediaItem.findMany.mockImplementationOnce((async () => { clock += 261_000; return [] }) as never)

    const json = await (await call({ mode: "full", limit: 3 })).json()

    expect(computedLog).toEqual(["a1"])
    expect(json).toMatchObject({ done: false, bailedOnTime: true, items: 1 })
    expect(logCronRun).toHaveBeenCalledWith(expect.objectContaining({ task: "similarity", status: "partial" }))
  })

  it("batch mode stamps the whole batch it compared", async () => {
    await call({ mode: "batch", limit: 4 })
    expect(computedLog).toEqual(["a1", "a2", "a3", "a4"])
  })
})
