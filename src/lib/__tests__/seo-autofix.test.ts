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
  synopsisStuffingReason,
  rewriteRejection,
  META_SEO_PATTERNS,
  normalizeSeoTitle,
  prepareSeoTitle,
  homonymYear,
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

  it("matches a work name typed fused (« spiderman » for « Spider-Man »)", () => {
    // The #1 striking query of Sept. 2026. Unmatched, the fiche could never be
    // "covered" and the agent burned its budget on it every week.
    const title = "Spider-Man: Brand New Day — Quel âge ? Dès 12 ans"
    expect(keywordPresent("spiderman brand new day age", title)).toBe(true)
    expect(keywordPresent("spiderman quel age", title)).toBe(true)
    // The split spelling already matched — keep it that way.
    expect(keywordPresent("spider man age minimum", "Spiderman — dès 12 ans")).toBe(true)
  })

  it("does not fuse short tokens across unrelated words", () => {
    // "sonic" would appear in "...son icône..." once spaces are dropped.
    expect(keywordPresent("sonic age", "Son icône du jeu vidéo, dès 7 ans.")).toBe(false)
    // A fused name still needs the rest of the query.
    expect(keywordPresent("spiderman brand new day age", "Spider-Man: Brand New Day")).toBe(false)
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
        "Tigre et Dragon : âge minimum ? Dès 12 ans",
      ),
    ).toBe(true)
  })

  it("rejects a title over the real SERP budget (52 + « | Totem Avisé »)", () => {
    // 57 chars passed the old local 65 cap and clipped in Google — the layout
    // suffix makes the true page-specific budget MAX_TITLE (52).
    expect(
      seoTitlePasses(
        "tigre et dragon age minimum",
        "Tigre et Dragon",
        "Tigre et Dragon : âge minimum ? Avis famille (dès 12 ans)",
      ),
    ).toBe(false)
  })

  it("rejects a title asserting an age the fiche disagrees with", () => {
    // "dès 6 ans" over an 8-ans verdict shipped to production (The Sheep
    // Detectives) — the SERP must never contradict the page.
    expect(
      seoTitlePasses("sheep detectives age", "The Sheep Detectives", "The Sheep Detectives — dès 6 ans", 8),
    ).toBe(false)
    expect(
      seoTitlePasses("sheep detectives age", "The Sheep Detectives", "The Sheep Detectives — dès 8 ans", 8),
    ).toBe(true)
    // No age wording in the candidate → nothing to contradict.
    expect(
      seoTitlePasses("sheep detectives age", "The Sheep Detectives", "The Sheep Detectives — quel âge ?", 8),
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

describe("synopsisStuffingReason (garde-fou bourrage, 21 Nov 2026)", () => {
  it("refuses the 19 Nov Arcane draft (query quoted in « »)", () => {
    const draft =
      "À Piltover et Zaun, deux sœurs se déchirent. Une série d'animation idéale pour les familles cherchant un contenu « arcane age » réfléchi, dès 14 ans."
    expect(synopsisStuffingReason("arcane age", "Arcane", draft)).toBe("requête citée entre guillemets")
  })

  it("refuses the 19 Nov Les 101 Dalmatiens draft (« suggestions autour de »)", () => {
    const draft =
      "Pongo et Perdita partent sauver leurs chiots enlevés par Cruella. Dès 6 ans, avec des suggestions autour de 101 dalmatiens."
    expect(synopsisStuffingReason("101 dalmatiens", "Les 101 Dalmatiens", draft)).toMatch(/^formulation SEO/)
  })

  it("refuses a query quoted with straight or curly quotes too", () => {
    expect(synopsisStuffingReason("bluey age", "Bluey", 'Une chienne joueuse, pour "bluey age" et plus.')).toBe(
      "requête citée entre guillemets",
    )
    expect(synopsisStuffingReason("bluey age", "Bluey", "Une chienne joueuse, “Bluey âge” compris.")).toBe(
      "requête citée entre guillemets",
    )
  })

  it("lets the work's own title be quoted when the query IS the title", () => {
    expect(synopsisStuffingReason("arcane", "Arcane", "La série « Arcane » suit deux sœurs, dès 14 ans.")).toBeNull()
  })

  it("refuses the raw query verbatim when it carries an age word", () => {
    expect(
      synopsisStuffingReason("arcane age", "Arcane", "Arcane âge conseillé dès 14 ans : deux sœurs s'affrontent."),
    ).toBe("requête recopiée telle quelle")
    expect(
      synopsisStuffingReason(
        "bluey a partir de quel age",
        "Bluey",
        "Bluey à partir de quel âge ? Dès 3 ans, une chienne invente des jeux.",
      ),
    ).toBe("requête recopiée telle quelle")
  })

  it("accepts a natural draft that names the work and the age", () => {
    expect(
      synopsisStuffingReason(
        "arcane age",
        "Arcane",
        "Dès 14 ans, Arcane suit Vi et Jinx, deux sœurs que la guerre entre Piltover et Zaun sépare.",
      ),
    ).toBeNull()
  })

  it("does not mistake plot for search talk", () => {
    const plots = [
      "Marlin part à la recherche de son fils Nemo à travers l'océan, dès 6 ans.",
      "Un garçon cherchant un moyen de rentrer chez lui traverse un monde enchanté.",
      "Ses parents recherchent leur fille disparue dans la forêt.",
      "Un laboratoire de recherche cache un secret, à voir dès 12 ans.",
    ]
    for (const p of plots) expect(synopsisStuffingReason("film age", "Titre", p)).toBeNull()
  })

  it("matches each meta-SEO phrase it lists", () => {
    const samples: Record<string, string> = {
      contenu: "Un contenu familial dès 8 ans.",
      suggestions: "Des suggestions pour toute la famille.",
      "requête": "Répond à votre requête.",
      "mot-clé": "Le mot-clé de la soirée.",
      "référencement": "Optimisé pour le référencement.",
      "moteur de recherche": "Le moteur de recherche le confirme.",
      "votre recherche": "Parfait pour votre recherche.",
      "recherche en ligne": "Après une recherche en ligne, dès 8 ans.",
      "familles qui cherchent": "Idéal pour les parents qui cherchent un film.",
      "vous cherchez": "Si vous cherchez un dessin animé, dès 3 ans.",
    }
    for (const { label, re } of META_SEO_PATTERNS) {
      expect(samples[label], `sample for ${label}`).toBeDefined()
      expect(re.test(normalize(samples[label])), label).toBe(true)
      expect(synopsisStuffingReason("x age", "Titre", samples[label])).toBe(`formulation SEO (« ${label} »)`)
    }
  })
})

describe("rewriteRejection", () => {
  const before = "Pongo et Perdita vivent heureux à Londres avec leurs quinze chiots."
  it("names the stuffing reason instead of a bare false", () => {
    expect(
      rewriteRejection(
        "101 dalmatiens age",
        "Les 101 Dalmatiens",
        before,
        "Pongo et Perdita sauvent leurs chiots de Cruella, un contenu à partager dès 6 ans.",
      ),
    ).toBe("formulation SEO (« contenu »)")
  })
  it("returns null for a clean draft (rewritePasses agrees)", () => {
    const after = "Pongo et Perdita partent sauver leurs chiots enlevés par Cruella, une aventure à partager dès 6 ans."
    expect(rewriteRejection("101 dalmatiens age", "Les 101 Dalmatiens", before, after)).toBeNull()
    expect(rewritePasses("101 dalmatiens age", "Les 101 Dalmatiens", before, after)).toBe(true)
  })
})

describe("normalizeSeoTitle / prepareSeoTitle (forme canonique)", () => {
  const ctx = { title: "Arcane", age: 14 }
  it("rewrites any faithful draft into the canonical form", () => {
    for (const draft of [
      "Arcane : à partir de quel âge ? Dès 14 ans",
      "Arcane — Âge conseillé : Dès 14 ans",
      "Arcane - quel âge ?",
      "arcane, âge minimum",
    ]) {
      expect(normalizeSeoTitle(draft, ctx)).toEqual({ title: "Arcane — âge conseillé : dès 14 ans" })
    }
  })
  it("writes « tous publics » for a TP fiche", () => {
    expect(normalizeSeoTitle("Bluey — Tous publics", { title: "Bluey", age: 0 })).toEqual({
      title: "Bluey — âge conseillé : tous publics",
    })
  })
  it("refuses a draft that drops the work or contradicts the age", () => {
    expect(normalizeSeoTitle("Série animée culte : quel âge ?", ctx)).toEqual({ refusal: "titre de l'œuvre absent" })
    expect(normalizeSeoTitle("Arcane — dès 12 ans", ctx)).toEqual({ refusal: "âge contredit la fiche" })
    expect(normalizeSeoTitle("", ctx)).toEqual({ refusal: "réponse vide" })
    expect(normalizeSeoTitle("Arcane streaming", ctx)).toEqual({ refusal: "vocabulaire navigationnel" })
  })
  it("refuses when the canonical form can't be built", () => {
    expect(normalizeSeoTitle("Arcane — quel âge ?", { title: "Arcane", age: null })).toEqual({
      refusal: "âge inconnu",
    })
    const long = "Les Animaux fantastiques : Les Crimes de Grindelwald"
    expect(normalizeSeoTitle(`${long} — dès 10 ans`, { title: long, age: 10 })).toEqual({
      refusal: "trop long pour la forme canonique",
    })
  })
  it("puts the year in a homonym's title", () => {
    expect(
      prepareSeoTitle("scrooge age", { title: "Scrooge", age: 8, year: 1970 }, "Scrooge : quel âge ? Dès 8 ans"),
    ).toEqual({ title: "Scrooge (1970) — âge conseillé : dès 8 ans" })
  })
  it("refuses when the canonical form still misses the ranking keyword", () => {
    // « scrooge 2026 age » on the 1970 fiche: the right answer is NOT to claim 2026.
    expect(
      prepareSeoTitle("scrooge 2026 age", { title: "Scrooge", age: 8, year: 1970 }, "Scrooge 2026 — dès 8 ans"),
    ).toEqual({ refusal: "mot-clé toujours absent" })
  })
})

describe("homonymYear", () => {
  it("no homonym → no year", () => {
    expect(homonymYear(false, "1970-11-05")).toEqual({ year: null })
  })
  it("homonym → its release year", () => {
    expect(homonymYear(true, new Date("1970-11-05T00:00:00Z"))).toEqual({ year: 1970 })
    expect(homonymYear(true, "2026-11-11")).toEqual({ year: 2026 })
  })
  it("fails closed on a homonym without a year or a failed lookup", () => {
    expect(homonymYear(true, null)).toEqual({ refusal: "homonyme sans année de sortie" })
    expect(homonymYear(null, "1970-11-05")).toEqual({ refusal: "homonymes non vérifiés" })
  })
})
