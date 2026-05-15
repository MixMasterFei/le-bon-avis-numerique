import { describe, expect, it } from "vitest"
import {
  CINEMA_TMDB_PAGES,
  cinemaReleaseBucketPriority,
  getCinemaReleaseBucket,
  isCinemaSort,
} from "../cinema-policy"

describe("cinema policy", () => {
  it("fetches multiple now-playing pages for a broader cinema view", () => {
    expect(CINEMA_TMDB_PAGES).toEqual([1, 2, 3])
  })

  it("recognizes the cinema sort parameter", () => {
    expect(isCinemaSort("cinema")).toBe(true)
    expect(isCinemaSort("releaseDate")).toBe(false)
    expect(isCinemaSort(undefined)).toBe(false)
  })

  it("classifies older theatrical entries as reissues instead of dropping them", () => {
    const now = new Date("2026-05-15T12:00:00.000Z")

    expect(getCinemaReleaseBucket("2026-05-01", now)).toBe("recent")
    expect(getCinemaReleaseBucket("2026-06-01", now)).toBe("upcoming")
    expect(getCinemaReleaseBucket("2026-01-15", now)).toBe("holdover")
    expect(getCinemaReleaseBucket("2022-05-25", now)).toBe("reissue")
    expect(getCinemaReleaseBucket(null, now)).toBe("unknown")
  })

  it("prioritizes recent releases ahead of reissues for homepage slicing", () => {
    expect(cinemaReleaseBucketPriority("recent")).toBeLessThan(
      cinemaReleaseBucketPriority("reissue"),
    )
  })
})

