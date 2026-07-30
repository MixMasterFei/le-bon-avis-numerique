import { describe, expect, it } from "vitest"
import {
  normalize,
  significantTokens,
  keywordPresent,
  isJunkQuery,
  scoreNeighbor,
  seoTitlePasses,
  rewritePasses,
  ageMentionReadsNaturally,
  isSaturated,
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

  it("does not require media-format words (film/série/jeu) in the copy", () => {
    // "backrooms film age" — natural copy answers the age, never says "film".
    expect(
      keywordPresent("backrooms film age", "Backrooms : exploration angoissante, déconseillé avant 14 ans."),
    ).toBe(true)
  })

  it("treats an age intent as covered by an explicit age phrasing", () => {
    expect(keywordPresent("toy story 5 age", "Toy Story 5 — aventure familiale dès 6 ans.")).toBe(true)
    expect(keywordPresent("toy story 5 age", "Toy Story 5 — aventure familiale réussie.")).toBe(false)
  })

  it("does not let 'dans'/'sans' masquerade as an age answer", () => {
    // "ans" must be a whole word, not a substring of dans/sans.
    expect(keywordPresent("backrooms age", "Backrooms se déroule dans des couloirs sans fin.")).toBe(false)
  })

  it("still requires the genuine ranking keyword (not just the title)", () => {
    expect(keywordPresent("backrooms age minimum", "Backrooms : couloirs infinis.")).toBe(false)
  })

  it("does not require age-intent MODIFIERS as literal words", () => {
    // "minimum"/"quel"/"à partir de" phrase the question — natural copy answers
    // with "dès 16 ans" and never says "l'âge minimum est". These queries were
    // permanently unsatisfiable before, making the write-side agent a no-op.
    expect(
      keywordPresent("obsession film age minimum", "Obsession", "Un vœu exaucé au prix fort — dès 16 ans."),
    ).toBe(true)
    expect(
      keywordPresent("toy story 5 à partir de quel âge", "Toy Story 5", "Les jouets repartent à l'aventure, dès 6 ans."),
    ).toBe(true)
    expect(
      keywordPresent("spider man brand new day interdit au moins de", "Spider-Man: Brand New Day — dès 12 ans"),
    ).toBe(true)
  })

  it("still requires the AGE itself even when modifiers are relaxed", () => {
    expect(keywordPresent("obsession film age minimum", "Obsession", "Un vœu exaucé au prix fort.")).toBe(false)
  })
})

describe("rewritePasses", () => {
  it("counts the TITLE toward keyword coverage (synopses never repeat their own title)", () => {
    expect(
      rewritePasses(
        "age toy story 5",
        "Toy Story 5",
        "Les jouets bien-aimés quittent leur zone familière.",
        "Les jouets repartent pour une aventure pleine d'émotion, à partager dès 6 ans.",
      ),
    ).toBe(true)
  })

  it("rejects a draft that still misses the ranking intent", () => {
    expect(
      rewritePasses(
        "age toy story 5",
        "Toy Story 5",
        "Les jouets bien-aimés quittent leur zone familière.",
        "Les jouets repartent pour une aventure pleine d'émotion.",
      ),
    ).toBe(false)
  })

  it("rejects a gutted draft (less than half the original)", () => {
    expect(
      rewritePasses(
        "age toy story 5",
        "Toy Story 5",
        "Un synopsis long et détaillé qui décrit précisément l'intrigue, les personnages et les thèmes du film pour les parents.",
        "Dès 6 ans.",
      ),
    ).toBe(false)
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

  it("does not flag a bare 'regarder' age query (only 'regarder en …' is navigational)", () => {
    expect(isJunkQuery("my dress up darling age pour regarder")).toBe(false)
    expect(isJunkQuery("regarder my dress up darling en ligne")).toBe(true)
  })
})

describe("isSaturated", () => {
  const base = {
    routeId: "id", title: "T", type: "MOVIE", query: "q", position: 10,
    linksCreated: [] as string[], titleNeedsKeyword: false,
  }

  it("is true only when every lever has nothing left to do", () => {
    expect(
      isSaturated({ ...base, linksSkippedReason: "déjà 13 liens dont 4 SEO", synopsis: "covered", seoTitle: "n/a" }),
    ).toBe(true)
  })

  it("is false when a link was actually created", () => {
    expect(
      isSaturated({ ...base, linksCreated: ["Voisin"], synopsis: "covered", seoTitle: "n/a" }),
    ).toBe(false)
  })

  it("is false when a lever was blocked rather than complete", () => {
    // The whole point: a rejected rewrite must NOT read as "already optimised".
    expect(
      isSaturated({ ...base, linksSkippedReason: "déjà 13 liens dont 4 SEO", synopsis: "ai-failed", seoTitle: "n/a" }),
    ).toBe(false)
    expect(
      isSaturated({ ...base, linksSkippedReason: "déjà 13 liens dont 4 SEO", synopsis: "covered", seoTitle: "deferred-cap" }),
    ).toBe(false)
  })

  it("is false when maillage was skipped for lack of candidates but copy is done", () => {
    // No reason recorded at all = we don't know; never claim saturation.
    expect(isSaturated({ ...base, synopsis: "covered", seoTitle: "n/a" })).toBe(false)
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

describe("ageMentionReadsNaturally", () => {
  it("rejects an age dropped mid-clause", () => {
    // The real regression: this shipped to the meta description of the site's
    // #2 page and reads as "Peter Parker has been a superhero since age 12".
    expect(
      ageMentionReadsNaturally(
        "Peter Parker jongle entre ses devoirs de lycéen et sa vie de super-héros dès 12 ans, quand de nouveaux ennemis menacent New York.",
      ),
    ).toBe(false)
  })

  it("accepts an age that opens the synopsis", () => {
    expect(ageMentionReadsNaturally("Dès 6 ans : les jouets quittent leur foyer.")).toBe(true)
    expect(ageMentionReadsNaturally("Dès 12 ans. Un jeune cinéaste se réveille.")).toBe(true)
    expect(ageMentionReadsNaturally("Dès 16 ans — Pour séduire son béguin.")).toBe(true)
  })

  it("accepts an age that closes a sentence", () => {
    expect(
      ageMentionReadsNaturally("Les jouets repartent pour une aventure, à partager dès 6 ans."),
    ).toBe(true)
  })

  it("accepts an age introduced by a recommendation word", () => {
    expect(ageMentionReadsNaturally("Un récit d'aventure, conseillé dès 12 ans, pour les familles.")).toBe(true)
    expect(ageMentionReadsNaturally("Un conte adapté dès 10 ans, qui change le regard.")).toBe(true)
    expect(ageMentionReadsNaturally("Un film familial dès 8 ans, porté par ses décors.")).toBe(true)
  })

  it("accepts a synopsis with no age mention at all", () => {
    expect(ageMentionReadsNaturally("Un directeur de poste découvre le Nord.")).toBe(true)
  })

  it("is applied by rewritePasses", () => {
    expect(
      rewritePasses(
        "spider man brand new day age",
        "Spider-Man: Brand New Day",
        "Peter Parker jongle entre ses devoirs de lycéen et sa vie de super-héros.",
        "Peter Parker jongle entre ses devoirs de lycéen et sa vie de super-héros dès 12 ans, quand de nouveaux ennemis menacent New York.",
      ),
    ).toBe(false)
  })
})
