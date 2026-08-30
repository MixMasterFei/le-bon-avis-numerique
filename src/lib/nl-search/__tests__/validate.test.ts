import { describe, expect, it } from "vitest"
import {
  hasStructuredParams,
  intentFromSearchParams,
  intentToSearchParams,
  validateNlIntent,
} from "../validate"

describe("validateNlIntent — happy path", () => {
  it("keeps a well-formed interpretation", () => {
    const intent = validateNlIntent({
      mediaType: "MOVIE",
      maxAge: 8,
      themes: ["Animaux"],
      eviter: ["peur"],
      libelles: ["films d'animaux", "jusqu'à 8 ans"],
    })
    expect(intent.mode).toBe("filtre")
    expect(intent.maxAge).toBe(8)
    expect(intent.themes).toEqual(["Animaux"])
    expect(intent.eviter).toEqual(["peur"])
    expect(intent.libelles).toEqual(["films d'animaux", "jusqu'à 8 ans"])
  })

  it("canonicalizes loosely-spelled themes", () => {
    const intent = validateNlIntent({ maxAge: 6, themes: ["animaux", "ESPACE"] })
    expect(intent.themes).toEqual(["Animaux", "Espace"])
  })

  it("routes a named work to the title path and drops its filters", () => {
    const intent = validateNlIntent({ titre: "Le Voyage de Chihiro", maxAge: 8 })
    expect(intent.mode).toBe("titre")
    expect(intent.titre).toBe("Le Voyage de Chihiro")
  })
})

describe("validateNlIntent — clamping", () => {
  it("clamps ages into 0-18", () => {
    expect(validateNlIntent({ maxAge: 40 }).maxAge).toBe(18)
    expect(validateNlIntent({ maxAge: -5 }).maxAge).toBe(0)
    expect(validateNlIntent({ maxAge: 7.9 }).maxAge).toBe(7)
  })

  it("drops an inverted age floor rather than returning an empty window", () => {
    const intent = validateNlIntent({ maxAge: 6, minAge: 12 })
    expect(intent.maxAge).toBe(6)
    expect(intent.minAge).toBeNull()
  })

  it("caps the number of themes, platforms and labels", () => {
    const intent = validateNlIntent({
      maxAge: 10,
      themes: ["Animaux", "Espace", "Magie", "Sport", "Musique"],
      platforms: ["Netflix", "Disney+", "Max"],
      libelles: ["a", "b", "c", "d", "e", "f"],
    })
    expect(intent.themes).toHaveLength(3)
    expect(intent.platforms).toHaveLength(2)
    expect(intent.libelles).toHaveLength(4)
  })

  it("de-duplicates repeated values", () => {
    const intent = validateNlIntent({ maxAge: 8, themes: ["Animaux", "animaux", "ANIMAUX"] })
    expect(intent.themes).toEqual(["Animaux"])
  })

  it("sanitizes display labels: control chars out, length capped", () => {
    const intent = validateNlIntent({
      maxAge: 8,
      libelles: ["jusqu'\u00e0\u00008 ans", "x".repeat(120)],
    })
    expect(intent.libelles[0]).not.toContain("\u0000")
    expect(intent.libelles[1].length).toBeLessThanOrEqual(40)
  })
})

describe("validateNlIntent — adversarial input", () => {
  // The core safety property: the model can only pick FROM the vocabulary, so a
  // request for mature content can't introduce a matching filter, and the age
  // it extracts is the age the engine gates on.
  it("drops themes outside the vocabulary, keeping the stated age", () => {
    const intent = validateNlIntent({ maxAge: 5, themes: ["Guerre", "Horreur", "Animaux"] })
    expect(intent.maxAge).toBe(5)
    expect(intent.themes).toEqual(["Animaux"])
  })

  it("ignores unknown avoid keys", () => {
    const intent = validateNlIntent({ maxAge: 8, eviter: ["peur", "plus_de_violence", ""] })
    expect(intent.eviter).toEqual(["peur"])
  })

  it("treats off-topic as terminal, whatever else was extracted", () => {
    const intent = validateNlIntent({ horsSujet: true, maxAge: 8, themes: ["Animaux"] })
    expect(intent.mode).toBe("hors_sujet")
    expect(intent.themes).toEqual([])
    expect(intent.maxAge).toBeNull()
  })

  it("falls back to keyword search on garbage input", () => {
    for (const bad of [null, undefined, 42, "texte", [], { themes: "pas-un-tableau" }]) {
      expect(validateNlIntent(bad).mode).toBe("texte")
    }
  })

  it("falls back to keyword search when nothing usable was extracted", () => {
    expect(validateNlIntent({ mediaType: "MOVIE", libelles: ["bonjour"] }).mode).toBe("texte")
  })

  it("normalizes an unknown media type to MOVIE", () => {
    expect(validateNlIntent({ mediaType: "PODCAST", maxAge: 8 }).mediaType).toBe("MOVIE")
  })
})

describe("validateNlIntent — secondary rail", () => {
  it("drops a younger-siblings rail when no age is known", () => {
    expect(validateNlIntent({ themes: ["Animaux"], railSecondaire: "plus_jeunes" }).railSecondaire).toBeNull()
  })

  it("keeps it when an age anchors it", () => {
    expect(validateNlIntent({ maxAge: 8, railSecondaire: "plus_jeunes" }).railSecondaire).toBe("plus_jeunes")
  })

  it("drops a series rail for games", () => {
    expect(
      validateNlIntent({ mediaType: "GAME", maxAge: 10, railSecondaire: "en_serie" }).railSecondaire,
    ).toBeNull()
  })

  it("ignores an unknown rail name", () => {
    expect(validateNlIntent({ maxAge: 8, railSecondaire: "carrousel" }).railSecondaire).toBeNull()
  })
})

describe("URL round-trip", () => {
  it("survives encode → decode unchanged", () => {
    const original = validateNlIntent({
      mediaType: "TV",
      maxAge: 8,
      themes: ["Animaux", "Nature"],
      platforms: ["Netflix"],
      eviter: ["peur"],
      railSecondaire: "plus_jeunes",
    })
    const params = intentToSearchParams(original, "un truc doux pour 8 ans")
    const restored = intentFromSearchParams(Object.fromEntries(params.entries()))

    expect(restored.mode).toBe(original.mode)
    expect(restored.mediaType).toBe("TV")
    expect(restored.maxAge).toBe(8)
    expect(restored.themes).toEqual(["Animaux", "Nature"])
    expect(restored.platforms).toEqual(["Netflix"])
    expect(restored.eviter).toEqual(["peur"])
    expect(restored.railSecondaire).toBe("plus_jeunes")
  })

  it("applies the same clamps to hand-edited URLs", () => {
    const restored = intentFromSearchParams({
      q: "test",
      age: "99",
      themes: "Horreur,Animaux",
      sans: "peur,inventé",
    })
    expect(restored.maxAge).toBe(18)
    expect(restored.themes).toEqual(["Animaux"])
    expect(restored.eviter).toEqual(["peur"])
  })

  it("round-trips the off-topic verdict", () => {
    const params = intentToSearchParams(validateNlIntent({ horsSujet: true }), "?????")
    expect(params.get("hs")).toBe("1")
    expect(intentFromSearchParams({ hs: "1" }).mode).toBe("hors_sujet")
  })

  it("detects structured params so a render can skip interpretation", () => {
    expect(hasStructuredParams({ q: "un film" })).toBe(false)
    expect(hasStructuredParams({ q: "un film", age: "8" })).toBe(true)
    expect(hasStructuredParams({ hs: "1" })).toBe(true)
  })

  it("omits defaults from the URL", () => {
    const params = intentToSearchParams(validateNlIntent({ mediaType: "MOVIE", maxAge: 8 }), "q")
    expect(params.has("type")).toBe(false)
    expect(params.get("age")).toBe("8")
  })
})
