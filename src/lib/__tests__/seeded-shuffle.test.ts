import { describe, expect, it } from "vitest"
import { weightedSeededOrder, seededShuffle } from "@/lib/seeded-shuffle"

describe("seededShuffle", () => {
  it("is deterministic for a given seed and varies across seeds", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8]
    expect(seededShuffle(arr, 42)).toEqual(seededShuffle(arr, 42))
    expect(seededShuffle(arr, 1)).not.toEqual(seededShuffle(arr, 2))
    // Pure — never mutates the input.
    expect(arr).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
})

describe("weightedSeededOrder (idées du jour rotation)", () => {
  const items = Array.from({ length: 40 }, (_, i) => ({ id: i, weight: (i % 10) + 1 }))
  const w = (it: { weight: number }) => it.weight

  it("is deterministic per seed", () => {
    expect(weightedSeededOrder(items, w, 7).map((i) => i.id)).toEqual(
      weightedSeededOrder(items, w, 7).map((i) => i.id),
    )
  })

  it("produces a genuinely different front selection across seeds (the staleness fix)", () => {
    // Different days (seeds) must not keep showing the same top titles.
    const days = [1, 2, 3, 4, 5].map((s) => weightedSeededOrder(items, w, s).slice(0, 6).map((i) => i.id))
    const uniqueDayOne = new Set(days[0])
    const overlaps = days.slice(1).map((d) => d.filter((id) => uniqueDayOne.has(id)).length)
    // At least one later day shares ≤ half its top-6 with day one — i.e. the
    // selection genuinely rotates rather than repeating.
    expect(Math.min(...overlaps)).toBeLessThanOrEqual(3)
  })

  it("still favours higher weights on average (relevance is preserved)", () => {
    // Over many seeds, high-weight items should reach the front far more often
    // than low-weight ones — variety, not randomness.
    const frontCounts = new Map<number, number>()
    for (let seed = 0; seed < 400; seed++) {
      for (const it of weightedSeededOrder(items, w, seed).slice(0, 6)) {
        frontCounts.set(it.weight, (frontCounts.get(it.weight) ?? 0) + 1)
      }
    }
    const heavy = frontCounts.get(10) ?? 0
    const light = frontCounts.get(1) ?? 0
    expect(heavy).toBeGreaterThan(light * 2)
    // …but a low-weight item is NOT permanently excluded (variety guarantee).
    expect(light).toBeGreaterThan(0)
  })

  it("never mutates the input array", () => {
    const snapshot = items.map((i) => i.id)
    weightedSeededOrder(items, w, 99)
    expect(items.map((i) => i.id)).toEqual(snapshot)
  })

  it("clamps non-positive weights instead of crashing", () => {
    const zeroed = [{ v: 0 }, { v: 5 }, { v: -3 }]
    expect(() => weightedSeededOrder(zeroed, (x) => x.v, 3)).not.toThrow()
    expect(weightedSeededOrder(zeroed, (x) => x.v, 3)).toHaveLength(3)
  })
})
