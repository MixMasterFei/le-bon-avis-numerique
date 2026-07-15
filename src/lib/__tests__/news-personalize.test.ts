import { describe, expect, it } from "vitest"
import {
  computeCategoryAffinity,
  personalizedRelevance,
  MAX_CATEGORY_BOOST,
  MIN_CATEGORY_BOOST,
} from "@/lib/news-personalize"

const like = (category: string) => ({ type: "LIKE", category })
const dislike = (category: string) => ({ type: "DISLIKE", category })

describe("computeCategoryAffinity", () => {
  it("boosts liked categories and demotes disliked ones", () => {
    const a = computeCategoryAffinity([like("FILM_TV"), like("FILM_TV"), dislike("TECH")])
    expect(a["FILM_TV"]).toBeGreaterThan(0)
    expect(a["TECH"]).toBeLessThan(0)
  })

  it("likes and dislikes net out symmetrically — contradictions read as neutral, not chaos", () => {
    // A news dislike is 'less of this', not a veto (unlike a disliked movie
    // genre). One like + one dislike on the same category cancels exactly.
    const a = computeCategoryAffinity([like("TECH"), dislike("TECH")])
    expect(a["TECH"]).toBe(0)
  })

  it("clamps to the bounded range — a category can be demoted, never censored", () => {
    const manyDislikes = Array.from({ length: 50 }, () => dislike("TECH"))
    const manyLikes = Array.from({ length: 50 }, () => like("FILM_TV"))
    const a = computeCategoryAffinity([...manyDislikes, ...manyLikes])
    expect(a["TECH"]).toBe(MIN_CATEGORY_BOOST)
    expect(a["FILM_TV"]).toBe(MAX_CATEGORY_BOOST)
    // The demotion is smaller than the 0..1 relevanceScore span: a
    // high-relevance story in a disliked category still outranks weak ones.
    expect(Math.abs(MIN_CATEGORY_BOOST)).toBeLessThan(0.5)
  })

  it("ignores unknown reaction types and empty categories", () => {
    const a = computeCategoryAffinity([
      { type: "SAVED", category: "TECH" },
      { type: "LIKE", category: "" },
    ])
    expect(a).toEqual({})
  })
})

describe("personalizedRelevance", () => {
  it("applies the category boost and defaults to neutral", () => {
    const affinity = { TECH: -0.2, FILM_TV: 0.1 }
    expect(personalizedRelevance(0.5, "TECH", affinity)).toBeCloseTo(0.3)
    expect(personalizedRelevance(0.5, "FILM_TV", affinity)).toBeCloseTo(0.6)
    expect(personalizedRelevance(0.5, "PARENTHOOD", affinity)).toBe(0.5)
    expect(personalizedRelevance(0.5, "TECH", null)).toBe(0.5)
    expect(personalizedRelevance(0.5, "TECH", undefined)).toBe(0.5)
  })

  it("reorders within a feed: a liked-category story overtakes a slightly more relevant neutral one", () => {
    const affinity = computeCategoryAffinity([like("FILM_TV"), like("FILM_TV"), like("FILM_TV")])
    const filmStory = personalizedRelevance(0.6, "FILM_TV", affinity)
    const neutralStory = personalizedRelevance(0.7, "TECH", affinity)
    expect(filmStory).toBeGreaterThan(neutralStory)
  })
})
