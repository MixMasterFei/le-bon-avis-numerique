// @vitest-environment node
import { describe, expect, it } from "vitest"
import {
  GAME_THRESHOLDS,
  TV_GENRE,
  buildTitleIndex,
  compactForLog,
  normalizeTitle,
  parseApprovedIds,
  qualifyGame,
  qualifyTvShow,
  resolveFrPlatformGroups,
  selectGameCandidates,
  selectTvCandidates,
  type TvDiscoverPage,
} from "@/lib/import-candidates"
import type { IGDBGame } from "@/lib/igdb"
import type { TMDBTVShow } from "@/lib/tmdb"

const TODAY = "2026-11-15"
const NOW_SEC = Math.floor(Date.parse("2026-11-15T00:00:00Z") / 1000)

function show(over: Partial<TMDBTVShow> & { id: number }): TMDBTVShow {
  return {
    name: `Série ${over.id}`,
    original_name: `Show ${over.id}`,
    original_language: "en",
    overview: "Une aventure pour toute la famille.",
    poster_path: null,
    backdrop_path: null,
    first_air_date: "2020-01-01",
    vote_average: 7,
    vote_count: 50,
    genre_ids: [TV_GENRE.KIDS, TV_GENRE.ANIMATION],
    popularity: 20,
    ...over,
  }
}

const PEGI = (cat: number) => [{ organization: 2, rating_category: cat }]

function game(over: Partial<IGDBGame> & { id: number }): IGDBGame {
  return {
    name: `Jeu ${over.id}`,
    first_release_date: NOW_SEC - 86400 * 400,
    platforms: [{ id: 130, name: "Nintendo Switch", abbreviation: "Switch" }],
    age_ratings: PEGI(9), // PEGI 7
    total_rating_count: 120,
    ...over,
  } as IGDBGame
}

describe("resolveFrPlatformGroups", () => {
  it("matches renamed French apps and leaves channel add-ons out", () => {
    const groups = resolveFrPlatformGroups([
      { provider_id: 8, provider_name: "Netflix", logo_path: "", display_priority: 1 },
      { provider_id: 1796, provider_name: "Netflix basic with Ads", logo_path: "", display_priority: 2 },
      { provider_id: 337, provider_name: "Disney Plus", logo_path: "", display_priority: 3 },
      { provider_id: 119, provider_name: "Amazon Prime Video", logo_path: "", display_priority: 4 },
      { provider_id: 1, provider_name: "TF1+", logo_path: "", display_priority: 5 },
      { provider_id: 236, provider_name: "France TV", logo_path: "", display_priority: 6 },
      { provider_id: 381, provider_name: "Canal+", logo_path: "", display_priority: 7 },
      { provider_id: 2, provider_name: "M6+", logo_path: "", display_priority: 8 },
      { provider_id: 3, provider_name: "Canal+ Amazon Channel", logo_path: "", display_priority: 9 },
    ])
    const by = Object.fromEntries(groups.map((g) => [g.label, g.providerIds]))
    expect(by["Netflix"]).toEqual([8, 1796])
    expect(by["Disney+"]).toEqual([337])
    expect(by["Prime Video"]).toEqual([119])
    expect(by["TF1+"]).toEqual([1])
    expect(by["France TV"]).toEqual([236])
    expect(by["Canal+"]).toEqual([381])
    expect(by["M6+"]).toEqual([2])
  })

  it("reports a platform TMDB no longer lists as an empty group", () => {
    const groups = resolveFrPlatformGroups([])
    expect(groups.every((g) => g.providerIds.length === 0)).toBe(true)
    expect(groups).toHaveLength(7)
  })
})

describe("qualifyTvShow", () => {
  it("keeps Kids/Family series above the vote floor as core", () => {
    expect(qualifyTvShow(show({ id: 1 }), TODAY)).toEqual({ ok: true, tier: "core" })
  })

  it("tags Animation-only series « à vérifier » and needs more votes", () => {
    const anim = show({ id: 2, genre_ids: [TV_GENRE.ANIMATION, 35], vote_count: 99 })
    expect(qualifyTvShow(anim, TODAY)).toEqual({ ok: false, reason: "low-votes" })
    expect(qualifyTvShow({ ...anim, vote_count: 150 }, TODAY)).toEqual({ ok: true, tier: "a-verifier" })
  })

  it("rejects crime, soap, talk, news and war genres even when Family-tagged", () => {
    for (const g of [80, 10763, 10766, 10767, 10768]) {
      expect(qualifyTvShow(show({ id: 3, genre_ids: [TV_GENRE.FAMILY, g] }), TODAY)).toEqual({
        ok: false,
        reason: "excluded-genre",
      })
    }
  })

  it("rejects series that have not aired yet, or with no date", () => {
    expect(qualifyTvShow(show({ id: 4, first_air_date: "2027-02-01" }), TODAY)).toMatchObject({ reason: "not-aired" })
    expect(qualifyTvShow(show({ id: 4, first_air_date: "" }), TODAY)).toMatchObject({ reason: "not-aired" })
  })

  it("applies the adult guard and the family-genre requirement", () => {
    expect(qualifyTvShow(show({ id: 5, overview: "Une série érotique." }), TODAY)).toMatchObject({ reason: "adult" })
    expect(qualifyTvShow(show({ id: 6, genre_ids: [18] }), TODAY)).toMatchObject({ reason: "not-family-genre" })
    expect(qualifyTvShow(show({ id: 7, vote_count: 3 }), TODAY)).toMatchObject({ reason: "low-votes" })
  })
})

describe("selectTvCandidates", () => {
  const pages: TvDiscoverPage[] = [
    { platform: "Netflix", lane: "core", results: [show({ id: 10, popularity: 50 }), show({ id: 11, popularity: 5 })] },
    { platform: "TF1+", lane: "core", results: [show({ id: 10, popularity: 50 }), show({ id: 12, name: "Peppa Pig", original_name: "Peppa Pig" })] },
    { platform: "Disney+", lane: "animation", results: [show({ id: 13, genre_ids: [16], vote_count: 500, popularity: 900 })] },
  ]

  it("dedups on tmdb id, merges platforms, ranks core above « à vérifier », caps the list", () => {
    const { candidates, stats } = selectTvCandidates({
      pages,
      existingTmdbIds: new Set([11]),
      existingTitles: buildTitleIndex([{ title: "Peppa Pig" }]),
      today: TODAY,
      limit: 10,
    })
    expect(stats.discovered).toBe(4)
    expect(stats.alreadyInCatalogue).toBe(1)
    expect(candidates.map((c) => c.tmdbId)).toEqual([10, 12, 13])
    expect(candidates[0].platforms).toEqual(["Netflix", "TF1+"])
    expect(candidates[0].why).toContain("Netflix, TF1+")
    expect(candidates[1].possibleDuplicateOf).toBe("Peppa Pig")
    expect(candidates[2].tier).toBe("a-verifier")
    expect(stats.coreReturned).toBe(2)
    expect(stats.titleMatches).toBe(1)

    const capped = selectTvCandidates({ pages, existingTmdbIds: new Set(), existingTitles: new Map(), today: TODAY, limit: 2 })
    expect(capped.candidates).toHaveLength(2)
    expect(capped.stats.qualified).toBe(4)
  })

  it("never returns a title already in the catalogue", () => {
    const { candidates } = selectTvCandidates({
      pages,
      existingTmdbIds: new Set([10, 11, 12, 13]),
      existingTitles: new Map(),
      today: TODAY,
      limit: 300,
    })
    expect(candidates).toEqual([])
  })
})

describe("qualifyGame", () => {
  it("keeps PEGI ≤ 16 games on a French platform as core", () => {
    expect(qualifyGame(game({ id: 1 }), NOW_SEC)).toMatchObject({ ok: true, tier: "core", pegi: 7, platforms: ["Switch"] })
    expect(qualifyGame(game({ id: 1, age_ratings: PEGI(11) }), NOW_SEC)).toMatchObject({ ok: true, pegi: 16 })
  })

  it("excludes PEGI 18 and adult-themed games", () => {
    expect(qualifyGame(game({ id: 2, age_ratings: PEGI(12) }), NOW_SEC)).toEqual({ ok: false, reason: "pegi-18" })
    expect(qualifyGame(game({ id: 3, themes: [{ id: 42, name: "Erotic" }] }), NOW_SEC)).toEqual({ ok: false, reason: "adult" })
  })

  it("uses a lower floor for PEGI 3/7 than for PEGI 12/16", () => {
    expect(qualifyGame(game({ id: 4, total_rating_count: 12 }), NOW_SEC)).toMatchObject({ ok: true })
    expect(qualifyGame(game({ id: 4, total_rating_count: 12, age_ratings: PEGI(10) }), NOW_SEC)).toEqual({
      ok: false,
      reason: "low-ratings",
    })
  })

  it("accepts a game without PEGI only above the stricter floor, tagged « à vérifier »", () => {
    const noPegi = game({ id: 5, age_ratings: [], total_rating_count: GAME_THRESHOLDS.minRatingsWithoutPegi - 1 })
    expect(qualifyGame(noPegi, NOW_SEC)).toEqual({ ok: false, reason: "low-ratings" })
    expect(qualifyGame({ ...noPegi, total_rating_count: 500 }, NOW_SEC)).toMatchObject({ ok: true, tier: "a-verifier", pegi: null })
  })

  it("rejects unreleased games and games with no French-market platform", () => {
    expect(qualifyGame(game({ id: 6, first_release_date: NOW_SEC + 86400 }), NOW_SEC)).toEqual({ ok: false, reason: "unreleased" })
    expect(
      qualifyGame(game({ id: 7, platforms: [{ id: 3, name: "Linux", abbreviation: "Linux" }] }), NOW_SEC),
    ).toEqual({ ok: false, reason: "no-fr-platform" })
  })
})

describe("selectGameCandidates", () => {
  it("dedups on igdb id, boosts trending and family titles, flags title matches", () => {
    const { candidates, stats } = selectGameCandidates({
      games: [
        game({ id: 1, total_rating_count: 1000, age_ratings: PEGI(11) }),
        game({ id: 2, total_rating_count: 1000 }), // PEGI 7 → family nudge
        game({ id: 2, total_rating_count: 1000 }), // same game from a second lane
        game({ id: 3, total_rating_count: 50, name: "Mario Kart 8 Deluxe" }),
        game({ id: 4, total_rating_count: 5000 }), // already in catalogue
        game({ id: 5, age_ratings: PEGI(12) }),
      ],
      trendingIds: new Set([3]),
      existingIgdbIds: new Set([4]),
      existingTitles: buildTitleIndex([{ title: "Mario Kart 8 : Deluxe" }]),
      nowSec: NOW_SEC,
      limit: 150,
    })
    expect(stats.discovered).toBe(5)
    expect(stats.alreadyInCatalogue).toBe(1)
    expect(stats.rejected["pegi-18"]).toBe(1)
    // 2: PEGI 7 + 1000 ratings · 3: trending PEGI 7 with only 50 · 1: PEGI 16
    expect(candidates.map((c) => c.igdbId)).toEqual([2, 3, 1])
    expect(candidates.find((c) => c.igdbId === 3)).toMatchObject({
      trending: true,
      possibleDuplicateOf: "Mario Kart 8 : Deluxe",
    })
    expect(candidates.every((c) => c.igdbId !== 4)).toBe(true)
  })
})

describe("parseApprovedIds — the import mode takes an explicit list or nothing", () => {
  it("parses, dedups and caps", () => {
    expect(parseApprovedIds("12, 34,12", 5)).toEqual({ ids: [12, 34] })
    expect(parseApprovedIds("1,2,3", 2).error).toMatch(/au plus 2/)
  })

  it("refuses an empty or malformed list", () => {
    expect(parseApprovedIds(null, 5).error).toBeDefined()
    expect(parseApprovedIds("", 5).error).toBeDefined()
    expect(parseApprovedIds("12;DROP", 5).error).toBeDefined()
    expect(parseApprovedIds("-3", 5).error).toBeDefined()
    expect(parseApprovedIds("1.5", 5).error).toBeDefined()
  })
})

describe("helpers", () => {
  it("normalizes titles across accents, punctuation and articles", () => {
    expect(normalizeTitle("Les Aventures de Tintin")).toBe(normalizeTitle("aventures de tintin"))
    expect(normalizeTitle("Pokémon : Horizons")).toBe("pokemon horizons")
  })

  it("compacts candidates to capped one-line log rows", () => {
    const { candidates } = selectTvCandidates({
      pages: [{ platform: "Netflix", lane: "core", results: [show({ id: 1 }), show({ id: 2 })] }],
      existingTmdbIds: new Set(),
      existingTitles: new Map(),
      today: TODAY,
      limit: 10,
    })
    const rows = compactForLog(candidates, 1)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatch(/^tmdb:\d+ · Série \d+ \/ Show \d+ \(2020\) · dispo\. FR : Netflix/)
  })
})
