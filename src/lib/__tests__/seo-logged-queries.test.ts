import { describe, expect, it } from "vitest"
import { LOGGED_QUERIES, toLoggedQueries, type StrikingQuery } from "../seo-striking-distance"

const q = (i: number): StrikingQuery => ({
  query: `film ${i} age`,
  page: `https://totemavise.com/media/movie:${i}`,
  position: 9.456,
  impressions: 100 - i,
  clicks: 2,
  ctr: 0.02,
  opportunity: 50 - i,
})

describe("toLoggedQueries", () => {
  it("keeps the query, the page path and rounded numbers, in the given order", () => {
    expect(toLoggedQueries([q(1)])).toEqual([
      { query: "film 1 age", page: "/media/movie:1", position: 9.5, impressions: 99, clicks: 2 },
    ])
  })

  it("caps the stored list", () => {
    const many = Array.from({ length: 80 }, (_, i) => q(i))
    expect(toLoggedQueries(many)).toHaveLength(LOGGED_QUERIES)
  })

  it("leaves a bare path as is", () => {
    expect(toLoggedQueries([{ ...q(2), page: "/media/tv:2" }])[0].page).toBe("/media/tv:2")
  })
})
