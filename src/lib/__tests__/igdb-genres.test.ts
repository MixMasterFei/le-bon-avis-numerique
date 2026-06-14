import { describe, it, expect } from "vitest"
import { normalizeGameGenres, IGDB_GENRE_FR, GAME_GENRE_TOPICS } from "../igdb-genres"

describe("normalizeGameGenres", () => {
  it("maps English IGDB genres to French", () => {
    expect(normalizeGameGenres(["Adventure", "Role-playing (RPG)", "Shooter"])).toEqual([
      "Aventure",
      "RPG",
      "Tir",
    ])
  })

  it("is idempotent (already-French values pass through)", () => {
    const fr = ["Aventure", "RPG", "Tir"]
    expect(normalizeGameGenres(fr)).toEqual(fr)
  })

  it("passes through unknown values unchanged", () => {
    expect(normalizeGameGenres(["Adventure", "Totally New Genre"])).toEqual([
      "Aventure",
      "Totally New Genre",
    ])
  })

  it("de-dupes after mapping (e.g. Shooter + Fighting stay distinct, dupes collapse)", () => {
    expect(normalizeGameGenres(["Adventure", "Adventure"])).toEqual(["Aventure"])
  })

  it("handles null / empty", () => {
    expect(normalizeGameGenres(null)).toEqual([])
    expect(normalizeGameGenres([])).toEqual([])
  })

  it("every UI topic is a reachable normalized value (no orphan filter labels)", () => {
    const frValues = new Set(Object.values(IGDB_GENRE_FR))
    for (const topic of GAME_GENRE_TOPICS) {
      expect(frValues.has(topic)).toBe(true)
    }
  })
})
