import { beforeEach, describe, expect, it, vi } from "vitest"

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { mediaItem: { findMany } } }))
vi.mock("@/lib/prisma-retry", () => ({ withPrismaRetry: (fn: () => Promise<unknown>) => fn() }))

import { fetchTopGameRows } from "@/app/jeux/quel-age/gamesAgeData"

function game(id: string, title: string, dataQualityScore = 80) {
  return { id, title, dataQualityScore, posterUrl: "https://example.com/poster.jpg", expertAgeRec: 10, officialRating: "PEGI 7", contentMetrics: null }
}

beforeEach(() => { findMany.mockReset() })

describe("games age guide catalogue resolution", () => {
  it("uses exact database predicates and never publishes The Wolf Among Us as Among Us", async () => {
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      game("wolf", "The Wolf Among Us", 100),
      game("among", "Among Us", 60),
    ])
    const rows = await fetchTopGameRows()
    expect(rows.find((row) => row.seed.key === "among-us")?.id).toBe("among")
    const query = findMany.mock.calls[1][0]
    expect(query.where.OR).toContainEqual({ title: { equals: "among us", mode: "insensitive" } })
    expect(query.where.OR.every((clause: { title: object }) => !Object.hasOwn(clause.title, "contains"))).toBe(true)
  })

  it("omits a missing title instead of linking a better-enriched substring match", async () => {
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([game("wolf", "The Wolf Among Us")])
    expect(await fetchTopGameRows()).toEqual([])
  })

  it("names the actual release when showing a franchise's age recommendation", async () => {
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([game("kart8", "Mario Kart 8 Deluxe")])
    const [row] = await fetchTopGameRows()
    expect(row.seed.key).toBe("mario-kart")
    expect(row.seed.name).toBe("Mario Kart 8 Deluxe")
    expect(row.id).toBe("kart8")
  })
})
