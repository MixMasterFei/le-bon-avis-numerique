import { describe, expect, it } from "vitest"
import {
  SPOTLIGHT_MAX,
  freshTrendingScore,
  interleaveByType,
  isActivePin,
  rankSpotlightFilms,
  rankSpotlightGames,
  rankSpotlightSeries,
  selectSpotlight,
  type SpotlightMedia,
  type SpotlightPin,
} from "../homepage-spotlight"

const now = new Date("2026-11-21T12:00:00.000Z")
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 3_600_000)
const hoursAgo = (n: number) => new Date(now.getTime() - n * 3_600_000)

function media(id: string, type: SpotlightMedia["type"], extra: Partial<SpotlightMedia> = {}): SpotlightMedia {
  return {
    id,
    type,
    title: id,
    posterUrl: `https://img/${id}.jpg`,
    expertAgeRec: 12,
    isEnriched: true,
    genres: [],
    contentMetrics: null,
    ...extra,
  }
}

function pin(m: SpotlightMedia | null, extra: Partial<SpotlightPin> = {}): SpotlightPin {
  return {
    mediaId: m?.id ?? "gone",
    source: "watch",
    rank: 0,
    startsAt: daysAgo(1),
    expiresAt: daysAgo(-13),
    media: m,
    ...extra,
  }
}

// Shaped on the catalogue on 21 Nov 2026 (ages read from the DB that day).
const gta6 = media("gta6", "GAME", { title: "Grand Theft Auto VI", expertAgeRec: 18 })
const visionQuest = media("visionquest", "TV", { title: "VisionQuest", expertAgeRec: 12 })
const hungerGames = media("hunger", "MOVIE", { title: "Hunger Games: Lever de soleil sur la moisson", expertAgeRec: 14 })
const asterix = media("asterix", "MOVIE", { title: "Astérix : Le Royaume de Nubie", expertAgeRec: 6, isEnriched: false })
const scrooge = media("scrooge", "MOVIE", { title: "Scrooge", expertAgeRec: 8 })
const enshrouded = media("enshrouded", "GAME", { expertAgeRec: 12 })

describe("selectSpotlight", () => {
  it("mixes films, séries and jeux from the fallback, and never filters by age", () => {
    const out = selectSpotlight({
      pins: [],
      fallback: { films: [hungerGames, asterix, scrooge], series: [visionQuest], games: [gta6, enshrouded] },
      now,
    })
    expect(out.map((i) => i.id)).toEqual(["hunger", "visionquest", "gta6", "asterix", "enshrouded", "scrooge"])
    // GTA VI keeps its 18 — informational band, no homepage cap.
    expect(out.find((i) => i.id === "gta6")?.expertAgeRec).toBe(18)
    expect(out.every((i) => i.origin === "fallback")).toBe(true)
  })

  it("flags a provisional age so the card says « à confirmer »", () => {
    const out = selectSpotlight({ pins: [], fallback: { films: [asterix], series: [], games: [] }, now })
    expect(out[0].isProvisional).toBe(true)
  })

  it("puts admin pins first, then watch pins by rank, then tops up from the fallback", () => {
    const out = selectSpotlight({
      pins: [
        pin(visionQuest, { rank: 1 }),
        pin(gta6, { rank: 0 }),
        pin(scrooge, { source: "admin", rank: 5 }),
      ],
      fallback: { films: [hungerGames, scrooge], series: [visionQuest], games: [enshrouded] },
      now,
    })
    expect(out.map((i) => [i.id, i.origin])).toEqual([
      ["scrooge", "admin"],
      ["gta6", "watch"],
      ["visionquest", "watch"],
      ["hunger", "fallback"],
      ["enshrouded", "fallback"],
    ])
  })

  it("ignores expired, future and orphaned pins", () => {
    const out = selectSpotlight({
      pins: [
        pin(gta6, { expiresAt: hoursAgo(1) }),
        pin(visionQuest, { startsAt: daysAgo(-1) }),
        pin(null),
      ],
      fallback: { films: [], series: [], games: [] },
      now,
    })
    expect(out).toEqual([])
  })

  it("never shows a title without an age or a poster, pinned or not", () => {
    const noAge = media("noage", "MOVIE", { expertAgeRec: null })
    const noPoster = media("noposter", "GAME", { posterUrl: null })
    const out = selectSpotlight({
      pins: [pin(noAge)],
      fallback: { films: [noAge], series: [], games: [noPoster] },
      now,
    })
    expect(out).toEqual([])
  })

  it("treats 0 as a real age (« Tous publics »)", () => {
    const tp = media("tp", "MOVIE", { expertAgeRec: 0 })
    expect(selectSpotlight({ pins: [], fallback: { films: [tp], series: [], games: [] }, now })).toHaveLength(1)
  })

  it("caps the band and never repeats a title", () => {
    const films = Array.from({ length: 10 }, (_, i) => media(`f${i}`, "MOVIE"))
    const out = selectSpotlight({ pins: [pin(films[0])], fallback: { films, series: [], games: [] }, now })
    expect(out).toHaveLength(SPOTLIGHT_MAX)
    expect(new Set(out.map((i) => i.id)).size).toBe(SPOTLIGHT_MAX)
  })
})

describe("interleaveByType", () => {
  it("lets the other kinds fill when one runs short", () => {
    expect(interleaveByType([["a1", "a2", "a3"], [], ["c1"]], 4)).toEqual(["a1", "c1", "a2", "a3"])
  })
})

describe("pins", () => {
  it("is active from startsAt (inclusive) until expiresAt (exclusive)", () => {
    expect(isActivePin({ startsAt: now, expiresAt: daysAgo(-1) }, now)).toBe(true)
    expect(isActivePin({ startsAt: daysAgo(2), expiresAt: now }, now)).toBe(false)
  })
})

describe("fallback ranking", () => {
  it("drops a stale trending score", () => {
    expect(freshTrendingScore({ trendingScore: 80, trendingUpdatedAt: hoursAgo(10) }, now)).toBe(80)
    expect(freshTrendingScore({ trendingScore: 80, trendingUpdatedAt: hoursAgo(100) }, now)).toBeNull()
  })

  it("films: trending titles lead, the rest keep the French cinema order", () => {
    const fresh = hoursAgo(2)
    const ranked = rankSpotlightFilms(
      [
        { id: "asterix", trendingScore: null, trendingUpdatedAt: null },
        { id: "malfaisante", trendingScore: 76, trendingUpdatedAt: fresh },
        { id: "scrooge", trendingScore: 70, trendingUpdatedAt: fresh },
        { id: "hunger", trendingScore: 97, trendingUpdatedAt: fresh },
        { id: "wildwood", trendingScore: null, trendingUpdatedAt: null },
      ],
      now,
    )
    expect(ranked.map((r) => r.id)).toEqual(["hunger", "malfaisante", "scrooge", "asterix", "wildwood"])
  })

  it("series: French platform + premiered recently + trending; old hits are left to the cron", () => {
    const fresh = hoursAgo(2)
    const ranked = rankSpotlightSeries(
      [
        // Long-running show trending again (new season unknown to the DB).
        { id: "anneaux", platforms: ["Prime Video"], releaseDate: new Date("2022-09-01"), trendingScore: 100, trendingUpdatedAt: fresh },
        { id: "visionquest", platforms: ["Disney+"], releaseDate: new Date("2026-10-13"), trendingScore: 95, trendingUpdatedAt: fresh },
        // Trending worldwide but on no French platform.
        { id: "nowhere", platforms: [], releaseDate: daysAgo(10), trendingScore: 99, trendingUpdatedAt: fresh },
        { id: "notrending", platforms: ["Netflix"], releaseDate: daysAgo(10), trendingScore: null, trendingUpdatedAt: null },
      ],
      now,
    )
    expect(ranked.map((r) => r.id)).toEqual(["visionquest"])
  })

  it("games: recent launches only, trending first, then rating count", () => {
    const fresh = hoursAgo(2)
    const ranked = rankSpotlightGames(
      [
        { id: "enshrouded", releaseDate: new Date("2026-10-15"), tmdbVoteCount: 69, trendingScore: null, trendingUpdatedAt: null },
        { id: "gta6", releaseDate: new Date("2026-11-19"), tmdbVoteCount: 54, trendingScore: 80, trendingUpdatedAt: fresh },
        // Evergreen hit trending again: not a launch.
        { id: "gta5", releaseDate: new Date("2013-09-17"), tmdbVoteCount: 5599, trendingScore: 99, trendingUpdatedAt: fresh },
        // Not out yet.
        { id: "future", releaseDate: daysAgo(-5), tmdbVoteCount: 300, trendingScore: 90, trendingUpdatedAt: fresh },
        // Zero-signal release.
        { id: "flip", releaseDate: daysAgo(3), tmdbVoteCount: 1, trendingScore: null, trendingUpdatedAt: null },
        { id: "lightyear", releaseDate: new Date("2026-11-03"), tmdbVoteCount: 12, trendingScore: null, trendingUpdatedAt: null },
      ],
      now,
    )
    expect(ranked.map((r) => r.id)).toEqual(["gta6", "enshrouded", "lightyear"])
  })
})
