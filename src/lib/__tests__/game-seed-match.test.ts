import { describe, expect, it } from "vitest"
import {
  isInReleaseWindow,
  matchTier,
  normalizeGameName,
  pickForLookup,
  pickIgdbCandidate,
  seedLookups,
} from "@/lib/game-seed-match"
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

// ---------------------------------------------------------------------------
// Preferred editions (21 Nov 2026): the cron searched aliases only and stopped
// at the most-rated hit, so « mario kart » kept finding Mario Kart 8 Deluxe
// (already present) and Mario Kart World was never imported.
// ---------------------------------------------------------------------------

describe("seedLookups", () => {
  it("searches the preferred editions first, in order, then the aliases", () => {
    const seed = TOP_GAMES.find((s) => s.key === "mario-kart")!
    expect(seedLookups(seed).map((l) => `${l.kind}:${l.query}`)).toEqual([
      "catalogueTitle:mario kart world",
      "catalogueTitle:mario kart 8 deluxe",
      "catalogueTitle:mario kart 8",
      "alias:mario kart",
    ])
  })

  it("is the alias search alone for a seed without catalogue titles", () => {
    expect(seedLookups({ name: "Roblox", aliases: ["roblox"] })).toEqual([{ kind: "alias", query: "roblox" }])
  })
})

describe("pickForLookup", () => {
  const mk = { name: "Mario Kart", aliases: ["mario kart"], catalogueTitles: ["mario kart world", "mario kart 8 deluxe"] }

  it("finds the preferred edition by its exact name, even when an older one is more rated", () => {
    const [world] = seedLookups(mk)
    const results = [c(1, "Mario Kart 8 Deluxe", 900), c(2, "Mario Kart World", 120), c(3, "Mario Kart World: Booster Pack", 300)]
    expect(pickForLookup(mk, world, results)?.id).toBe(2)
  })

  it("never takes an edition's subtitle variant (a DLC) for the edition", () => {
    const [world] = seedLookups(mk)
    expect(pickForLookup(mk, world, [c(1, "Mario Kart 8 Deluxe", 900), c(3, "Mario Kart World: Booster Pack", 300)])).toBeNull()
  })

  it("never takes IGDB's fuzzy first hit for an edition", () => {
    const [world] = seedLookups(mk)
    expect(pickForLookup(mk, world, [c(9, "Kart Racers World", 5000)])).toBeNull()
  })

  it("keeps the strict alias rules on the alias step", () => {
    const alias = seedLookups(mk).find((l) => l.kind === "alias")!
    expect(pickForLookup(mk, alias, [c(9, "Super Mario Kartoon", 5000)])).toBeNull()
    expect(pickForLookup(mk, alias, [c(1, "Mario Kart 8 Deluxe", 900)])?.id).toBe(1)
  })

  it("applies the release window to editions too (Ocarina of Time remake)", () => {
    const ts = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 1000
    const seed = TOP_GAMES.find((s) => s.key === "zelda-ocarina-of-time")!
    const [title] = seedLookups(seed)
    expect(title.kind).toBe("catalogueTitle")
    const original = { ...c(1, "The Legend of Zelda: Ocarina of Time", 3000), first_release_date: ts("1998-11-21") }
    const remake = { ...c(3, "The Legend of Zelda: Ocarina of Time", 40), first_release_date: ts("2026-11-05") }
    expect(pickForLookup(seed, title, [original, remake])?.id).toBe(3)
    expect(pickForLookup(seed, title, [original])).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Overwatch (23 Nov 2026): the run counted the seed « déjà présent » because
// the « overwatch » lookup matched the 2016 original (exact name, most rated,
// in the catalogue since 2025) — the free-to-play successor families play
// (Overwatch 2, 4 Oct 2022, sold as plain « Overwatch » again since) was
// never imported. Preferred edition first + a release window.
// ---------------------------------------------------------------------------

describe("Overwatch seed", () => {
  const ts = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 1000
  const seed = TOP_GAMES.find((s) => s.key === "overwatch")!
  const original = { ...c(8173, "Overwatch", 3000), first_release_date: ts("2016-05-24") }

  it("looks up « Overwatch 2 » first, then the plain name, then the alias", () => {
    expect(seed.catalogueTitles?.[0]).toBe("overwatch 2")
    expect(seedLookups(seed).map((l) => `${l.kind}:${l.query}`)).toEqual([
      "catalogueTitle:overwatch 2",
      "catalogueTitle:overwatch",
      "alias:overwatch",
    ])
  })

  it("imports the successor under its « Overwatch 2 » name, never the 2016 original", () => {
    const successor = { ...c(125174, "Overwatch 2", 900), first_release_date: ts("2022-10-04") }
    const [first] = seedLookups(seed)
    expect(pickForLookup(seed, first, [original, successor])?.id).toBe(125174)
  })

  it("still finds the successor when it is listed as plain « Overwatch »", () => {
    const renamed = { ...c(125174, "Overwatch", 900), first_release_date: ts("2022-10-04") }
    const lookups = seedLookups(seed)
    expect(pickForLookup(seed, lookups[0], [original, renamed])).toBeNull()
    expect(pickForLookup(seed, lookups[1], [original, renamed])?.id).toBe(125174)
  })

  it("never settles for the 2016 original: no successor means « introuvable », not « déjà présent »", () => {
    for (const lookup of seedLookups(seed)) {
      expect(pickForLookup(seed, lookup, [original])).toBeNull()
    }
  })
})
