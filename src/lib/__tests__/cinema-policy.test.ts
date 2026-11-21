import { describe, expect, it } from "vitest"
import {
  CINEMA_TMDB_PAGES,
  cinemaRecencyFactor,
  cinemaReleaseBucketPriority,
  frenchCinemaScore,
  getCinemaReleaseBucket,
  isCinemaSort,
  isFrenchCinemaEligible,
  rankCinemaForFrance,
  selectUpcomingCinema,
} from "../cinema-policy"

type Mov = {
  id: number
  original_language: string
  release_date?: string | null
  genre_ids?: number[]
  vote_count?: number
}

describe("cinema policy", () => {
  it("fetches enough now-playing pages that French releases aren't cut off", () => {
    // A French week has ~80–120 films in theatres; three pages (60) dropped
    // French titles with a small worldwide audience before ranking.
    expect(CINEMA_TMDB_PAGES.length).toBeGreaterThanOrEqual(5)
    expect(CINEMA_TMDB_PAGES[0]).toBe(1)
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

  it("keeps an upcoming anime feature", () => {
    const movies: Mov[] = [{ id: 8, original_language: "ja", genre_ids: [16, 14], release_date: "2026-09-01" }]
    expect(selectUpcomingCinema(movies, new Set(), now).map((m) => m.id)).toEqual([8])
  })
})

describe("isFrenchCinemaEligible", () => {
  it("keeps European-language titles", () => {
    expect(isFrenchCinemaEligible({ original_language: "fr" })).toBe(true)
    expect(isFrenchCinemaEligible({ original_language: "en" })).toBe(true)
  })

  it("keeps anime features (Japanese / Korean / Chinese animation)", () => {
    expect(isFrenchCinemaEligible({ original_language: "ja", genre_ids: [16, 28] })).toBe(true)
    expect(isFrenchCinemaEligible({ original_language: "zh", genre_ids: [16] })).toBe(true)
  })

  it("drops non-European live action unless it is an established international hit", () => {
    // A Hindi epic trending in its home market, on a handful of Paris screens.
    expect(isFrenchCinemaEligible({ original_language: "hi", genre_ids: [18], vote_count: 42 })).toBe(false)
    expect(isFrenchCinemaEligible({ original_language: "ja", genre_ids: [18], vote_count: 80 })).toBe(false)
    expect(isFrenchCinemaEligible({ original_language: "ko", genre_ids: [53], vote_count: 18000 })).toBe(true)
  })
})

describe("French-relevance cinema ranking", () => {
  const now = new Date("2026-11-21T12:00:00.000Z")

  it("weights the week's releases above holdovers and dateless titles", () => {
    expect(cinemaRecencyFactor("2026-11-18", now)).toBe(1.35) // 3 days
    expect(cinemaRecencyFactor("2026-12-02", now)).toBe(1.15) // avant-première
    expect(cinemaRecencyFactor("2026-10-14", now)).toBe(1) // 38 days
    expect(cinemaRecencyFactor("2026-09-11", now)).toBe(0.8) // 71 days
    expect(cinemaRecencyFactor(null, now)).toBe(0.7)
  })

  it("scores a French production level with a foreign film ~9× more popular worldwide", () => {
    const fr = frenchCinemaScore({ popularity: 34, original_language: "fr", release_date: "2026-10-14" }, now)
    const en = frenchCinemaScore({ popularity: 300, original_language: "en", release_date: "2026-10-14" }, now)
    expect(Math.abs(fr - en)).toBeLessThan(0.15)
  })

  // Shaped on the 21 Nov 2026 now_playing FR list: popularity and vote counts
  // are the orders of magnitude TMDB reported that week, not exact values.
  const nowPlaying = [
    { id: 1, title: "Malfaisante", original_language: "en", release_date: "2026-10-07", popularity: 310, vote_count: 374 },
    { id: 2, title: "Hunger Games: Lever de soleil sur la moisson", original_language: "en", release_date: "2026-11-18", popularity: 260, vote_count: 19 },
    { id: 3, title: "Scrooge", original_language: "en", release_date: "2026-11-11", popularity: 140, vote_count: 6 },
    { id: 4, title: "Street Fighter", original_language: "en", release_date: "2026-10-14", popularity: 120, vote_count: 237 },
    { id: 5, title: "Clayface", original_language: "en", release_date: "2026-09-11", popularity: 95, vote_count: 300 },
    { id: 6, title: "Astérix : Le Royaume de Nubie", original_language: "fr", release_date: "2026-12-02", popularity: 45, vote_count: 0 },
    { id: 7, title: "Un film d'auteur", original_language: "fr", release_date: "2026-10-01", popularity: 3, vote_count: 4 },
  ]

  it("lifts a French family release out of the bottom of the list", () => {
    const ranked = rankCinemaForFrance(nowPlaying, now).map((m) => m.title)
    // Raw global popularity put Astérix 6th of 7, below the first visible row.
    expect(ranked.indexOf("Astérix : Le Royaume de Nubie")).toBeLessThanOrEqual(2)
    // The week's biggest release still leads.
    expect(ranked[0]).toBe("Hunger Games: Lever de soleil sur la moisson")
    // A tiny French art-house title is NOT promoted by the language boost alone.
    expect(ranked[ranked.length - 1]).toBe("Un film d'auteur")
    // An older holdover drops below the fresh releases.
    expect(ranked.indexOf("Clayface")).toBeGreaterThan(ranked.indexOf("Scrooge"))
  })

  it("is stable on TMDB's order for equal scores", () => {
    const twins = [
      { id: 10, original_language: "en", release_date: "2026-10-14", popularity: 50, vote_count: 10 },
      { id: 11, original_language: "en", release_date: "2026-10-14", popularity: 50, vote_count: 10 },
    ]
    expect(rankCinemaForFrance(twins, now).map((m) => m.id)).toEqual([10, 11])
  })
})

