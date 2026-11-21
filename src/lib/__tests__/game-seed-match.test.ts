import { describe, expect, it } from "vitest"
import { isInReleaseWindow, matchTier, normalizeGameName, pickIgdbCandidate } from "@/lib/game-seed-match"
import { TOP_GAMES } from "@/app/jeux/quel-age/topGames.data"

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

  it("picks a remake sold under its original's exact name only through its release window", () => {
    // Ocarina of Time (1998), the 3DS version (2011) and the Switch 2 remake
    // (2026) all answer to the same name. By rating count the original wins,
    // so without a window the remake's seed would import the 1998 game.
    const ts = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 1000
    const original = { ...c(1, "The Legend of Zelda: Ocarina of Time", 3000), first_release_date: ts("1998-11-21") }
    const threeDs = { ...c(2, "The Legend of Zelda: Ocarina of Time 3D", 900), first_release_date: ts("2011-06-16") }
    const remake = { ...c(3, "The Legend of Zelda: Ocarina of Time", 40), first_release_date: ts("2026-11-05") }
    const undated = c(4, "The Legend of Zelda: Ocarina of Time", 10)

    const seed = TOP_GAMES.find((s) => s.key === "zelda-ocarina-of-time")!
    expect(seed.releasedFrom).toBeDefined()
    expect(pickIgdbCandidate(seed, [original, threeDs, remake, undated])?.id).toBe(3)
    // Not out yet on IGDB → no pick, never the original as a stand-in.
    expect(pickIgdbCandidate(seed, [original, threeDs, undated])).toBeNull()
    // Seeds without a window are untouched.
    expect(isInReleaseWindow({ name: "x", aliases: ["x"] }, undated)).toBe(true)
    expect(pickIgdbCandidate({ ...seed, releasedFrom: undefined }, [original, remake])?.id).toBe(1)
  })

  it("compares without accents, curly apostrophes or trademark signs", () => {
    expect(normalizeGameName("Pokémon™ Legends: Z-A")).toBe("pokemon legends: z-a")
    const ac = { name: "Assassin's Creed", aliases: ["assassin's creed"] }
    expect(pickIgdbCandidate(ac, [c(1, "Assassin’s Creed Mirage")])?.id).toBe(1)
  })
})
