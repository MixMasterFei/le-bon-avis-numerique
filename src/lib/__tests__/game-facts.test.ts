import { describe, expect, it } from "vitest"
import {
  createPacer,
  planGameFactsRun,
  type GameFactsRow,
  gameFactsFromIgdb,
  gameFactsSourceLabel,
  isEmptyGameFacts,
  onlineFromAgeRatings,
  purchasesFromAgeRatings,
  seriesFromIgdb,
  timeToBeatHoursFromIgdb,
  type IgdbGameFactsRecord,
} from "@/lib/game-facts"

// Fixtures shaped like real /games answers (v4, age_ratings V2 descriptions).
const MARIO_KART: IgdbGameFactsRecord = {
  id: 1001,
  name: "Mario Kart 8 Deluxe",
  game_modes: [
    { id: 1, name: "Single player" },
    { id: 2, name: "Multiplayer" },
    { id: 4, name: "Split screen" },
  ],
  multiplayer_modes: [
    { platform: 130, offlinemax: 4, onlinemax: 12, splitscreen: true, onlinecoop: false, offlinecoop: false },
  ],
  involved_companies: [
    { company: { name: "Nintendo EPD" }, developer: true, publisher: false },
    { company: { name: "Nintendo" }, developer: false, publisher: true },
  ],
  age_ratings: [
    { organization: 2, rating_category: 8, rating_content_descriptions: [{ description: "In-Game Purchases" }] },
    { organization: 1, rating_category: 2, rating_content_descriptions: [{ description: "Comic Mischief" }] },
  ],
}

const SOLO_NO_DATA: IgdbGameFactsRecord = {
  id: 1002,
  name: "Un jeu solo",
  game_modes: [{ id: 1, name: "Single player" }],
}

describe("gameFactsFromIgdb", () => {
  it("maps a full record", () => {
    const facts = gameFactsFromIgdb(MARIO_KART, {
      series: { id: 1001, collections: [{ name: "Mario" }, { name: "Mario Kart" }], franchise: { name: "Mario" } },
      timeToBeat: { game_id: 1001, normally: 12 * 3600 + 20 * 60, count: 40 },
    })
    expect(facts).toEqual({
      onlinePlay: true,
      localPlay: true,
      splitScreen: true,
      minPlayers: 1,
      maxPlayers: 12,
      inGamePurchases: true,
      developer: "Nintendo EPD",
      publisher: "Nintendo",
      series: "Mario Kart",
      timeToBeatHours: 12.5,
      sources: ["age_ratings", "collections", "game_modes", "involved_companies", "multiplayer_modes", "time_to_beat"],
    })
  })

  it("never infers a « no »: a single-player game without multiplayer data stays null", () => {
    const facts = gameFactsFromIgdb(SOLO_NO_DATA)
    expect(facts.onlinePlay).toBeNull()
    expect(facts.localPlay).toBeNull()
    expect(facts.splitScreen).toBeNull()
    expect(facts.maxPlayers).toBeNull()
    expect(facts.inGamePurchases).toBeNull()
    expect(facts.minPlayers).toBe(1)
  })

  it("returns no boolean false, whatever the input", () => {
    const facts = gameFactsFromIgdb({
      id: 1,
      multiplayer_modes: [
        { onlinecoop: false, offlinecoop: false, splitscreen: false, lancoop: false, onlinemax: 0, offlinemax: 1 },
      ],
      age_ratings: [{ organization: 2, rating_category: 8, rating_content_descriptions: [] }],
    })
    for (const v of Object.values(facts)) expect(v).not.toBe(false)
    expect(isEmptyGameFacts(facts)).toBe(true)
  })

  it("an empty record is empty", () => {
    const facts = gameFactsFromIgdb({ id: 7 })
    expect(isEmptyGameFacts(facts)).toBe(true)
    expect(gameFactsSourceLabel(facts)).toBe("igdb:none")
  })

  it("LAN co-op is not local play", () => {
    const facts = gameFactsFromIgdb({ id: 2, multiplayer_modes: [{ lancoop: true }] })
    expect(facts.localPlay).toBeNull()
  })

  it("online from online co-op, MMO / battle royale modes, or the PEGI online descriptor", () => {
    expect(gameFactsFromIgdb({ id: 3, multiplayer_modes: [{ onlinecoop: true }] }).onlinePlay).toBe(true)
    expect(gameFactsFromIgdb({ id: 3, game_modes: [{ id: 6, name: "Battle Royale" }] }).onlinePlay).toBe(true)
    expect(gameFactsFromIgdb({ id: 3, game_modes: [{ name: "Massively Multiplayer Online (MMO)" }] }).onlinePlay).toBe(true)
    expect(
      gameFactsFromIgdb({
        id: 3,
        age_ratings: [{ organization: 2, rating_content_descriptions: [{ description: "Online Gameplay" }] }],
      }).onlinePlay,
    ).toBe(true)
    // « Multiplayer » alone says nothing about online vs local.
    const generic = gameFactsFromIgdb({ id: 3, game_modes: [{ id: 2, name: "Multiplayer" }] })
    expect(generic.onlinePlay).toBeNull()
    expect(generic.localPlay).toBeNull()
  })

  it("split screen from the game mode implies local play", () => {
    const facts = gameFactsFromIgdb({ id: 4, game_modes: [{ id: 4, name: "Split screen" }] })
    expect(facts.splitScreen).toBe(true)
    expect(facts.localPlay).toBe(true)
  })

  it("max players is the largest stated count across platforms; nonsense counts are ignored", () => {
    const facts = gameFactsFromIgdb({
      id: 5,
      multiplayer_modes: [{ offlinemax: 2 }, { onlinecoopmax: 4 }, { onlinemax: 5000 }, { offlinecoopmax: 1 }],
    })
    expect(facts.maxPlayers).toBe(4)
  })

  it("keeps at most two distinct companies per role and drops blank names", () => {
    const facts = gameFactsFromIgdb({
      id: 6,
      involved_companies: [
        { company: { name: "  Studio A " }, developer: true },
        { company: { name: "Studio A" }, developer: true },
        { company: { name: "" }, developer: true },
        { company: { name: "Studio B" }, developer: true },
        { company: { name: "Studio C" }, developer: true },
      ],
    })
    expect(facts.developer).toBe("Studio A, Studio B")
    expect(facts.publisher).toBeNull()
  })
})

describe("purchasesFromAgeRatings", () => {
  it("is TRUE only from PEGI or ESRB", () => {
    expect(
      purchasesFromAgeRatings([
        { organization: 1, rating_content_descriptions: [{ description: "In-Game Purchases (Includes Random Items)" }] },
      ]),
    ).toBe(true)
    expect(purchasesFromAgeRatings([{ category: 2, rating_content_descriptions: [{ category: 58 }] }])).toBe(true)
    // USK (organization 3) is not one of the two sources we trust here.
    expect(
      purchasesFromAgeRatings([{ organization: 3, rating_content_descriptions: [{ description: "In-Game Purchases" }] }]),
    ).toBeNull()
  })

  it("is null — never false — without the descriptor", () => {
    expect(purchasesFromAgeRatings(undefined)).toBeNull()
    expect(purchasesFromAgeRatings([])).toBeNull()
    expect(purchasesFromAgeRatings([{ organization: 2, rating_content_descriptions: [{ description: "Violence" }] }])).toBeNull()
  })
})

describe("onlineFromAgeRatings", () => {
  it("reads only the PEGI descriptor", () => {
    expect(onlineFromAgeRatings([{ category: 2, rating_content_descriptions: [{ category: 57 }] }])).toBe(true)
    expect(onlineFromAgeRatings([{ organization: 1, rating_content_descriptions: [{ description: "Online Gameplay" }] }])).toBeNull()
  })
})

describe("seriesFromIgdb", () => {
  it("prefers the collection named in the title, then the first collection, then the franchise", () => {
    expect(seriesFromIgdb({ id: 1, collections: [{ name: "Mario" }, { name: "Mario Kart" }] }, "Mario Kart 8")).toBe("Mario Kart")
    expect(seriesFromIgdb({ id: 1, collections: [{ name: "Zelda" }] }, "Breath of the Wild")).toBe("Zelda")
    expect(seriesFromIgdb({ id: 1, collection: { name: "Legacy" } }, "X")).toBe("Legacy")
    expect(seriesFromIgdb({ id: 1, franchise: { name: "Pokémon" } }, "X")).toBe("Pokémon")
    expect(seriesFromIgdb({ id: 1, franchises: [{ name: "Sonic" }] }, "X")).toBe("Sonic")
    expect(seriesFromIgdb({ id: 1 }, "X")).toBeNull()
    expect(seriesFromIgdb(null)).toBeNull()
  })
})

describe("timeToBeatHoursFromIgdb", () => {
  it("rounds the main-story duration to the half hour", () => {
    expect(timeToBeatHoursFromIgdb({ normally: 7 * 3600 + 50 * 60, count: 10 })).toBe(8)
    expect(timeToBeatHoursFromIgdb({ normally: 40 * 60, count: 3 })).toBe(0.5)
  })

  it("is null without enough submissions, or with an implausible or unknown shape", () => {
    expect(timeToBeatHoursFromIgdb({ normally: 36000, count: 2 })).toBeNull()
    expect(timeToBeatHoursFromIgdb({ normally: 36000 })).toBeNull()
    expect(timeToBeatHoursFromIgdb({ normally: 600, count: 50 })).toBeNull()
    expect(timeToBeatHoursFromIgdb({ normally: 5_000_000, count: 50 })).toBeNull()
    expect(timeToBeatHoursFromIgdb({ hastily: 3600, count: 50 })).toBeNull()
    expect(timeToBeatHoursFromIgdb(null)).toBeNull()
  })
})

const EMPTY_ROW: Omit<GameFactsRow, "id" | "title" | "igdbId"> = {
  gameOnlinePlay: null,
  gameLocalPlay: null,
  gameSplitScreen: null,
  gameMinPlayers: null,
  gameMaxPlayers: null,
  gameInGamePurchases: null,
  gameDeveloper: null,
  gamePublisher: null,
  gameSeries: null,
  gameTimeToBeatHours: null,
}

describe("planGameFactsRun", () => {
  const rows: GameFactsRow[] = [
    { ...EMPTY_ROW, id: "mk", title: "Mario Kart 8 Deluxe", igdbId: 1001 },
    { ...EMPTY_ROW, id: "gone", title: "Disparu", igdbId: 9999 },
  ]

  it("reports changes, and a game the source no longer returns as not-found", () => {
    const plan = planGameFactsRun(rows, [MARIO_KART], [{ id: 1001, collections: [{ name: "Mario Kart" }] }], [])
    expect(plan[0].outcome).toBe("changed")
    expect(plan[1]).toEqual({ id: "gone", title: "Disparu", igdbId: 9999, outcome: "not-found" })
    if (plan[0].outcome !== "not-found") {
      expect(plan[0].changes).toContain("gameMaxPlayers: null → 12")
      expect(plan[0].facts.series).toBe("Mario Kart")
    }
  })

  it("a re-read finding the same values is unchanged", () => {
    const stored: GameFactsRow = {
      id: "mk",
      title: "Mario Kart 8 Deluxe",
      igdbId: 1001,
      gameOnlinePlay: true,
      gameLocalPlay: true,
      gameSplitScreen: true,
      gameMinPlayers: 1,
      gameMaxPlayers: 12,
      gameInGamePurchases: true,
      gameDeveloper: "Nintendo EPD",
      gamePublisher: "Nintendo",
      gameSeries: "Mario Kart",
      gameTimeToBeatHours: 12.5,
    }
    // Both isolated lookups failed (null): the stored series and duration are kept.
    const plan = planGameFactsRun([stored], [MARIO_KART], null, null)
    expect(plan[0].outcome).toBe("unchanged")
    if (plan[0].outcome !== "not-found") {
      expect(plan[0].facts.sources).toContain("collections(kept)")
      expect(plan[0].facts.sources).toContain("time_to_beat(kept)")
    }
  })

  it("a lookup that answered without the game clears nothing it never had", () => {
    const plan = planGameFactsRun([{ ...rows[0] }], [{ id: 1001 }], [], [])
    expect(plan[0].outcome).toBe("unchanged")
  })
})

describe("createPacer", () => {
  it("spaces calls by the minimum interval", async () => {
    let clock = 0
    const sleeps: number[] = []
    const pace = createPacer(
      250,
      () => clock,
      async (ms) => {
        sleeps.push(ms)
        clock += ms
      },
    )
    await pace(async () => 1)
    clock += 100
    await pace(async () => 2)
    await pace(async () => 3)
    expect(sleeps).toEqual([150, 250])
  })
})
