import { describe, expect, it } from "vitest"
import {
  normalize,
  significantTokens,
  keywordPresent,
  isJunkQuery,
  scoreNeighbor,
  seoTitlePasses,
} from "../seo-autofix"

describe("normalize", () => {
  it("lowercases, strips accents and punctuation", () => {
    expect(normalize("Roméo + Juliette")).toBe("romeo juliette")
    expect(normalize("La douce agonie d'Adam")).toBe("la douce agonie d adam")
  })
})

describe("significantTokens", () => {
  it("drops stopwords and 1-char tokens", () => {
    expect(significantTokens("avis de fil et de sang")).toEqual(["fil", "sang"])
    expect(significantTokens("roméo + juliette âge conseillé")).toEqual([
      "romeo",
      "juliette",
      "age",
      "conseille",
    ])
  })
})

describe("keywordPresent", () => {
  it("matches when every significant token appears in the copy", () => {
    expect(keywordPresent("la douce agonie d'adam", "La Douce Agonie d'Adam")).toBe(true)
    // accent-insensitive against the synopsis
    expect(keywordPresent("âge conseillé", "Synopsis... dès 12 ans, age conseille indiqué")).toBe(true)
  })

  it("returns false when a significant token is missing", () => {
    expect(keywordPresent("roméo + juliette âge conseillé", "Roméo + Juliette")).toBe(false)
  })

  it("treats a query with only stopwords as covered (nothing to add)", () => {
    expect(keywordPresent("le la les", "n'importe quoi")).toBe(true)
  })
})

describe("isJunkQuery", () => {
  it("flags navigational / piracy / streaming intent", () => {
    expect(isJunkQuery("regarder X en streaming")).toBe(true)
    expect(isJunkQuery("the sheep detectives le films vf")).toBe(true)
    expect(isJunkQuery("X complet gratuit")).toBe(true)
  })

  it("leaves clean editorial queries alone", () => {
    expect(isJunkQuery("avis de fil et de sang")).toBe(false)
    expect(isJunkQuery("roméo + juliette âge conseillé")).toBe(false)
  })
})

describe("scoreNeighbor", () => {
  const target = {
    genres: ["Animation", "Famille"],
    topics: ["amitié"],
    director: "Jane Doe",
    expertAgeRec: 6,
  }

  it("rewards genre overlap, same director, age proximity, shared topics", () => {
    const strong = scoreNeighbor(target, {
      genres: ["Animation", "Famille"],
      topics: ["amitié"],
      director: "Jane Doe",
      expertAgeRec: 7,
      tmdbRating: 8,
    })
    // 2 genres*1.5 (3) + director (4) + age<=2 (2) + 1 topic (1) + 8/10 (0.8) = 10.8
    expect(strong).toBeCloseTo(10.8, 5)
  })

  it("scores an unrelated candidate at zero", () => {
    expect(
      scoreNeighbor(target, {
        genres: ["Horreur"],
        topics: [],
        director: "Someone Else",
        expertAgeRec: 18,
        tmdbRating: null,
      }),
    ).toBe(0)
  })
})

describe("seoTitlePasses", () => {
  it("accepts a faithful title that adds the keyword within the length cap", () => {
    expect(
      seoTitlePasses(
        "tigre et dragon age minimum",
        "Tigre et Dragon",
        "Tigre et Dragon : âge minimum ? Avis famille (dès 12 ans)",
      ),
    ).toBe(true)
  })

  it("rejects when the real work title is missing (no silent rename)", () => {
    expect(
      seoTitlePasses("tigre et dragon age minimum", "Tigre et Dragon", "Âge minimum d'un film d'action"),
    ).toBe(false)
  })

  it("rejects when the ranking keyword still isn't covered", () => {
    expect(
      seoTitlePasses("tigre et dragon age minimum", "Tigre et Dragon", "Tigre et Dragon — film culte"),
    ).toBe(false)
  })

  it("rejects an over-long title (> SEO cap)", () => {
    const tooLong = "Tigre et Dragon : à partir de quel âge minimum pour le regarder en famille sans souci"
    expect(seoTitlePasses("tigre et dragon age minimum", "Tigre et Dragon", tooLong)).toBe(false)
  })

  it("rejects a junk/navigational candidate", () => {
    expect(
      seoTitlePasses("tigre et dragon age", "Tigre et Dragon", "Tigre et Dragon streaming gratuit age"),
    ).toBe(false)
  })
})
