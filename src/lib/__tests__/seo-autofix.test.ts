import { describe, expect, it } from "vitest"
import {
  normalize,
  significantTokens,
  keywordPresent,
  isJunkQuery,
  scoreNeighbor,
  rewritePasses,
  ageMentionReadsNaturally,
  isSaturated,
  synopsisStuffingReason,
  rewriteRejection,
  META_SEO_PATTERNS,
  decideSeoTitle,
  refusalsDetail,
  homonymYear,
  type SeoActionTarget,
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
      "familles à la recherche": "Une fresque sombre, idéale pour familles cherchant du frisson.",
      "trouveront ici": "Les parents trouveront ici une aventure tendre, dès 6 ans.",
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

describe("META_SEO_PATTERNS élargis (27 Nov 2026)", () => {
  it("refuses the shapes the Director hand-cleaned", () => {
    const drafts = [
      // No article in front of « familles ».
      "Dès 14 ans, deux sœurs s'affrontent dans une cité divisée, idéal pour familles cherchant une série exigeante.",
      "Dès 6 ans, une pieuvre curieuse remonte des abysses : parfait pour familles qui cherchent un divertissement.",
      "Dès 12 ans, un chasseur de primes protège un enfant, pour les familles à la recherche d'une saga spatiale.",
      // The page talking about itself.
      "Dès 16 ans, deux inspecteurs traquent un tueur ; les familles trouveront ici un thriller très sombre.",
    ]
    for (const d of drafts) expect(synopsisStuffingReason("titre age", "Titre", d), d).toMatch(/^formulation SEO/)
  })

  it("still lets plot through", () => {
    const plots = [
      "Deux enfants partent à la recherche de leur chien, dès 6 ans.",
      "Une famille cherchant un nouveau foyer traverse l'océan.",
      "Ils trouveront leur chemin ici et là, au fil d'une aventure tendre.",
    ]
    for (const p of plots) expect(synopsisStuffingReason("titre age", "Titre", p), p).toBeNull()
  })
})

describe("decideSeoTitle (titre SEO déterministe, 27 Nov 2026)", () => {
  const base = {
    query: "arcane age",
    title: "Arcane",
    age: 14,
    isEnriched: true,
    storedSeoTitle: null,
    titleNeedsKeyword: true,
    homonym: false,
    releaseDate: "2021-11-06",
    capReached: false,
  }

  it("always writes the canonical form — no model, no keyword requirement", () => {
    expect(decideSeoTitle(base)).toEqual({ action: "write", title: "Arcane — âge conseillé : dès 14 ans" })
    // « scrooge 2026 age » on the 1970 fiche used to be refused « mot-clé
    // toujours absent »; the canonical form (with its year) is now written.
    expect(
      decideSeoTitle({ ...base, query: "scrooge 2026 age", title: "Scrooge", age: 8, homonym: true, releaseDate: "1970-11-05" }),
    ).toEqual({ action: "write", title: "Scrooge (1970) — âge conseillé : dès 8 ans" })
    expect(decideSeoTitle({ ...base, query: "bluey film", title: "Bluey", age: 0 })).toEqual({
      action: "write",
      title: "Bluey — âge conseillé : tous publics",
    })
  })

  it("never overwrites a stored title that is already canonical", () => {
    expect(decideSeoTitle({ ...base, storedSeoTitle: "Arcane — âge conseillé : dès 14 ans" })).toEqual({ action: "covered" })
    // A human chose to name the year: still canonical.
    expect(decideSeoTitle({ ...base, storedSeoTitle: "Arcane (2021) — âge conseillé : dès 14 ans" })).toEqual({
      action: "covered",
    })
  })

  it("replaces a stored title in an old form or with a stale age", () => {
    expect(decideSeoTitle({ ...base, storedSeoTitle: "Arcane : à partir de quel âge ? Dès 14 ans" })).toEqual({
      action: "write",
      title: "Arcane — âge conseillé : dès 14 ans",
    })
    expect(decideSeoTitle({ ...base, storedSeoTitle: "Arcane — âge conseillé : dès 12 ans" })).toEqual({
      action: "write",
      title: "Arcane — âge conseillé : dès 14 ans",
    })
    // A homonym's canonical title must carry ITS year.
    expect(
      decideSeoTitle({
        ...base,
        title: "Scrooge",
        age: 8,
        homonym: true,
        releaseDate: "1970-11-05",
        storedSeoTitle: "Scrooge — âge conseillé : dès 8 ans",
      }),
    ).toEqual({ action: "write", title: "Scrooge (1970) — âge conseillé : dès 8 ans" })
  })

  it("leaves the field alone when the canonical form is too long", () => {
    const long = "Les Animaux fantastiques : Les Crimes de Grindelwald"
    expect(decideSeoTitle({ ...base, title: long, age: 10 })).toEqual({ action: "too-long" })
  })

  it("respects the cap, the gates before it, and fails closed on homonyms", () => {
    expect(decideSeoTitle({ ...base, capReached: true })).toEqual({ action: "deferred-cap" })
    expect(decideSeoTitle({ ...base, titleNeedsKeyword: false })).toEqual({ action: "n/a" })
    expect(decideSeoTitle({ ...base, isEnriched: false, age: null })).toEqual({ action: "not-enriched" })
    expect(decideSeoTitle({ ...base, query: "arcane streaming gratuit" })).toEqual({ action: "flagged-junk" })
    expect(decideSeoTitle({ ...base, homonym: null })).toEqual({ action: "refused", refusal: "homonymes non vérifiés" })
    expect(decideSeoTitle({ ...base, homonym: true, releaseDate: null })).toEqual({
      action: "refused",
      refusal: "homonyme sans année de sortie",
    })
    expect(decideSeoTitle({ ...base, age: null })).toEqual({ action: "refused", refusal: "âge inconnu" })
  })

  it("still writes on a provisional fiche that carries an age", () => {
    expect(decideSeoTitle({ ...base, isEnriched: false, age: 12, title: "L'Odyssée", query: "odyssee age" })).toEqual({
      action: "write",
      title: "L'Odyssée — âge conseillé : dès 12 ans",
    })
  })
})

describe("refusalsDetail", () => {
  const target = (partial: Partial<SeoActionTarget>): SeoActionTarget => ({
    routeId: "id",
    title: "Arcane",
    type: "TV",
    query: "arcane age",
    position: 9,
    linksCreated: [],
    synopsis: "covered",
    titleNeedsKeyword: true,
    seoTitle: "n/a",
    ...partial,
  })

  it("lists refusals with their draft cut to 300 characters", () => {
    const long = "x".repeat(400)
    const out = refusalsDetail([
      target({ synopsis: "refused", synopsisRefusal: "mot-clé toujours absent", synopsisRejected: long }),
      target({ title: "Scrooge", seoTitle: "refused", seoTitleRefusal: "homonymes non vérifiés" }),
    ])
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ title: "Arcane", query: "arcane age", lever: "synopsis", reason: "mot-clé toujours absent" })
    expect(out[0].draft?.length).toBe(300)
    expect(out[1]).toEqual({ title: "Scrooge", query: "arcane age", lever: "seoTitle", reason: "homonymes non vérifiés" })
  })

  it("never lists a failed model answer, and keeps at most 30 entries", () => {
    expect(refusalsDetail([target({ synopsis: "ai-failed" })])).toEqual([])
    const many = Array.from({ length: 40 }, () =>
      target({ synopsis: "refused", synopsisRefusal: "trop long", synopsisRejected: "…" }),
    )
    expect(refusalsDetail(many)).toHaveLength(30)
  })
})
