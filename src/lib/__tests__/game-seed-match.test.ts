import { describe, expect, it } from "vitest"
import { matchTier, normalizeGameName, pickIgdbCandidate } from "@/lib/game-seed-match"

// ---------------------------------------------------------------------------
// The games-top-names cron imports whatever this picks, under the seed's
// name. A wrong pick is a wrong fiche on the /jeux/quel-age pillar.
// ---------------------------------------------------------------------------

const c = (id: number, name: string, total_rating_count = 0) => ({ id, name, total_rating_count })

describe("pickIgdbCandidate", () => {
  it("prefers the game itself over a title that merely contains the alias", () => {
    // The 2026-09 miss: "among us" matched The Wolf Among Us, which was
    // already in the catalogue, so Among Us was reported as present.
    const seed = { name: "Among Us", aliases: ["among us"] }
    const pick = pickIgdbCandidate(seed, [c(2993, "The Wolf Among Us", 900), c(116531, "Among Us", 700)])
    expect(pick?.id).toBe(116531)
  })

  it("never falls back to an unrelated fuzzy hit", () => {
    const seed = { name: "Brawl Stars", aliases: ["brawl stars"] }
    expect(pickIgdbCandidate(seed, [c(1, "Brawlhalla", 5000), c(2, "Star Wars: Battlefront", 8000)])).toBeNull()
  })

  it("accepts editions and subtitles after the alias, not extra letters", () => {
    const toca = { name: "Toca Boca", aliases: ["toca boca", "toca life"], catalogueTitles: ["toca life: world"] }
    expect(pickIgdbCandidate(toca, [c(1, "Toca Life: World")])?.id).toBe(1)
    const sonic = { name: "Sonic", aliases: ["sonic"] }
    expect(pickIgdbCandidate(sonic, [c(1, "Sonics of Doom")])).toBeNull()
    expect(pickIgdbCandidate(sonic, [c(2, "Sonic Frontiers")])?.id).toBe(2)
  })

  it("ignores a leading 'The' or 'Tom Clancy's' on the candidate", () => {
    const zelda = { name: "The Legend of Zelda", aliases: ["legend of zelda", "zelda"] }
    expect(pickIgdbCandidate(zelda, [c(1, "The Legend of Zelda: Tears of the Kingdom")])?.id).toBe(1)
    const r6 = { name: "Rainbow Six Siege", aliases: ["rainbow six"] }
    expect(pickIgdbCandidate(r6, [c(1, "Tom Clancy's Rainbow Six Siege")])?.id).toBe(1)
    // …but dropping the article must not turn a different game into a match.
    expect(matchTier({ name: "Among Us", aliases: ["among us"] }, "The Wolf Among Us")).toBeNull()
  })

  it("breaks ties inside a tier by rating count, so the mainline game beats a DLC", () => {
    const seed = { name: "Minecraft", aliases: ["minecraft"] }
    const pick = pickIgdbCandidate(seed, [
      c(1, "Minecraft Dungeons", 400),
      c(2, "Minecraft: Story Mode", 300),
      c(3, "Minecraft Legends", 500),
    ])
    expect(pick?.id).toBe(3)
    // An exact title still wins over every "starts with" hit.
    expect(pickIgdbCandidate(seed, [c(3, "Minecraft Legends", 500), c(9, "Minecraft", 10)])?.id).toBe(9)
  })

  it("compares without accents, curly apostrophes or trademark signs", () => {
    expect(normalizeGameName("Pokémon™ Legends: Z-A")).toBe("pokemon legends: z-a")
    const ac = { name: "Assassin's Creed", aliases: ["assassin's creed"] }
    expect(pickIgdbCandidate(ac, [c(1, "Assassin’s Creed Mirage")])?.id).toBe(1)
  })
})
