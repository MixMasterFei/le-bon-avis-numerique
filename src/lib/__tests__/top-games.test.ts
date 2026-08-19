import { describe, expect, it } from "vitest"
import { TOP_GAMES } from "@/app/jeux/quel-age/topGames.data"

describe("TOP_GAMES seed list", () => {
  it("has unique keys and names", () => {
    const keys = TOP_GAMES.map((g) => g.key)
    const names = TOP_GAMES.map((g) => g.name)
    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(names).size).toBe(names.length)
  })

  it("keeps aliases lowercase — they are matched against lower(title)", () => {
    for (const g of TOP_GAMES) {
      expect(g.aliases.length).toBeGreaterThan(0)
      for (const a of g.aliases) expect(a).toBe(a.toLowerCase())
    }
  })

  it("carries concrete family issues on the titles parents worry about most", () => {
    // These are the high-anxiety titles: open voice chat, random-reward
    // mechanics, or an age rating below the felt intensity. A bare name is
    // not worth citing — the named mechanic is.
    const mustHaveIssues = [
      "roblox", "fortnite", "brawl-stars", "gta", "among-us", "minecraft",
      "five-nights-at-freddys", "poppy-playtime", "clash-royale",
    ]
    for (const key of mustHaveIssues) {
      const g = TOP_GAMES.find((x) => x.key === key)
      expect(g, `missing seed: ${key}`).toBeDefined()
      expect(g!.familyIssues?.length, `${key} has no familyIssues`).toBeGreaterThan(0)
    }
  })

  it("states issues as descriptions, not Totem verdicts", () => {
    // The fiche owns the verdict; this page frames the question. Guard against
    // the seed list drifting into "déconseillé" / "à éviter" territory.
    const verdictWords = /\bdéconseill|à éviter|ne convient pas|interdit aux/i
    for (const g of TOP_GAMES) {
      for (const issue of g.familyIssues ?? []) {
        expect(verdictWords.test(issue), `${g.key}: "${issue}"`).toBe(false)
      }
    }
  })

  it("covers the titles the market study calls unowned whitespace", () => {
    const keys = new Set(TOP_GAMES.map((g) => g.key))
    for (const k of ["roblox", "fortnite", "minecraft"]) expect(keys.has(k)).toBe(true)
    expect(TOP_GAMES.length).toBeGreaterThanOrEqual(40)
  })
})
