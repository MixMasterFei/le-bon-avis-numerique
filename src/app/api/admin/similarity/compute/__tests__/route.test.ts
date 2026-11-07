import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Prisma } from "@prisma/client"

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
  genres: string[]
}

/**
 * A tiny catalogue + similarity table honouring what the route relies on: the
 * due/ordered selection, the candidate lookup (same type, a shared genre), the
 * pair lookup/upsert and the raw-SQL stamp. Faults can be injected per step.
 */
let catalogue: FakeItem[]
let edges: Map<string, { source: string; score: number }>
let computedLog: string[]
let upserted: string[]

type Step = "candidates" | "lookup" | "upsert"
let faults: Array<{ step: Step; key: string | "*"; error: unknown; times: number }>

function failOn(step: Step, key: string | "*", error: unknown, times = 1) {
  faults.push({ step, key, error, times })
}

function injected(step: Step, key: string): unknown {
  const fault = faults.find((f) => f.step === step && f.times > 0 && (f.key === "*" || f.key === key))
  if (!fault) return undefined
  fault.times--
  return fault.error
}

const pairKey = (where: { mediaIdA_mediaIdB: { mediaIdA: string; mediaIdB: string } }) =>
  `${where.mediaIdA_mediaIdB.mediaIdA}|${where.mediaIdA_mediaIdB.mediaIdB}`

const poolTimeout = () =>
  new Prisma.PrismaClientKnownRequestError(
    "Invalid `prisma.mediaSimilarity.upsert()` invocation:\n\nTimed out fetching a new connection from the connection pool.",
    { code: "P2024", clientVersion: "5.22.0" },
  )
const uniqueConflict = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`media_id_a`,`media_id_b`)", {
    code: "P2002",
    clientVersion: "5.22.0",
  })

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
    genres: ["Drame"],
    ...over,
  }
}

const asRow = (i: FakeItem) => ({
  id: i.id, title: i.id, type: i.type, genres: i.genres, topics: [], director: null, expertAgeRec: 12, contentMetrics: null,
})

const call = (body: unknown, query = "") =>
  POST(new Request(`http://localhost/api/admin/similarity/compute${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }))

const lastLog = () => vi.mocked(logCronRun).mock.calls.at(-1)![0]

beforeEach(() => {
  vi.resetAllMocks()
  computedLog = []
  upserted = []
  faults = []
  edges = new Map()
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
    where: { id?: { not: string }; type?: string; genres?: { hasSome: string[] }; OR?: { similarityComputedAt: null | { lt: Date } }[] }
    orderBy?: unknown
    take: number
    skip?: number
  }) => {
    if (args.where.id) {
      // Candidates of one item: same type, enriched, at least one shared genre.
      const error = injected("candidates", args.where.id.not)
      if (error) throw error
      const shared = args.where.genres!.hasSome
      return catalogue
        .filter((i) => i.id !== args.where.id!.not && i.type === args.where.type && i.isEnriched)
        .filter((i) => i.genres.some((g) => shared.includes(g)))
        .map(asRow)
    }
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
      .map(asRow)
  }) as never)

  db.mediaSimilarity.findUnique.mockImplementation((async (args: { where: Parameters<typeof pairKey>[0] }) => {
    const key = pairKey(args.where)
    const error = injected("lookup", key)
    if (error) throw error
    const edge = edges.get(key)
    return edge ? { source: edge.source } : null
  }) as never)

  db.mediaSimilarity.upsert.mockImplementation((async (args: {
    where: Parameters<typeof pairKey>[0]
    create: { similarityScore: number; source: string }
  }) => {
    const key = pairKey(args.where)
    const error = injected("upsert", key)
    if (error) throw error
    upserted.push(key)
    edges.set(key, { source: args.create.source, score: args.create.similarityScore })
    return {}
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
      catalogue.filter((i) => i.id.startsWith("a")).sort((x, y) => x.id.localeCompare(y.id)).slice(0, 3).map(asRow)) as never)
    // The first item's candidate query eats the whole 260 s budget.
    db.mediaItem.findMany.mockImplementationOnce((async () => { clock += 261_000; return [] }) as never)

    const json = await (await call({ mode: "full", limit: 3 })).json()

    expect(computedLog).toEqual(["a1"])
    expect(json).toMatchObject({ done: false, bailedOnTime: true, items: 1, failedItems: 0 })
    expect(lastLog()).toMatchObject({ task: "similarity", status: "partial" })
  })

  it("batch mode stamps the whole batch it compared", async () => {
    await call({ mode: "batch", limit: 4 })
    expect(computedLog).toEqual(["a1", "a2", "a3", "a4"])
  })
})

describe("POST /api/admin/similarity/compute — failed writes", () => {
  // Three due films that resemble each other, one computed recently, and a
  // curated EXPERT edge (SEO maillage) between a1 and the recent one.
  beforeEach(() => {
    catalogue = [
      item("a1", null, { genres: ["Animation", "Famille"] }),
      item("a2", null, { genres: ["Animation", "Famille"] }),
      item("a3", null, { genres: ["Animation", "Famille"] }),
      item("fresh", 10, { genres: ["Animation", "Famille"] }),
    ]
    edges.set("a1|fresh", { source: "EXPERT", score: 0.9 })
  })

  const expertEdgeUntouched = () => {
    expect(edges.get("a1|fresh")).toEqual({ source: "EXPERT", score: 0.9 })
    expect(upserted).not.toContain("a1|fresh")
  }

  it("normal run: writes every edge, keeps the curated one, stamps all and reports success", async () => {
    const res = await call({ mode: "full", limit: 10 })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(computedLog).toEqual(["a1", "a2", "a3"])
    expect(new Set(upserted)).toEqual(new Set(["a1|a2", "a1|a3", "a2|a3", "a2|fresh", "a3|fresh"]))
    expertEdgeUntouched()
    expect(json).toMatchObject({ success: true, done: true, items: 3, failedItems: 0, errors: 0, keptCurated: 1 })
    expect(lastLog()).toMatchObject({
      task: "similarity",
      status: "success",
      details: expect.objectContaining({ failedItems: 0, errors: 0, keptCurated: 1, failures: [] }),
    })
  })

  it("a rejected upsert keeps the title due, reports partial, and the retry completes it", async () => {
    failOn("upsert", "a1|a3", poolTimeout())

    const first = await call({ mode: "full", limit: 10 })
    const firstJson = await first.json()

    // a1 failed mid-way: not stamped, still due. a2 and a3 completed.
    expect(computedLog).toEqual(["a2", "a3"])
    expect(catalogue.find((i) => i.id === "a1")!.similarityComputedAt).toBeNull()
    expect(first.status).toBe(200)
    expect(firstJson).toMatchObject({ success: true, done: false, items: 2, remaining: 1, failedItems: 1, errors: 1 })
    expect(lastLog()).toMatchObject({
      task: "similarity",
      status: "partial",
      summary: expect.stringContaining("1 titre en echec d'ecriture"),
      details: expect.objectContaining({
        failedItems: 1,
        errors: 1,
        done: false,
        failures: [{ id: "a1", title: "a1", step: "upsert", error: expect.stringContaining("P2024") }],
      }),
    })

    // The retry (next call of the Saturday loop) takes a1 first and completes it.
    const retry = await (await call({ mode: "full", limit: 10 })).json()
    expect(computedLog).toEqual(["a2", "a3", "a1"])
    expect(retry).toMatchObject({ success: true, done: true, items: 1, remaining: 0, failedItems: 0 })
    expect(lastLog()).toMatchObject({ status: "success" })
    expect(edges.get("a1|a3")).toMatchObject({ source: "ALGORITHM" })
    expertEdgeUntouched()
  })

  it("a rejected curated-edge lookup never falls through to an upsert", async () => {
    failOn("lookup", "a1|fresh", new Error("Connection terminated unexpectedly"))

    const json = await (await call({ mode: "full", limit: 10 })).json()

    expect(computedLog).toEqual(["a2", "a3"])
    expect(json).toMatchObject({ failedItems: 1, errors: 1, done: false })
    expect(lastLog()).toMatchObject({
      status: "partial",
      details: expect.objectContaining({
        failures: [{ id: "a1", title: "a1", step: "lookup", error: "Connection terminated unexpectedly" }],
      }),
    })
    expertEdgeUntouched()

    await call({ mode: "full", limit: 10 })
    expect(computedLog).toEqual(["a2", "a3", "a1"])
    expertEdgeUntouched()
  })

  it("a rejected candidate lookup keeps that title due without aborting the batch", async () => {
    failOn("candidates", "a2", new Error("Can't reach database server"))

    const json = await (await call({ mode: "full", limit: 10 })).json()

    expect(computedLog).toEqual(["a1", "a3"])
    expect(json).toMatchObject({ success: true, failedItems: 1, done: false })
    expect(lastLog()).toMatchObject({
      status: "partial",
      details: expect.objectContaining({ failures: [expect.objectContaining({ id: "a2", step: "candidates" })] }),
    })
  })

  it("treats a unique conflict (P2002, a concurrent writer) as harmless", async () => {
    failOn("upsert", "a1|a2", uniqueConflict())

    const json = await (await call({ mode: "full", limit: 10 })).json()

    expect(computedLog).toEqual(["a1", "a2", "a3"])
    expect(json).toMatchObject({ success: true, done: true, failedItems: 0, errors: 0, conflicts: 1 })
    expect(lastLog()).toMatchObject({ status: "success" })
  })

  it("reports an error (HTTP 500, nothing stamped) when no title of the batch could be completed", async () => {
    failOn("upsert", "*", poolTimeout(), Infinity)

    const res = await call({ mode: "full", limit: 10 })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(db.$executeRaw).not.toHaveBeenCalled()
    expect(json).toMatchObject({ success: false, done: false, items: 0, failedItems: 3, errors: 3 })
    expect(lastLog()).toMatchObject({
      task: "similarity",
      status: "error",
      details: expect.objectContaining({ failedItems: 3, items: 0 }),
    })
    expertEdgeUntouched()
  })

  it("batch mode: a failed pair leaves both of its titles due", async () => {
    failOn("upsert", "a1|a2", poolTimeout())

    const json = await (await call({ mode: "batch", limit: 3 })).json()

    expect(computedLog).toEqual(["a3"])
    expect(json).toMatchObject({ failedItems: 2, errors: 1, done: false })
    expect(lastLog()).toMatchObject({ status: "partial" })
  })
})
