import { describe, expect, it } from "vitest"
import {
  HOMEPAGE_CINEMA_CAP,
  HOMEPAGE_DEFAULT_CAP,
  HOMEPAGE_GAMES_CAP,
  WATCH_MAX_IMPORTS,
  freshGameItems,
  newSeasonTiming,
  trendingGameItems,
  watchTitleLog,
  WATCH_MAX_PINS,
  buildWatchPins,
  buildWatchReport,
  catalogueKey,
  classifyExpected,
  mergeExpected,
  pickImports,
  selectWatchPins,
  watchHealth,
  watchPinPriority,
  type CatalogueEntry,
  type ClassifiedItem,
  type ExpectedItem,
  type HomepageSlot,
  type WatchOutcomes,
} from "../homepage-watch"

const now = new Date("2026-11-21T06:00:00.000Z")

function expected(partial: Partial<ExpectedItem> & Pick<ExpectedItem, "key" | "kind" | "title">): ExpectedItem {
  return { sources: ["cinema"], signal: 50, frRelevant: true, isNew: true, ...partial }
}

function entry(id: string, kind: CatalogueEntry["kind"], age: number | null, enriched = true): CatalogueEntry {
  return { id, kind, title: id, expertAgeRec: age, isEnriched: enriched, posterUrl: `https://img/${id}.jpg` }
}

// The 21 Nov 2026 situation Xavier reported, with the ages the DB held that day.
const gta6 = expected({ key: "GAME:igdb:52189", kind: "GAME", title: "Grand Theft Auto VI", igdbId: 52189, sources: ["igdb-trending", "igdb-fresh"], signal: 95 })
const zelda = expected({ key: "GAME:igdb:999001", kind: "GAME", title: "The Legend of Zelda: Ocarina of Time", igdbId: 999001, sources: ["igdb-fresh"], signal: 80 })
const visionQuest = expected({ key: "TV:tmdb:213375", kind: "TV", title: "VisionQuest", tmdbId: 213375, sources: ["trending-tv"], signal: 95 })
const hunger = expected({ key: "MOVIE:tmdb:1", kind: "MOVIE", title: "Hunger Games: Lever de soleil sur la moisson", tmdbId: 1, signal: 100 })
const asterix = expected({ key: "MOVIE:tmdb:1084728", kind: "MOVIE", title: "Astérix : Le Royaume de Nubie", tmdbId: 1084728, signal: 90 })
const romance = expected({ key: "MOVIE:tmdb:7", kind: "MOVIE", title: "Un drame à 16 ans", tmdbId: 7, signal: 40 })

const catalogue = new Map<string, CatalogueEntry>([
  [gta6.key, entry("gta6", "GAME", 18)],
  [visionQuest.key, entry("visionquest", "TV", 12)],
  [hunger.key, entry("hunger", "MOVIE", 14)],
  [asterix.key, entry("asterix", "MOVIE", 6, false)],
  [romance.key, entry("romance", "MOVIE", 16)],
])

// What the V2 homepage showed: Hunger Games in the cinema rail, Astérix
// (not in the DB view → tmdb id only) last, no spotlight yet, games rail
// capped at 12 so no GTA VI.
const homepage: HomepageSlot[] = [
  { section: "cinema", position: 2, mediaId: "hunger", tmdbId: 1 },
  { section: "cinema", position: 12, mediaId: null, tmdbId: 1084728 },
  { section: "games", position: 1, mediaId: "other-game" },
]

describe("classifyExpected", () => {
  const classified = classifyExpected([gta6, zelda, visionQuest, hunger, asterix, romance], catalogue, homepage)
  const status = (title: string) => classified.find((c) => c.title === title)

  it("reports the homepage position of what is shown, matching a cinema card by TMDB id", () => {
    expect(status("Hunger Games: Lever de soleil sur la moisson")?.placements).toEqual([{ section: "cinema", position: 2 }])
    expect(status("Astérix : Le Royaume de Nubie")?.status).toBe("on-homepage")
  })

  it("tells « excluded by the default age cap » apart from « missing »", () => {
    const series = expected({ key: "TV:tmdb:77", kind: "TV", title: "MobLand", tmdbId: 77, sources: ["trending-tv"] })
    const c = classifyExpected([series, zelda], new Map([[series.key, entry("mobland", "TV", 17)]]), homepage)
    expect(c[0].status).toBe("age-capped")
    expect(c[0].cap).toBe(HOMEPAGE_DEFAULT_CAP)
    expect(status("The Legend of Zelda: Ocarina of Time")?.status).toBe("missing")
  })

  it("never calls a game « age-capped »: the games row has no age cap since 27 Nov 2026", () => {
    expect(HOMEPAGE_GAMES_CAP).toBeNull()
    expect(status("Grand Theft Auto VI")?.status).toBe("absent")
    expect(status("Grand Theft Auto VI")?.cap).toBeUndefined()
  })

  it("uses the older cinema cap (14) for a film in French cinemas", () => {
    expect(status("Un drame à 16 ans")?.status).toBe("age-capped")
    expect(status("Un drame à 16 ans")?.cap).toBe(HOMEPAGE_CINEMA_CAP)
  })

  it("marks an analysed title within the cap that is nowhere on the page as absent", () => {
    expect(status("VisionQuest")?.status).toBe("absent")
  })

  it("marks a catalogue title without an age, or not analysed, as not ready", () => {
    const noAge = expected({ key: "TV:tmdb:5", kind: "TV", title: "Sans âge", tmdbId: 5 })
    const [c] = classifyExpected([noAge], new Map([[noAge.key, entry("noage", "TV", null, false)]]), [])
    expect(c.status).toBe("not-ready")
  })
})

describe("mergeExpected", () => {
  it("merges the same title seen by several sources", () => {
    const merged = mergeExpected([
      { ...hunger, sources: ["cinema"], signal: 100, isNew: true },
      { ...hunger, sources: ["trending-movie"], signal: 97, isNew: false },
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0].sources).toEqual(["cinema", "trending-movie"])
    expect(merged[0].signal).toBe(100)
    expect(merged[0].isNew).toBe(true)
  })

  it("keys catalogue rows the way expected items are keyed", () => {
    expect(catalogueKey("GAME", { igdbId: 52189 })).toBe("GAME:igdb:52189")
    expect(catalogueKey("TV", { tmdbId: 213375 })).toBe("TV:tmdb:213375")
    expect(catalogueKey("MOVIE", { tmdbId: null })).toBeNull()
  })
})

describe("pickImports", () => {
  it("imports only missing titles relevant in France, strongest first, capped", () => {
    const foreign = expected({ key: "TV:tmdb:9", kind: "TV", title: "Série introuvable en France", tmdbId: 9, frRelevant: false, signal: 99 })
    const many = Array.from({ length: 12 }, (_, i) =>
      expected({ key: `MOVIE:tmdb:${100 + i}`, kind: "MOVIE", title: `Film ${i}`, tmdbId: 100 + i, signal: 10 + i }),
    )
    const classified = classifyExpected([zelda, foreign, ...many], new Map(), [])
    const picked = pickImports(classified)
    expect(picked).toHaveLength(WATCH_MAX_IMPORTS)
    expect(picked[0].title).toBe("The Legend of Zelda: Ocarina of Time")
    expect(picked.some((p) => p.title === "Série introuvable en France")).toBe(false)
  })
})

describe("buildWatchPins", () => {
  const classified = classifyExpected([gta6, zelda, visionQuest, hunger, asterix, romance], catalogue, homepage)

  it("pins the week's launches with an age, mixed by type, 14-day expiry", () => {
    const pins = buildWatchPins(classified, now)
    expect(pins.map((p) => p.title)).toEqual(["hunger", "visionquest", "gta6", "asterix", "romance"])
    expect(pins.map((p) => p.rank)).toEqual([0, 1, 2, 3, 4])
    expect(pins[0].expiresAt.getTime() - now.getTime()).toBe(14 * 24 * 3_600_000)
    // Never a title that isn't in the catalogue.
    expect(pins.some((p) => p.title.includes("Zelda"))).toBe(false)
  })

  it("leaves admin-pinned titles and evergreen trending titles alone", () => {
    const evergreen = expected({ key: "GAME:igdb:1", kind: "GAME", title: "Roblox", igdbId: 1, isNew: false, signal: 100 })
    const cat = new Map(catalogue).set(evergreen.key, entry("roblox", "GAME", 12))
    const c = classifyExpected([gta6, evergreen], cat, [])
    const pins = buildWatchPins(c, now, { adminPinnedIds: new Set(["gta6"]) })
    expect(pins).toEqual([])
  })

  it("caps each type at three", () => {
    const films = Array.from({ length: 6 }, (_, i) => expected({ key: `MOVIE:tmdb:${i + 50}`, kind: "MOVIE", title: `F${i}`, tmdbId: i + 50 }))
    const cat = new Map(films.map((f, i) => [f.key, entry(`f${i}`, "MOVIE", 10)] as const))
    expect(buildWatchPins(classifyExpected(films, cat, []), now)).toHaveLength(3)
  })
})

function outcomes(partial: Partial<WatchOutcomes> = {}): WatchOutcomes {
  return {
    dryRun: false,
    writesEnabled: true,
    sources: { "Cinéma à l'affiche": { ok: true, count: 20 }, "Jeux sortis récemment": { ok: true, count: 12 } },
    homepageReadOk: true,
    catalogueReadOk: true,
    imports: { candidates: 0, created: 0, skipped: 0, failed: 0, keys: [] },
    pins: { desired: 0, written: 0, failed: false, removed: 0 },
    ...partial,
  }
}

describe("report: « rien à faire » vs « tout a échoué »", () => {
  const onHome: ClassifiedItem[] = classifyExpected([hunger], catalogue, homepage)

  it("says « rien à faire » when every expected title is on the homepage", () => {
    const r = buildWatchReport({ classified: onHome, outcomes: outcomes(), pins: [], now })
    expect(r.health).toBe("ok")
    expect(r.remaining).toBe(0)
    expect(r.report.split("\n")[0]).toMatch(/^✅ RIEN À FAIRE/)
    expect(r.subject).toBe("Veille accueil — rien à faire")
  })

  it("says ÉCHEC when no source answered — never « rien à faire »", () => {
    const o = outcomes({ sources: { "Cinéma à l'affiche": { ok: false, count: 0, error: "timeout" } } })
    const r = buildWatchReport({ classified: [], outcomes: o, pins: [], now })
    expect(r.health).toBe("sources-failed")
    expect(r.report.split("\n")[0]).toMatch(/^❌ ÉCHEC/)
  })

  it("says ÉCHEC when the catalogue could not be read", () => {
    expect(watchHealth(outcomes({ catalogueReadOk: false }))).toBe("sources-failed")
  })

  it("says ÉCHEC DES ÉCRITURES when every attempted write failed", () => {
    const o = outcomes({
      imports: { candidates: 2, created: 0, skipped: 0, failed: 2, keys: [] },
      pins: { desired: 3, written: 0, failed: true, removed: 0, error: "relation does not exist" },
    })
    const r = buildWatchReport({ classified: onHome, outcomes: o, pins: [], now })
    expect(r.health).toBe("writes-failed")
    expect(r.report.split("\n")[0]).toMatch(/^❌ ÉCHEC DES ÉCRITURES/)
  })

  it("treats a missing pins table (migration 016 not applied) as a setup note, not a failed write", () => {
    const classified = classifyExpected([gta6], catalogue, homepage)
    const pins = buildWatchPins(classified, now)
    const o = outcomes({ pins: { desired: pins.length, written: 0, failed: false, removed: 0, tableMissing: true } })
    const r = buildWatchReport({ classified, outcomes: o, pins, now })
    expect(r.health).toBe("ok")
    expect(r.report).toContain("migration 016 à appliquer")
    // Not pinned, so GTA VI is still « à traiter ».
    expect(r.remaining).toBe(1)
    expect(r.report).toContain("proposées")
  })

  it("flags a partial check when one source is down", () => {
    const o = outcomes({ sources: { a: { ok: true, count: 3 }, b: { ok: false, count: 0, error: "503" } } })
    const r = buildWatchReport({ classified: onHome, outcomes: o, pins: [], now })
    expect(r.health).toBe("sources-degraded")
    expect(r.report).toContain("vérification est incomplète")
  })

  it("counts what is left after the autofix: an imported or pinned title is no longer « à traiter »", () => {
    const classified = classifyExpected([gta6, zelda], catalogue, homepage)
    const pins = buildWatchPins(classified, now)
    const o = outcomes({
      imports: { candidates: 1, created: 1, skipped: 0, failed: 0, keys: [zelda.key] },
      pins: { desired: pins.length, written: pins.length, failed: false, removed: 0 },
    })
    const r = buildWatchReport({ classified, outcomes: o, pins, now })
    expect(r.remaining).toBe(0)
    expect(r.report).toContain("→ importé, en attente d'analyse")
    expect(r.report).toContain("→ épinglé dans « À ne pas manquer »")
  })

  it("in a dry run, proposes instead of claiming writes", () => {
    const classified = classifyExpected([gta6, zelda], catalogue, homepage)
    const pins = buildWatchPins(classified, now)
    const r = buildWatchReport({ classified, outcomes: outcomes({ dryRun: true }), pins, now })
    expect(r.remaining).toBe(2)
    expect(r.report).toContain("simulation")
    expect(r.report).toContain("proposées")
  })
})

// ---------------------------------------------------------------------------
// The first real run (23 Nov 2026) wrote 8 pins — the whole band — and chose
// Enshrouded (15 Oct) over the Ocarina of Time remake (5 Nov): the IGDB
// fresh-releases source ranked by lifetime rating count only (69 vs 61), and
// with 8 pins interleaved film / série / jeu only two games fit.
// ---------------------------------------------------------------------------

describe("watch pins: room for recent releases", () => {
  const nov23 = new Date("2026-11-23T16:00:00.000Z")
  const game = (id: string, partial: Partial<ExpectedItem>) =>
    expected({ key: `GAME:igdb:${id}`, kind: "GAME", title: id, sources: ["igdb-fresh"], ...partial })

  it("never writes more than 6 pins: the band's fallback keeps 2 slots", () => {
    expect(WATCH_MAX_PINS).toBe(6)
    const items = [
      ...["m1", "m2", "m3"].map((id, i) => expected({ key: `MOVIE:tmdb:${200 + i}`, kind: "MOVIE", title: id, tmdbId: 200 + i })),
      ...["t1", "t2", "t3"].map((id, i) => expected({ key: `TV:tmdb:${300 + i}`, kind: "TV", title: id, tmdbId: 300 + i })),
      ...["g1", "g2", "g3"].map((id) => game(id, {})),
    ]
    const cat = new Map(items.map((it) => [it.key, entry(it.title, it.kind, 10)] as const))
    const pins = buildWatchPins(classifyExpected(items, cat, []), nov23)
    expect(pins).toHaveLength(6)
    expect(pins.map((p) => p.kind)).toEqual(["MOVIE", "TV", "GAME", "MOVIE", "TV", "GAME"])
  })

  it("weighs recency strongly: a game out 18 days beats one out 39 days with a similar signal", () => {
    const zeldaFresh = game("zelda", { signal: 64, releasedDaysAgo: 18 })
    const enshrouded = game("enshrouded", { signal: 72, releasedDaysAgo: 39 })
    expect(watchPinPriority(zeldaFresh)).toBeGreaterThan(watchPinPriority(enshrouded))
    const gta = game("gta6", { signal: 100, releasedDaysAgo: 4 })
    const cat = new Map([gta, zeldaFresh, enshrouded].map((g) => [g.key, entry(g.title, "GAME", g.title === "gta6" ? 18 : 12)] as const))
    // Only games: the interleave lets them take the slots, three at most.
    const pins = buildWatchPins(classifyExpected([enshrouded, zeldaFresh, gta], cat, []), nov23, { max: 2 })
    expect(pins.map((p) => p.title)).toEqual(["gta6", "zelda"])
  })

  it("merges the most recent release date seen by any source", () => {
    const [merged] = mergeExpected([
      game("x", { releasedDaysAgo: 40 }),
      game("x", { releasedDaysAgo: 3, sources: ["igdb-trending"] }),
    ])
    expect(merged.releasedDaysAgo).toBe(3)
  })
})

describe("watch pins: at most 2 titles rated 16+", () => {
  const nov23 = new Date("2026-11-23T16:00:00.000Z")
  const gta = expected({ key: "GAME:igdb:52189", kind: "GAME", title: "gta6", igdbId: 52189, signal: 100, releasedDaysAgo: 4 })
  const cod = expected({ key: "GAME:igdb:403310", kind: "GAME", title: "cod", igdbId: 403310, signal: 70, releasedDaysAgo: 31 })
  const mobland = expected({ key: "TV:tmdb:1", kind: "TV", title: "mobland", tmdbId: 1, sources: ["trending-tv"], signal: 90, releasedDaysAgo: 3 })
  const clayface = expected({ key: "MOVIE:tmdb:2", kind: "MOVIE", title: "clayface", tmdbId: 2, signal: 60, releasedDaysAgo: 33 })
  const scrooge = expected({ key: "MOVIE:tmdb:3", kind: "MOVIE", title: "scrooge", tmdbId: 3, signal: 80, releasedDaysAgo: 12 })
  const cat = new Map<string, CatalogueEntry>([
    [gta.key, entry("gta6", "GAME", 18)],
    [cod.key, entry("cod", "GAME", 18)],
    [mobland.key, entry("mobland", "TV", 17)],
    [clayface.key, entry("clayface", "MOVIE", 16)],
    [scrooge.key, entry("scrooge", "MOVIE", 8)],
  ])
  const classified = classifyExpected([gta, cod, mobland, clayface, scrooge], cat, [])

  it("keeps the two strongest 16+ launches (GTA VI stays) and skips the others for the next candidate", () => {
    const { pins, matureSkipped } = selectWatchPins(classified, nov23)
    expect(pins.map((p) => p.title)).toEqual(["scrooge", "mobland", "gta6"])
    expect(matureSkipped.map((c) => c.title).sort()).toEqual(["clayface", "cod"])
  })

  it("counts the admin 16+ pins in the cap", () => {
    const { pins, matureSkipped } = selectWatchPins(classified, nov23, { adminMatureCount: 1 })
    expect(pins.map((p) => p.title)).toEqual(["scrooge", "gta6"])
    expect(matureSkipped.map((c) => c.title).sort()).toEqual(["clayface", "cod", "mobland"])
    expect(selectWatchPins(classified, nov23, { adminMatureCount: 2 }).pins.map((p) => p.title)).toEqual(["scrooge"])
  })

  it("lists the skipped 16+ launches in the report without counting them as work left", () => {
    const { pins, matureSkipped } = selectWatchPins(classified, nov23)
    const o = outcomes({ pins: { desired: pins.length, written: pins.length, failed: false, removed: 0 } })
    const r = buildWatchReport({ classified, outcomes: o, pins, now: nov23, matureSkipped })
    expect(r.remaining).toBe(0)
    expect(r.report).toContain("Non épinglés : plafond de 2 titres 16 ans et plus")
    expect(r.report).toMatch(/clayface \(film · 16 ans\).*non épinglé : déjà 2 titres 16 ans et plus/)
    expect(r.report).toMatch(/cod \(jeu · 18 ans\)/)
  })
})

// ---------------------------------------------------------------------------
// The 27 Nov 2026 run (cron_logs e8288993): GTA VI (18, out 19 Nov, IGDB fresh
// + trending) was skipped « plafond 16+ » although the only 16+ title pinned
// was MobLand and no admin pin was 16+. The two 16+ slots were reserved for
// the two strongest 16+ candidates — MobLand and South Park — before the
// interleave ran; South Park, the third series, was never reached (two series
// slots out of six), so its slot was wasted and GTA VI lost to it.
// ---------------------------------------------------------------------------

describe("watch pins: the 27 Nov 2026 run", () => {
  const nov27 = new Date("2026-11-27T15:34:00.000Z")
  const item = (
    key: string,
    kind: ExpectedItem["kind"],
    title: string,
    signal: number,
    releasedDaysAgo: number,
    sources: ExpectedItem["sources"],
  ) => expected({ key, kind, title, signal, releasedDaysAgo, sources })
  const items = [
    item("MOVIE:tmdb:1", "MOVIE", "Hunger Games", 100, 9, ["cinema", "trending-movie"]),
    item("MOVIE:tmdb:2", "MOVIE", "Billie", 90, 2, ["cinema", "trending-movie"]),
    item("MOVIE:tmdb:3", "MOVIE", "Clayface", 70, 20, ["cinema", "trending-movie"]),
    item("TV:tmdb:10", "TV", "Les Anneaux de pouvoir", 95, 9, ["trending-tv"]),
    item("TV:tmdb:11", "TV", "MobLand", 90, 7, ["trending-tv"]),
    item("TV:tmdb:12", "TV", "South Park", 85, 2, ["trending-tv"]),
    item("TV:tmdb:13", "TV", "Dexter - Résurrection", 60, 5, ["trending-tv"]),
    item("GAME:igdb:52189", "GAME", "Grand Theft Auto VI", 80, 8, ["igdb-fresh", "igdb-trending"]),
    item("GAME:igdb:250618", "GAME", "Phantom Blade Zero", 72, 29, ["igdb-fresh"]),
    item("GAME:igdb:163456", "GAME", "Lightyear Frontier", 64, 24, ["igdb-fresh"]),
    item("GAME:igdb:403310", "GAME", "Call of Duty: Modern Warfare 4", 40, 35, ["igdb-fresh"]),
    item("GAME:igdb:405460", "GAME", "The Legend of Zelda: Ocarina of Time", 70, 22, ["igdb-fresh"]),
  ]
  const ages: Record<string, number> = {
    "Hunger Games": 14,
    Billie: 8,
    Clayface: 16,
    "Les Anneaux de pouvoir": 12,
    MobLand: 17,
    "South Park": 16,
    "Dexter - Résurrection": 16,
    "Grand Theft Auto VI": 18,
    "Phantom Blade Zero": 14,
    "Lightyear Frontier": 7,
    "Call of Duty: Modern Warfare 4": 18,
    "The Legend of Zelda: Ocarina of Time": 12,
  }
  const cat = new Map(items.map((it) => [it.key, { ...entry(it.title, it.kind, ages[it.title]), title: it.title }] as const))
  const classified = classifyExpected(items, cat, [])
  // Zelda and VisionQuest were admin pins that day (neither 16+).
  const adminPinnedIds = new Set(["The Legend of Zelda: Ocarina of Time"])

  it("gives the two 16+ slots to titles that actually get pinned: GTA VI and MobLand", () => {
    const { pins, matureSkipped } = selectWatchPins(classified, nov27, { adminPinnedIds, adminMatureCount: 0 })
    const titles = pins.map((p) => p.title)
    expect(titles).toContain("Grand Theft Auto VI")
    expect(titles).toContain("MobLand")
    expect(titles).not.toContain("South Park")
    expect(pins.filter((p) => ages[p.title] >= 16)).toHaveLength(2)
    expect(pins).toHaveLength(6)
    // GTA VI is pinned, so it is not reported as skipped by the 16+ cap.
    expect(matureSkipped.map((c) => c.title)).not.toContain("Grand Theft Auto VI")
  })

  it("never leaves a 16+ slot unused while a reachable 16+ launch waits", () => {
    const { pins } = selectWatchPins(classified, nov27, { adminPinnedIds, adminMatureCount: 0 })
    expect(pins.map((p) => p.title)).toEqual([
      "Hunger Games",
      "Les Anneaux de pouvoir",
      "Grand Theft Auto VI",
      "Billie",
      "MobLand",
      "Phantom Blade Zero",
    ])
  })

  it("with GTA VI as an admin pin (since 27 Nov): it counts in the cap, the watch keeps one 16+ slot", () => {
    const { pins, matureSkipped } = selectWatchPins(classified, nov27, {
      adminPinnedIds: new Set([...adminPinnedIds, "Grand Theft Auto VI"]),
      adminMatureCount: 1,
    })
    const titles = pins.map((p) => p.title)
    expect(titles).not.toContain("Grand Theft Auto VI")
    expect(titles).toContain("MobLand")
    expect(pins.filter((p) => ages[p.title] >= 16)).toHaveLength(1)
    expect(matureSkipped.map((c) => c.title)).not.toContain("Grand Theft Auto VI")
  })

  it("lists as skipped only the 16+ titles the cap actually turned away", () => {
    // Only games, one 16+ slot left after an admin 16+ pin; Call of Duty
    // (here out 20 days ago) ranks between Phantom Blade and Lightyear.
    const games = classified
      .filter((c) => c.kind === "GAME")
      .map((c) => (c.title.startsWith("Call of Duty") ? { ...c, releasedDaysAgo: 20, signal: 70 } : c))
    const { pins, matureSkipped } = selectWatchPins(games, nov27, { adminPinnedIds, adminMatureCount: 1 })
    expect(pins.map((p) => p.title)).toEqual(["Grand Theft Auto VI", "Phantom Blade Zero", "Lightyear Frontier"])
    expect(matureSkipped.map((c) => c.title)).toEqual(["Call of Duty: Modern Warfare 4"])
  })

  it("a new launch beats an older series once the season's premiere sets its recency", () => {
    // Same series, weekly episodes: the season premiered 40 days ago.
    const series = item("TV:tmdb:99", "TV", "Vieille série", 90, 40, ["trending-tv"])
    const gta = items.find((i) => i.title === "Grand Theft Auto VI") as ExpectedItem
    expect(watchPinPriority(gta)).toBeGreaterThan(watchPinPriority(series))
    const c = classifyExpected(
      [series, gta],
      new Map([
        [series.key, { ...entry("Vieille série", "TV", 16), title: "Vieille série" }],
        [gta.key, { ...entry("Grand Theft Auto VI", "GAME", 18), title: "Grand Theft Auto VI" }],
      ]),
      [],
    )
    const { pins, matureSkipped } = selectWatchPins(c, nov27, { adminMatureCount: 1 })
    expect(pins.map((p) => p.title)).toEqual(["Grand Theft Auto VI"])
    expect(matureSkipped.map((p) => p.title)).toEqual(["Vieille série"])
  })
})

// ---------------------------------------------------------------------------
// Release recency must reach the pin choice AND the cron_logs row. The 27 Nov
// row read back `releasedDaysAgo: null` for every title: the route never
// logged it, so nobody could check why a game was pinned.
// ---------------------------------------------------------------------------

describe("game sources carry the release date", () => {
  const nov27 = new Date("2026-11-27T15:34:00.000Z")
  const ts = (iso: string) => Date.parse(`${iso}T00:00:00.000Z`) / 1000
  const igdb = [
    { id: 52189, name: "Grand Theft Auto VI", first_release_date: ts("2026-11-19"), total_rating_count: 54 },
    { id: 250618, name: "Phantom Blade Zero", first_release_date: ts("2026-10-29"), total_rating_count: 7 },
    { id: 163456, name: "Lightyear Frontier", first_release_date: ts("2026-11-03"), total_rating_count: 12 },
  ]

  it("« jeux sortis récemment »: every game has its recency, newer big launch first", () => {
    const items = freshGameItems(igdb, nov27, () => false, (g) => g.total_rating_count ?? 0)
    expect(items.map((i) => [i.title, i.releasedDaysAgo])).toEqual([
      ["Grand Theft Auto VI", 8],
      ["Lightyear Frontier", 24],
      ["Phantom Blade Zero", 29],
    ])
    expect(items[0].note).toBe("sorti le 19 nov.")
  })

  it("« jeux en tendance »: recency from the catalogue, else IGDB; evergreen hits dropped", () => {
    const known = new Map([
      [52189, { title: "Grand Theft Auto VI", releaseDate: new Date("2026-11-19T00:00:00.000Z") }],
      [1020, { title: "Grand Theft Auto V", releaseDate: new Date("2013-09-17T00:00:00.000Z") }],
    ])
    const byId = new Map(igdb.map((g) => [g.id, g]))
    const items = trendingGameItems([{ gameId: 1020 }, { gameId: 52189 }, { gameId: 163456 }], known, byId, nov27, () => false)
    expect(items.map((i) => [i.title, i.releasedDaysAgo])).toEqual([
      ["Grand Theft Auto VI", 8],
      ["Lightyear Frontier", 24],
    ])
  })

  it("the cron_logs title row records recency, signal and pin priority", () => {
    const [gta] = classifyExpected(
      freshGameItems(igdb.slice(0, 1), nov27, () => false, () => 1),
      new Map([["GAME:igdb:52189", entry("gta6", "GAME", 18)]]),
      [],
    )
    const log = watchTitleLog(gta, { imported: false, matureCapSkipped: false })
    expect(log).toMatchObject({ kind: "GAME", releasedDaysAgo: 8, isNew: true, signal: 80, priority: 120 })
    expect(log).not.toHaveProperty("matureCapSkipped")
    expect(watchTitleLog(gta, { imported: false, matureCapSkipped: true })).toMatchObject({ matureCapSkipped: true })
  })
})

describe("newSeasonTiming: a new season is dated by its premiere", () => {
  const nov27 = new Date("2026-11-27T15:34:00.000Z")
  it("uses the season's premiere, not the latest weekly episode", () => {
    const t = newSeasonTiming(
      {
        last_episode_to_air: { air_date: "2026-11-20", season_number: 2 },
        seasons: [
          { air_date: "2025-03-30", season_number: 1 },
          { air_date: "2026-10-19", season_number: 2 },
        ],
      },
      nov27,
    )
    expect(t).toEqual({ releasedDaysAgo: 39, note: "saison 2 — épisode diffusé le 20 nov." })
  })

  it("falls back to the episode date without a season premiere, and to the next episode when one is due", () => {
    expect(newSeasonTiming({ last_episode_to_air: { air_date: "2026-11-20", season_number: 2 } }, nov27)?.releasedDaysAgo).toBe(7)
    expect(
      newSeasonTiming({ last_air_date: "2026-06-01", next_episode_to_air: { air_date: "2026-12-01", season_number: 4 } }, nov27),
    ).toEqual({ releasedDaysAgo: -4, note: "saison 4 à partir du 1 déc." })
    expect(newSeasonTiming({ last_air_date: "2026-06-01" }, nov27)).toBeNull()
  })
})
