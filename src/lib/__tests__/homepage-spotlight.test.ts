import { describe, expect, it } from "vitest"
import {
  SPOTLIGHT_FALLBACK_MIN,
  SPOTLIGHT_MAX,
  SPOTLIGHT_MAX_MATURE,
  SPOTLIGHT_WATCH_MAX,
  freshTrendingScore,
  gameLaunchScore,
  interleaveByType,
  isActivePin,
  isRecentGame,
  launchRecencyFactor,
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

// ---------------------------------------------------------------------------
// 23 Nov 2026: the first watch run wrote 8 pins, filled the whole band and
// pushed out Zelda: Ocarina of Time (Switch 2, 5 Nov) and VisionQuest.
// Ages below are the catalogue's that day.
// ---------------------------------------------------------------------------

describe("recency", () => {
  const nov23 = new Date("2026-11-23T18:00:00.000Z")
  const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

  it("weighs recency strongly: ≤ 30 days beats 39 days with similar signals", () => {
    expect(launchRecencyFactor(18)).toBeGreaterThan(launchRecencyFactor(39) * 1.5)
    const zelda = gameLaunchScore({ votes: 61, trending: null, releaseDate: d("2026-11-05") }, nov23)
    const enshrouded = gameLaunchScore({ votes: 69, trending: null, releaseDate: d("2026-10-15") }, nov23)
    expect(zelda).toBeGreaterThan(enshrouded)
  })

  it("ranks the fallback games by notability × recency (Zelda before Enshrouded, GTA VI first)", () => {
    const fresh = new Date("2026-11-23T12:00:00.000Z")
    const ranked = rankSpotlightGames(
      [
        { id: "enshrouded", releaseDate: d("2026-10-15"), tmdbVoteCount: 69, trendingScore: null, trendingUpdatedAt: null },
        { id: "zelda", releaseDate: d("2026-11-05"), tmdbVoteCount: 61, trendingScore: null, trendingUpdatedAt: null },
        { id: "gta6", releaseDate: d("2026-11-19"), tmdbVoteCount: 54, trendingScore: 80, trendingUpdatedAt: fresh },
      ],
      nov23,
    )
    expect(ranked.map((r) => r.id)).toEqual(["gta6", "zelda", "enshrouded"])
  })

  it("weighs a film's trending score by recency (Scrooge, out 12 days, before Malfaisante, out 7 weeks)", () => {
    const fresh = new Date("2026-11-23T12:00:00.000Z")
    const ranked = rankSpotlightFilms(
      [
        { id: "malfaisante", releaseDate: d("2026-10-07"), trendingScore: 67, trendingUpdatedAt: fresh },
        { id: "scrooge", releaseDate: d("2026-11-11"), trendingScore: 64, trendingUpdatedAt: fresh },
      ],
      nov23,
    )
    expect(ranked.map((r) => r.id)).toEqual(["scrooge", "malfaisante"])
  })

  it("a « recent game » is a game out 0 to 30 days ago", () => {
    expect(isRecentGame({ type: "GAME", releaseDate: d("2026-11-05") }, nov23)).toBe(true)
    expect(isRecentGame({ type: "GAME", releaseDate: d("2026-10-15") }, nov23)).toBe(false)
    expect(isRecentGame({ type: "GAME", releaseDate: d("2026-12-01") }, nov23)).toBe(false)
    expect(isRecentGame({ type: "GAME", releaseDate: null }, nov23)).toBe(false)
    expect(isRecentGame({ type: "MOVIE", releaseDate: d("2026-11-18") }, nov23)).toBe(false)
  })
})

describe("band composition rules", () => {
  const recentGame = media("zelda", "GAME", { title: "The Legend of Zelda: Ocarina of Time", releaseDate: daysAgo(16) })
  const olderGame = media("enshrouded-39", "GAME", { releaseDate: daysAgo(37) })
  const cinemaFilm = media("scrooge-cinema", "MOVIE", { expertAgeRec: 8 })
  const series = (n: number, extra: Partial<SpotlightMedia> = {}) =>
    Array.from({ length: n }, (_, i) => media(`s${i}`, "TV", extra))

  it("never lets watch pins take more than 6 slots: the fallback keeps 2", () => {
    const watch = series(8).map((m, rank) => pin(m, { rank }))
    const out = selectSpotlight({
      pins: watch,
      fallback: { films: [cinemaFilm], series: [], games: [recentGame] },
      now,
    })
    expect(out).toHaveLength(SPOTLIGHT_MAX)
    expect(out.filter((i) => i.origin === "watch")).toHaveLength(SPOTLIGHT_WATCH_MAX)
    expect(out.filter((i) => i.origin === "fallback").map((i) => i.id)).toEqual(["scrooge-cinema", "zelda"])
  })

  it("leaves 2 fallback slots after the admin pins too (2 admin → 4 watch)", () => {
    const admin = series(2).map((m) => pin({ ...m, id: `admin-${m.id}` }, { source: "admin" }))
    const watch = series(8).map((m, rank) => pin(m, { rank }))
    const out = selectSpotlight({
      pins: [...admin, ...watch],
      fallback: { films: [cinemaFilm], series: [], games: [recentGame, olderGame] },
      now,
    })
    expect(out.map((i) => i.origin)).toEqual(["admin", "admin", "watch", "watch", "watch", "watch", "fallback", "fallback"])
    expect(out.filter((i) => i.origin === "fallback")).toHaveLength(SPOTLIGHT_FALLBACK_MIN)
  })

  it("lets watch pins past the cap fill slots the fallback cannot", () => {
    const watch = series(8).map((m, rank) => pin(m, { rank }))
    const out = selectSpotlight({ pins: watch, fallback: { films: [], series: [], games: [] }, now })
    expect(out).toHaveLength(SPOTLIGHT_MAX)
    expect(out.every((i) => i.origin === "watch")).toBe(true)
  })

  it("reserves a slot for a recent game and one for a film in cinemas, even behind 6 admin pins", () => {
    const admin = series(6).map((m) => pin({ ...m, id: `admin-${m.id}` }, { source: "admin" }))
    const watch = series(4).map((m, rank) => pin(m, { rank }))
    const out = selectSpotlight({
      pins: [...admin, ...watch],
      // Plain interleave would give film, série: no game at all.
      fallback: { films: [cinemaFilm], series: [media("fallback-series", "TV")], games: [olderGame, recentGame] },
      now,
    })
    expect(out).toHaveLength(SPOTLIGHT_MAX)
    expect(out.slice(6).map((i) => i.id)).toEqual(["scrooge-cinema", "zelda"])
    // The 39-day-old game is not « recent »: it never takes the reserved slot.
    expect(out.some((i) => i.id === "enshrouded-39")).toBe(false)
  })

  it("lets a pin fill a reserved slot: no slot is spent twice", () => {
    const watch = [pin(recentGame, { rank: 0 }), ...series(7).map((m, rank) => pin(m, { rank: rank + 1 }))]
    const out = selectSpotlight({
      pins: watch,
      fallback: { films: [cinemaFilm], series: [], games: [olderGame] },
      now,
    })
    expect(out.find((i) => i.id === "zelda")?.origin).toBe("watch")
    expect(out.filter((i) => i.origin === "watch")).toHaveLength(SPOTLIGHT_WATCH_MAX)
    expect(out.filter((i) => i.origin === "fallback").map((i) => i.id)).toEqual(["scrooge-cinema", "enshrouded-39"])
  })

  it("reserves nothing when no candidate exists", () => {
    const out = selectSpotlight({ pins: [], fallback: { films: [], series: series(3), games: [olderGame] }, now })
    expect(out.map((i) => i.id)).toEqual(["s0", "enshrouded-39", "s1", "s2"])
  })

  it("admin pins come first and are never displaced by a reservation", () => {
    const admin = series(8).map((m) => pin({ ...m, id: `admin-${m.id}` }, { source: "admin" }))
    const out = selectSpotlight({ pins: admin, fallback: { films: [cinemaFilm], series: [], games: [recentGame] }, now })
    expect(out.every((i) => i.origin === "admin")).toBe(true)
  })
})

describe("at most 2 titles rated 16+", () => {
  const mature = (id: string, type: SpotlightMedia["type"], age: number) => media(id, type, { expertAgeRec: age })

  it("skips a third 16+ title for the next candidate, all sources together", () => {
    const out = selectSpotlight({
      pins: [pin(mature("mobland", "TV", 17), { rank: 0 }), pin(gta6, { rank: 1 })],
      fallback: {
        films: [mature("clayface", "MOVIE", 16), scrooge],
        series: [visionQuest],
        games: [mature("cod", "GAME", 18), enshrouded],
      },
      now,
    })
    expect(out.filter((i) => (i.expertAgeRec ?? 0) >= 16)).toHaveLength(SPOTLIGHT_MAX_MATURE)
    expect(out.map((i) => i.id)).toEqual(["mobland", "gta6", "scrooge", "visionquest", "enshrouded"])
  })

  it("keeps GTA VI: the cap goes to the first 16+ candidates, pins before fallback", () => {
    const out = selectSpotlight({
      pins: [pin(gta6, { rank: 0 })],
      fallback: { films: [mature("clayface", "MOVIE", 16), mature("goodboy", "MOVIE", 16)], series: [], games: [] },
      now,
    })
    expect(out.map((i) => i.id)).toEqual(["gta6", "clayface"])
  })

  it("counts admin pins in the cap but never removes them", () => {
    const admin = ["a1", "a2", "a3"].map((id) => pin(mature(id, "MOVIE", 18), { source: "admin" }))
    const out = selectSpotlight({
      pins: [...admin, pin(gta6, { rank: 0 })],
      fallback: { films: [scrooge], series: [visionQuest], games: [mature("cod", "GAME", 18), enshrouded] },
      now,
    })
    expect(out.filter((i) => i.origin === "admin").map((i) => i.id)).toEqual(["a1", "a2", "a3"])
    expect(out.some((i) => i.id === "gta6" || i.id === "cod")).toBe(false)
    expect(out.map((i) => i.id)).toEqual(["a1", "a2", "a3", "scrooge", "visionquest", "enshrouded"])
  })

  it("treats 15 as under the cap", () => {
    const out = selectSpotlight({
      pins: [],
      fallback: { films: ["m1", "m2", "m3"].map((id) => mature(id, "MOVIE", 15)), series: [], games: [] },
      now,
    })
    expect(out).toHaveLength(3)
  })
})

describe("the band on 23 Nov 2026 under the new rules (pins and ages read from the DB that evening)", () => {
  const nov23 = new Date("2026-11-23T20:00:00.000Z")
  const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
  const pinAt = (m: SpotlightMedia, source: string, rank: number): SpotlightPin => ({
    mediaId: m.id,
    source,
    rank,
    startsAt: new Date("2026-11-23T16:28:20.000Z"),
    expiresAt: new Date("2026-12-07T16:28:20.000Z"),
    media: m,
  })
  const zelda = media("zelda", "GAME", { title: "The Legend of Zelda: Ocarina of Time", releaseDate: at("2026-11-05") })
  const vq = media("visionquest", "TV", { releaseDate: at("2026-10-13") })
  const hunger = media("hunger", "MOVIE", { expertAgeRec: 14, releaseDate: at("2026-11-18") })
  const mobland = media("mobland", "TV", { expertAgeRec: 17 })
  const gta = media("gta6", "GAME", { expertAgeRec: 18, releaseDate: at("2026-11-19") })
  const scr = media("scrooge", "MOVIE", { expertAgeRec: 8, releaseDate: at("2026-11-11") })
  const anneaux = media("anneaux", "TV")
  const ensh = media("enshrouded", "GAME", { releaseDate: at("2026-10-15") })
  const malf = media("malfaisante", "MOVIE", { releaseDate: at("2026-10-07") })
  const percy = media("percy", "TV")
  const clay = media("clayface", "MOVIE", { expertAgeRec: 16, releaseDate: at("2026-10-21") })

  it("keeps both admin pins, 4 watch pins, 2 fallback titles, and 2 titles rated 16+", () => {
    const out = selectSpotlight({
      pins: [
        pinAt(zelda, "admin", 0),
        pinAt(vq, "admin", 1),
        ...[hunger, mobland, gta, scr, anneaux, ensh, malf, percy].map((m, rank) => pinAt(m, "watch", rank)),
      ],
      fallback: { films: [hunger, scr, malf, clay], series: [vq], games: [gta, zelda, ensh] },
      now: nov23,
    })
    expect(out.map((i) => [i.id, i.origin])).toEqual([
      ["zelda", "admin"],
      ["visionquest", "admin"],
      ["hunger", "watch"],
      ["mobland", "watch"],
      ["gta6", "watch"],
      ["scrooge", "watch"],
      ["malfaisante", "fallback"],
      ["enshrouded", "fallback"],
    ])
    expect(out.filter((i) => (i.expertAgeRec ?? 0) >= 16).map((i) => i.id)).toEqual(["mobland", "gta6"])
  })
})
