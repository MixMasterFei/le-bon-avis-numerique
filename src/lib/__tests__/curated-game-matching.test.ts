import { describe, expect, it } from "vitest"
import { TOP_GAMES } from "@/app/jeux/quel-age/topGames.data"
import { catalogueTitlesForSeed, matchCuratedGame } from "../curated-game-matching"

const seedFor = (key: string) => TOP_GAMES.find((seed) => seed.key === key)!

describe("curated game identity", () => {
  it("links Among Us to the correct title even when Wolf has better data", () => {
    const among = { id: "among", title: "Among Us", dataQualityScore: 60 }
    const wolf = { id: "wolf", title: "The Wolf Among Us", dataQualityScore: 100 }
    expect(matchCuratedGame(seedFor("among-us"), [wolf, among])).toBe(among)
    expect(matchCuratedGame(seedFor("among-us"), [wolf])).toBeUndefined()
  })

  it("does not substitute a sequel, VR version, expansion or title fragment", () => {
    for (const title of ["Among Us 2", "Among Us VR", "Among Us: DLC", "Injustice: Gods Among Us"]) {
      expect(matchCuratedGame(seedFor("among-us"), [{ id: title, title }])).toBeUndefined()
    }
  })

  it("fails closed for ambiguous duplicate records instead of comparing quality", () => {
    expect(matchCuratedGame(seedFor("among-us"), [
      { id: "a", title: "Among Us", dataQualityScore: 70 },
      { id: "b", title: "AMONG US", dataQualityScore: 100 },
    ])).toBeUndefined()
  })

  it("chooses only explicit franchise releases in curated order", () => {
    const kart = { id: "kart8", title: "Mario Kart 8 Deluxe" }
    expect(matchCuratedGame(seedFor("mario-kart"), [
      { id: "fan", title: "Mario Kart Fan Game" },
      { id: "older", title: "Mario Kart 8" },
      kart,
    ])).toBe(kart)
    expect(matchCuratedGame(seedFor("mario-kart"), [{ id: "fan", title: "Mario Kart Fan Game" }])).toBeUndefined()
  })

  it("allows explicit edition names but excludes Minecraft spin-offs", () => {
    const java = { id: "java", title: "Minecraft: Java Edition" }
    expect(matchCuratedGame(seedFor("minecraft"), [
      { id: "dungeons", title: "Minecraft Dungeons" },
      java,
    ])).toBe(java)
  })

  it("normalizes harmless typography without removing title words", () => {
    const pokemon = { id: "pokemon", title: "Pokémon Scarlet" }
    expect(matchCuratedGame({ aliases: ["pokemon scarlet"] }, [pokemon])).toBe(pokemon)
    const freddy = { id: "freddy", title: "  Five Nights at Freddy’s  " }
    expect(matchCuratedGame(seedFor("five-nights-at-freddys"), [freddy])).toBe(freddy)
  })

  it("gives every curated seed explicit query titles without empty entries", () => {
    for (const seed of TOP_GAMES) {
      const titles = catalogueTitlesForSeed(seed)
      expect(titles.length).toBeGreaterThan(0)
      expect(titles.every((title) => title.trim().length > 0)).toBe(true)
    }
  })
})
