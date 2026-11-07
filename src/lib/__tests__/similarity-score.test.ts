import { describe, expect, it } from "vitest"
import { ageProximityScore, computeArrayOverlap, computeSimilarity, type MediaForComparison } from "@/lib/similarity-score"

const film = (id: string, over: Partial<MediaForComparison> = {}): MediaForComparison => ({
  id,
  title: id,
  type: "MOVIE",
  genres: ["Animation", "Famille"],
  topics: ["Amitié"],
  director: null,
  expertAgeRec: 6,
  contentMetrics: null,
  ...over,
})

describe("ageProximityScore", () => {
  it("keeps the documented anchors: same age 1, two years 0.5, four years 0.25, six years and more 0", () => {
    expect(ageProximityScore(0)).toBe(1)
    expect(ageProximityScore(2)).toBe(0.5)
    expect(ageProximityScore(4)).toBe(0.25)
    expect(ageProximityScore(6)).toBe(0)
    expect(ageProximityScore(12)).toBe(0)
  })

  it("never rises when the gap widens, and strictly falls until it reaches 0", () => {
    // The old formula scored 2 → 0.5, 3 → 0.7, 4 → 0.6.
    for (let gap = 0; gap < 18; gap++) {
      const here = ageProximityScore(gap)
      const next = ageProximityScore(gap + 1)
      expect(next).toBeLessThanOrEqual(here)
      if (here > 0) expect(next).toBeLessThan(here)
    }
  })

  it("is symmetric and stays within [0, 1]", () => {
    for (let gap = -18; gap <= 18; gap++) {
      expect(ageProximityScore(gap)).toBe(ageProximityScore(-gap))
      expect(ageProximityScore(gap)).toBeGreaterThanOrEqual(0)
      expect(ageProximityScore(gap)).toBeLessThanOrEqual(1)
    }
  })
})

describe("computeSimilarity", () => {
  it("scores a pair lower as the age gap widens, everything else equal", () => {
    const base = film("base", { expertAgeRec: 6 })
    const scores = [0, 1, 2, 3, 4, 5, 6, 8].map((gap) => computeSimilarity(base, film(`+${gap}`, { expertAgeRec: 6 + gap })).score)
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeLessThanOrEqual(scores[i - 1])
    expect(scores[3]).toBeLessThan(scores[2]) // 3 years apart is no longer "closer" than 2
  })

  it("flags similar_age_rec only within two years", () => {
    expect(computeSimilarity(film("a"), film("b", { expertAgeRec: 8 })).reasons).toContain("similar_age_rec")
    expect(computeSimilarity(film("a"), film("b", { expertAgeRec: 9 })).reasons).not.toContain("similar_age_rec")
  })

  it("ignores age when either title has none", () => {
    const withAge = computeSimilarity(film("a"), film("b"))
    const noAge = computeSimilarity(film("a"), film("b", { expertAgeRec: null }))
    expect(noAge.reasons).not.toContain("similar_age_rec")
    expect(noAge.score).toBeLessThan(withAge.score)
  })
})

describe("computeArrayOverlap", () => {
  it("is a case-insensitive Jaccard index", () => {
    expect(computeArrayOverlap(["Drame", "Comédie"], ["drame", "Action"])).toBeCloseTo(1 / 3)
    expect(computeArrayOverlap([], ["Drame"])).toBe(0)
  })
})
