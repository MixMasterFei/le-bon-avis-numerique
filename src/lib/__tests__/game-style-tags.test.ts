import { describe, expect, it } from "vitest"
import { deriveGameStyleTags, GAME_STYLE_TAGS } from "../game-style-tags"

const kw = (...names: string[]) => names.map((name, id) => ({ id, name }))

describe("deriveGameStyleTags", () => {
  it("a Mina-style 2D pixel-art metroidvania → the right style tags", () => {
    const tags = deriveGameStyleTags({
      name: "Mina the Hollower",
      summary: "A gothic action-adventure",
      genres: [{ id: 1, name: "Adventure" }],
      themes: [{ id: 1, name: "Fantasy" }],
      game_modes: [{ id: 1, name: "Single player" }],
      player_perspectives: [{ id: 1, name: "Side view" }],
      keywords: kw("pixel art", "metroidvania", "retro"),
    })
    expect(tags).toContain("Pixel art")
    expect(tags).toContain("2D")
    expect(tags).toContain("Metroidvania")
    expect(tags).toContain("Vue de côté")
    expect(tags).toContain("Fantasy")
    expect(tags).toContain("Solo")
    // and crucially NOT a mismatched 3D
    expect(tags).not.toContain("3D")
  })

  it("an MMO in 3rd person → MMO + 3D", () => {
    const tags = deriveGameStyleTags({
      name: "Some MMO",
      genres: [{ id: 1, name: "Role-playing (RPG)" }],
      game_modes: [{ id: 1, name: "Massively Multiplayer Online (MMO)" }],
      player_perspectives: [{ id: 1, name: "Third person" }],
      keywords: kw("open world"),
    })
    expect(tags).toContain("MMO")
    expect(tags).toContain("3D")
    expect(tags).toContain("Monde ouvert")
    expect(tags).not.toContain("2D")
  })

  it("a JRPG → JRPG + tour par tour", () => {
    const tags = deriveGameStyleTags({
      name: "Classic JRPG",
      themes: [{ id: 1, name: "Fantasy" }],
      keywords: kw("jrpg", "turn-based", "anime"),
    })
    expect(tags).toContain("JRPG")
    expect(tags).toContain("Tour par tour")
    expect(tags).toContain("Cartoon")
  })

  it("a survival craft game → survie + artisanat + monde ouvert", () => {
    const tags = deriveGameStyleTags({
      name: "Survive",
      themes: [{ id: 1, name: "Survival" }, { id: 2, name: "Open world" }],
      keywords: kw("crafting", "zombie"),
    })
    expect(tags).toContain("Survie")
    expect(tags).toContain("Monde ouvert")
    expect(tags).toContain("Artisanat")
    expect(tags).toContain("Zombies")
  })

  it("only ever emits tags from the canonical vocabulary, deduped, capped at 12", () => {
    const tags = deriveGameStyleTags({
      name: "x",
      keywords: kw("pixel art", "pixel graphics", "roguelike", "rogue-like", "souls-like", "soulslike"),
    })
    for (const t of tags) expect(GAME_STYLE_TAGS).toContain(t)
    expect(new Set(tags).size).toBe(tags.length) // deduped
    expect(tags.length).toBeLessThanOrEqual(12)
    // synonyms collapse to one tag
    expect(tags.filter((t) => t === "Pixel art").length).toBe(1)
    expect(tags.filter((t) => t === "Roguelike").length).toBe(1)
  })
})
