import { describe, it, expect } from "vitest"
import {
  AGE_REFERENCE_GAMES,
  AGE_REFERENCE_SCREEN,
  CALIBRATION_HELD_OUT_TITLES,
  buildAgeCalibrationBlock,
  buildEnrichmentPrompt,
} from "../enrichment-analysis"

const normalize = (title: string) =>
  title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const ALL_REFERENCES = [...AGE_REFERENCE_SCREEN, ...AGE_REFERENCE_GAMES]

describe("house age scale — catalogue reference titles", () => {
  it("never uses a title of a calibration test set as a reference (the measurement would be void)", () => {
    const heldOut = new Set(CALIBRATION_HELD_OUT_TITLES.map(normalize))
    const leaks = ALL_REFERENCES.filter((ref) => heldOut.has(normalize(ref.title))).map((ref) => ref.title)
    expect(leaks).toEqual([])
  })

  it("lists each reference once, with a valid age and 0-5 scores", () => {
    const titles = ALL_REFERENCES.map((ref) => normalize(ref.title))
    expect(new Set(titles).size).toBe(titles.length)
    for (const ref of ALL_REFERENCES) {
      expect(ref.age).toBeGreaterThanOrEqual(3)
      expect(ref.age).toBeLessThanOrEqual(18)
      expect(ref.metrics).toHaveLength(4)
      for (const score of ref.metrics) {
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(5)
      }
    }
  })

  it("keeps the references in age order, so the prompt reads as a scale", () => {
    for (const list of [AGE_REFERENCE_SCREEN, AGE_REFERENCE_GAMES]) {
      const ages = list.map((ref) => ref.age)
      expect(ages).toEqual([...ages].sort((a, b) => a - b))
    }
  })

  it("reserves 18 for the rare cases: one screen reference, PEGI 18 for games", () => {
    expect(AGE_REFERENCE_SCREEN.filter((ref) => ref.age === 18)).toHaveLength(1)
    for (const ref of AGE_REFERENCE_GAMES.filter((r) => r.age === 18)) {
      expect(ref.official).toBe("PEGI 18")
    }
  })

  it("game references never sit below their PEGI (PEGI is a legal minimum)", () => {
    for (const ref of AGE_REFERENCE_GAMES) {
      const pegi = Number(ref.official?.replace("PEGI ", ""))
      expect(ref.age).toBeGreaterThanOrEqual(pegi)
    }
  })
})

describe("enrichment prompt — calibration block", () => {
  it("films and series get the house scale, the screen references and the series / official-rating rules", () => {
    for (const type of ["MOVIE", "TV"]) {
      const prompt = buildEnrichmentPrompt({ title: "X", type, genres: ["Drame"] })
      expect(prompt).toContain("AGE CONSEILLE — ECHELLE MAISON")
      expect(prompt).toContain("- 16 ans : Breaking Bad (serie) · V4 S1 L4 Sub5")
      expect(prompt).toContain("- 12 ans : Naruto (anime, classification -16) · V3 S0 L1 Sub0")
      expect(prompt).toContain("SERIES:")
      expect(prompt).toContain("CLASSIFICATION OFFICIELLE (films et series)")
      expect(prompt).not.toContain("JEUX VIDEO:")
      expect(prompt).not.toContain("Animal Crossing")
      expect(prompt).not.toContain("Rocket League")
    }
  })

  it("games get the game references and the PEGI rules, not the screen references", () => {
    const prompt = buildEnrichmentPrompt({ title: "X", type: "GAME", genres: [], officialRating: "PEGI_3" })
    expect(prompt).toContain("AGE CONSEILLE — ECHELLE MAISON")
    expect(prompt).toContain("JEUX VIDEO:")
    expect(prompt).toContain("- 3 ans : Animal Crossing: New Horizons (jeu, classification PEGI 3) · V0 S0 L0 Sub0")
    // The axis scale cites screen titles as examples; the reference LINES are type-specific.
    expect(prompt).not.toContain("- 16 ans : Breaking Bad")
    expect(prompt).not.toContain("SERIES:")
  })

  it("drops the one-way « relève l'âge » and « indice FAIBLE » wording for films, series and games", () => {
    for (const type of ["MOVIE", "TV", "GAME"]) {
      const prompt = buildEnrichmentPrompt({ title: "X", type, genres: [] })
      expect(prompt).not.toContain("RELEVER l'age")
      expect(prompt).not.toContain("indice FAIBLE")
      // The 6-8 ans cap on the sensible axes is kept.
      expect(prompt).toContain("ne doit PAS porter de score > 2")
    }
  })

  it("leaves the manga prompt on its previous age instructions", () => {
    const prompt = buildEnrichmentPrompt({ title: "X", type: "MANGA", genres: [], demographic: "Shounen" })
    expect(prompt).not.toContain("ECHELLE MAISON")
    expect(prompt).toContain("CLASSIFICATION OFFICIELLE (indice FAIBLE)")
    expect(prompt).toContain("demande-toi d'abord s'il faut RELEVER l'age conseille")
    expect(prompt).toContain("PARTICULARITES MANGA")
  })

  it("is the same block the prompt embeds", () => {
    expect(buildEnrichmentPrompt({ title: "X", type: "TV", genres: [] })).toContain(buildAgeCalibrationBlock("TV"))
    expect(buildEnrichmentPrompt({ title: "X", type: "GAME", genres: [] })).toContain(buildAgeCalibrationBlock("GAME"))
  })
})
