import { describe, expect, it } from "vitest"
import { describePlayModes } from "../game-play-modes"
import { GAME_STYLE_GROUPS } from "../game-style-tags"

// Topics of the live Overcooked! 2 fiche (style tags + enrichment themes).
const OVERCOOKED_2 = ["Vue isométrique", "2D", "Solo", "Multijoueur", "Coopératif", "Écran partagé", "Humour", "Party game", "Cuisine", "Famille", "Comédie", "Amitié", "Nintendo"]

describe("describePlayModes", () => {
  it("reads French catalogue tags: Overcooked! 2 is a local co-op game, not « Se joue seul »", () => {
    const r = describePlayModes({ topics: OVERCOOKED_2, genres: ["Simulation", "Indé"] })
    expect(r).toMatchObject({ label: "Multijoueur", status: "yes", isMultiplayer: true, hasOnline: false })
    expect(r.description).toBe("Peut se jouer à plusieurs, en coopération sur le même écran ; vérifiez aussi le jeu en ligne")
  })

  it("co-op without a local signal doesn't claim online play (a Kirby-like local duo)", () => {
    const r = describePlayModes({ topics: ["Solo", "Coopératif", "3D"] })
    expect(r).toMatchObject({ label: "Multijoueur", status: "yes", hasOnline: false })
    expect(r.description).toMatch(/en local ou en ligne, à vérifier/)
  })

  it("ignores enrichment themes that only look like modes", () => {
    expect(describePlayModes({ topics: ["Coopération", "Amitié", "Solo"] })).toMatchObject({ label: "Solo uniquement", status: "no" })
  })

  it("flags online play on explicit signals only: MMO / battle royale tags, MOBA genre, PEGI « Jeu en ligne »", () => {
    expect(describePlayModes({ topics: ["Multijoueur", "Battle royale"] })).toMatchObject({ status: "warning", hasOnline: true })
    expect(describePlayModes({ topics: ["MMO"] })).toMatchObject({ status: "warning" })
    expect(describePlayModes({ genres: ["MOBA"] })).toMatchObject({ status: "warning" })
    expect(describePlayModes({ topics: ["Solo"], pegiDescriptors: ["Jeu en ligne"] })).toMatchObject({ status: "warning" })
    expect(describePlayModes({ topics: ["Multijoueur"] })).toMatchObject({ status: "yes", hasOnline: false })
  })

  it("still reads IGDB's English game modes (off-catalogue fiches)", () => {
    expect(describePlayModes({ gameModes: ["Single player", "Multiplayer", "Co-operative", "Split screen"] })).toMatchObject({
      label: "Multijoueur",
      status: "yes",
    })
    expect(describePlayModes({ gameModes: ["Massively Multiplayer Online (MMO)"] })).toMatchObject({ status: "warning" })
    expect(describePlayModes({ gameModes: ["Single player"] })).toMatchObject({ label: "Solo uniquement", description: "Se joue seul" })
  })

  it("says « non renseigné » instead of « Se joue seul » when there is no mode data", () => {
    expect(describePlayModes({ topics: ["Humour", "Famille"], genres: ["Aventure"] })).toMatchObject({
      label: "Modes de jeu",
      status: "unknown",
      description: "Nombre de joueurs non renseigné",
      isMultiplayer: false,
    })
  })

  it("lets an explicit hasOnlineFeatures override the tags", () => {
    expect(describePlayModes({ topics: ["MMO"], hasOnlineFeatures: false })).toMatchObject({ status: "yes", hasOnline: false })
    expect(describePlayModes({ topics: ["Solo"], hasOnlineFeatures: true })).toMatchObject({ status: "warning" })
  })

  it("recognises every « Multi » style tag the importer can write (no silent drift)", () => {
    const multi = GAME_STYLE_GROUPS.find((g) => g.label === "Multi")!.tags
    for (const tag of multi) {
      expect({ tag, status: describePlayModes({ topics: [tag] }).status }).not.toEqual({ tag, status: "unknown" })
    }
  })
})
