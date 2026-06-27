import { describe, expect, it } from "vitest"
import {
  CINEMA_TMDB_PAGES,
  cinemaReleaseBucketPriority,
  getCinemaReleaseBucket,
  isCinemaSort,
  selectUpcomingCinema,
} from "../cinema-policy"

type Mov = { id: number; original_language: string; release_date?: string | null }

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

describe("selectUpcomingCinema", () => {
  const now = new Date("2026-06-27T12:00:00.000Z")

  it("keeps only future French-theatrical releases, soonest first", () => {
    const movies: Mov[] = [
      { id: 1, original_language: "fr", release_date: "2026-08-15" },
      { id: 2, original_language: "en", release_date: "2026-07-10" },
    ]
    expect(selectUpcomingCinema(movies, new Set(), now).map((m) => m.id)).toEqual([2, 1])
  })

  it("excludes a film already in theaters even if its date is in the future (De Gaulle case)", () => {
    // "De Gaulle": carries a future re-release date (2026-07-03) but is already
    // playing now → present in now_playing, so it must NOT show as upcoming.
    const movies: Mov[] = [{ id: 42, original_language: "fr", release_date: "2026-07-03" }]
    expect(selectUpcomingCinema(movies, new Set([42]), now)).toEqual([])
  })

  it("drops already-released and dateless titles", () => {
    const movies: Mov[] = [
      { id: 3, original_language: "fr", release_date: "2026-06-01" }, // past
      { id: 4, original_language: "fr", release_date: "2026-06-27" }, // today → not upcoming
      { id: 5, original_language: "fr", release_date: null },
    ]
    expect(selectUpcomingCinema(movies, new Set(), now)).toEqual([])
  })

  it("drops non-European-language titles and de-duplicates by id", () => {
    const movies: Mov[] = [
      { id: 6, original_language: "ja", release_date: "2026-09-01" }, // dropped (lang)
      { id: 7, original_language: "fr", release_date: "2026-09-01" },
      { id: 7, original_language: "fr", release_date: "2026-09-01" }, // dup
    ]
    expect(selectUpcomingCinema(movies, new Set(), now).map((m) => m.id)).toEqual([7])
  })
})

