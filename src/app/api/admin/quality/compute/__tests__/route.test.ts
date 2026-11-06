import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mediaItem: { count: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock("@/lib/cron-log", () => ({ logCronRun: vi.fn() }))

import { POST } from "../route"
import { prisma } from "@/lib/prisma"
import { logCronRun } from "@/lib/cron-log"

const db = vi.mocked(prisma, true)
const BASE = "http://localhost/api/admin/quality/compute"

/** A fully complete fiche: computes to score 100, isEnriched true. */
function row(id: string, stored: { dataQualityScore: number; isEnriched: boolean }) {
  return {
    id,
    title: "Vice-versa",
    posterUrl: "https://cdn.example/p.jpg",
    backdropUrl: "https://cdn.example/b.jpg",
    synopsisFr: "x".repeat(80),
    releaseDate: new Date("2015-06-17"),
    genres: ["Animation"],
    officialRating: "TOUS_PUBLICS",
    expertAgeRec: 6,
    director: "Pete Docter",
    originalLanguage: "en",
    contentMetrics: { id: `cm-${id}` },
    screenshots: [{ id: "s" }],
    streamingAvailability: [{ id: "st" }],
    ...stored,
  }
}

function post(body: unknown, query = "") {
  return new NextRequest(`${BASE}${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  db.mediaItem.update.mockImplementation(((args: unknown) => ({ op: "update", args })) as never)
  db.$transaction.mockResolvedValue([] as never)
})

describe("POST /api/admin/quality/compute", () => {
  it("rewrites only the rows whose score or flag changed — never lastVerifiedAt", async () => {
    db.mediaItem.count.mockResolvedValue(3 as never)
    db.mediaItem.findMany.mockResolvedValue([
      row("unchanged", { dataQualityScore: 100, isEnriched: true }),
      row("score-moved", { dataQualityScore: 80, isEnriched: true }),
      row("also-unchanged", { dataQualityScore: 100, isEnriched: true }),
    ] as never)

    const res = await POST(post({ limit: 200, offset: 0 }))
    const json = await res.json()

    expect(db.mediaItem.update).toHaveBeenCalledTimes(1)
    expect(db.mediaItem.update).toHaveBeenCalledWith({ where: { id: "score-moved" }, data: { dataQualityScore: 100 } })
    expect(db.$transaction).toHaveBeenCalledTimes(1)
    expect((db.$transaction.mock.calls[0][0] as unknown as unknown[]).length).toBe(1)
    expect(json).toMatchObject({ processed: 3, updated: 1, unchanged: 2, done: true })
  })

  it("issues no write at all when nothing changed", async () => {
    db.mediaItem.count.mockResolvedValue(1 as never)
    db.mediaItem.findMany.mockResolvedValue([row("a", { dataQualityScore: 100, isEnriched: true })] as never)

    const json = await (await POST(post({}))).json()

    expect(db.mediaItem.update).not.toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(json.updated).toBe(0)
  })

  it("reads ?offset= (admin button) before the body offset (cron loop)", async () => {
    db.mediaItem.count.mockResolvedValue(1000 as never)
    db.mediaItem.findMany.mockResolvedValue([row("a", { dataQualityScore: 100, isEnriched: true })] as never)

    const json = await (await POST(post({ limit: 200, offset: 0 }, "?offset=400"))).json()

    expect(db.mediaItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 400, take: 200 }))
    expect(json.nextOffset).toBe(401)
  })

  it("carries the running total of rewritten rows into the final cron log", async () => {
    db.mediaItem.count.mockResolvedValue(2 as never)
    db.mediaItem.findMany.mockResolvedValue([
      row("a", { dataQualityScore: 10, isEnriched: false }),
      row("b", { dataQualityScore: 100, isEnriched: true }),
    ] as never)

    const json = await (await POST(post({ offset: 0, updatedSoFar: 41 }))).json()

    expect(json.updatedTotal).toBe(42)
    expect(logCronRun).toHaveBeenCalledWith(
      expect.objectContaining({ task: "quality", status: "success", details: expect.objectContaining({ updatedTotal: 42 }) }),
    )
  })

  it("logs only on the last batch", async () => {
    db.mediaItem.count.mockResolvedValue(5000 as never)
    db.mediaItem.findMany.mockResolvedValue([row("a", { dataQualityScore: 100, isEnriched: true })] as never)

    const json = await (await POST(post({ limit: 1, offset: 0 }))).json()

    expect(json.done).toBe(false)
    expect(logCronRun).not.toHaveBeenCalled()
  })
})
