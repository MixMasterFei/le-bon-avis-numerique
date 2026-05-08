import { describe, expect, it } from "vitest"
import { CINEMA_TMDB_PAGES, isCinemaSort } from "../cinema-policy"

describe("cinema policy", () => {
  it("fetches multiple now-playing pages for a broader cinema view", () => {
    expect(CINEMA_TMDB_PAGES).toEqual([1, 2, 3])
  })

  it("recognizes the cinema sort parameter", () => {
    expect(isCinemaSort("cinema")).toBe(true)
    expect(isCinemaSort("releaseDate")).toBe(false)
    expect(isCinemaSort(undefined)).toBe(false)
  })
})

