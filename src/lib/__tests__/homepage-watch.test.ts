import { describe, expect, it } from "vitest"
import {
  HOMEPAGE_CINEMA_CAP,
  HOMEPAGE_DEFAULT_CAP,
  WATCH_MAX_IMPORTS,
  buildWatchPins,
  buildWatchReport,
  catalogueKey,
  classifyExpected,
  mergeExpected,
  pickImports,
  watchHealth,
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
    expect(status("Grand Theft Auto VI")?.status).toBe("age-capped")
    expect(status("Grand Theft Auto VI")?.cap).toBe(HOMEPAGE_DEFAULT_CAP)
    expect(status("The Legend of Zelda: Ocarina of Time")?.status).toBe("missing")
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

  it("caps each type at three and the band at eight", () => {
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
