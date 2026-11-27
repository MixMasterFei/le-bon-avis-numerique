import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  NOTABLE_GAMES_WINDOW_DAYS,
  isTopNameSeedTitle,
  rankNotableGames,
  type NotableGameRow,
} from "../games-notable"
import { GAMES_RAIL_FILTERS, gamesRailUrl } from "../homepage-games-rail"

// The catalogue on 27 Nov 2026 (read-only SELECT): IGDB rating counts are
// stored as tmdbVoteCount, trending scores refreshed that morning.
const now = new Date("2026-11-27T16:00:00.000Z")
const fresh = new Date("2026-11-27T12:00:00.000Z")
const row = (title: string, date: string, votes: number | null, trending: number | null = null): NotableGameRow => ({
  title,
  releaseDate: new Date(`${date}T00:00:00.000Z`),
  tmdbVoteCount: votes,
  trendingScore: trending,
  trendingUpdatedAt: trending == null ? null : fresh,
})

const catalogue = [
  row("Tape to Tape", "2026-10-23", 6),
  row("Final Fantasy Resonance", "2026-10-22", 4),
  row("Sulfur", "2026-10-28", 6),
  row("Nintendo Switch Sports Resort", "2026-10-22", 8),
  row("Phantom Blade Zero", "2026-10-29", 7),
  row("Lightyear Frontier", "2026-11-03", 12),
  row("Enshrouded", "2026-10-15", 69),
  row("The Legend of Zelda: Ocarina of Time", "2026-11-05", 61),
  row("Grand Theft Auto VI", "2026-11-19", 54, 81),
]

describe("rankNotableGames — the homepage games row (27 Nov 2026)", () => {
  const titles = rankNotableGames(catalogue, now).map((r) => r.title)

  it("leads with the big launches: GTA VI, then the Zelda remake, ahead of small releases", () => {
    expect(titles.slice(0, 2)).toEqual(["Grand Theft Auto VI", "The Legend of Zelda: Ocarina of Time"])
    for (const small of ["Tape to Tape", "Sulfur", "Final Fantasy Resonance"]) {
      expect(titles.indexOf(small)).toBeGreaterThan(titles.indexOf("The Legend of Zelda: Ocarina of Time"))
    }
  })

  it("is not a release-date sort any more (that put Lightyear Frontier and Sulfur first)", () => {
    const byDate = [...catalogue].sort((a, b) => (b.releaseDate?.getTime() ?? 0) - (a.releaseDate?.getTime() ?? 0))
    expect(byDate[0].title).toBe("Grand Theft Auto VI")
    expect(titles).not.toEqual(byDate.map((r) => r.title))
    // An old early-access hit out 43 days ago no longer outranks this month's launches.
    expect(titles.indexOf("Enshrouded")).toBeGreaterThan(titles.indexOf("The Legend of Zelda: Ocarina of Time"))
  })

  it("keeps only the window: nothing older than ~60 days, nothing not out yet", () => {
    const ranked = rankNotableGames(
      [...catalogue, row("The Sims 4", "2014-09-02", 663, 73), row("Bientôt", "2026-12-05", 200, 90), row("Il y a 59 jours", "2026-09-29", 40)],
      now,
    ).map((r) => r.title)
    expect(NOTABLE_GAMES_WINDOW_DAYS).toBe(60)
    expect(ranked).not.toContain("The Sims 4")
    expect(ranked).not.toContain("Bientôt")
    expect(ranked).toContain("Il y a 59 jours")
  })

  it("lets a high trending score or a top-names seed bypass the rating floor", () => {
    const ranked = rankNotableGames(
      [
        row("Inconnu sans note", "2026-11-20", 1),
        row("Lancement en tendance", "2026-11-25", 0, 60),
        row("Tendance faible", "2026-11-25", 0, 10),
        row("Mario Kart World", "2026-11-26", 0),
      ],
      now,
    ).map((r) => r.title)
    expect(ranked).toEqual(expect.arrayContaining(["Lancement en tendance", "Mario Kart World"]))
    expect(ranked).not.toContain("Inconnu sans note")
    expect(ranked).not.toContain("Tendance faible")
  })

  it("recognises the /jeux/quel-age seeds and their editions, not look-alikes", () => {
    expect(isTopNameSeedTitle("Grand Theft Auto VI")).toBe(true)
    expect(isTopNameSeedTitle("The Legend of Zelda: Ocarina of Time")).toBe(true)
    expect(isTopNameSeedTitle("Tape to Tape")).toBe(false)
  })
})

describe("homepage games row: no age cap there, caps intact elsewhere", () => {
  const src = (rel: string) => readFileSync(path.join(__dirname, "..", "..", rel), "utf8")
  const rails = src("components/home-redesign/rails.tsx")
  const block = (name: string) => {
    const start = rails.indexOf(`export function ${name}(`)
    const next = rails.indexOf("\nexport function ", start + 1)
    return rails.slice(start, next < 0 ? undefined : next)
  }

  it("the row's query carries no maxAge and ranks by notability", () => {
    expect(gamesRailUrl()).toBe("/api/db/games?sortBy=notable&limit=12&requirePoster=true")
    expect(gamesRailUrl()).not.toMatch(/maxAge/)
    expect(GAMES_RAIL_FILTERS).not.toHaveProperty("maxAge")
  })

  it("GamesRail takes no age and says nothing about filtering", () => {
    const games = block("GamesRail")
    expect(games).toContain("gamesRailUrl()")
    expect(games).not.toMatch(/maxAge|fitsHomepageAge/)
    expect(games).not.toContain("Filtré pour les moins de")
    expect(src("components/home-redesign/HomepageRedesign.tsx")).toMatch(/<GamesRail audience=\{audienceLabel\} rankByMemberIds=\{selectedMemberIds\} \/>/)
  })

  it("every other rail keeps its age cap", () => {
    expect(block("TopPicksRail")).toMatch(/useTopPicks\(maxAge\)/)
    expect(block("TopPicksRail")).toMatch(/fitsHomepageAge\(item, maxAge\)/)
    expect(block("UpcomingRail")).toMatch(/useUpcoming\(maxAge\)/)
    expect(block("CinemaRail")).toMatch(/\?maxAge=\$\{maxAge\}/)
    expect(block("CinemaRail")).toMatch(/\{ maxAge \}/)
    expect(block("CoupsDeCoeurRail")).toMatch(/&maxAge=\$\{maxAge\}/)
    expect(block("CoupsDeCoeurRail")).toMatch(/\.\.\.season, maxAge/)
    const home = src("components/home-redesign/HomepageRedesign.tsx")
    expect(home).toMatch(/<PlatformsSection maxAge=\{effectiveMaxAge\}/)
    expect(home).toMatch(/<PersonalizedRail [^>]*maxAge=\{globalMaxAge\}/)
    expect(home).toMatch(/<CinemaRail maxAge=\{cinemaMaxAge\}/)
  })
})
