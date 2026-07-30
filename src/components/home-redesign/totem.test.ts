import { describe, expect, it } from "vitest"
import { totemLevel, vigilanceAxisLevel, vigilanceMax, vigilanceTone, TOTEM_WORDS } from "./totem"

describe("vigilanceAxisLevel — cartoon-friendly bucketing + age anchor", () => {
  it("buckets raw scores: ≤2→0, 3→1, 4→2, 5→3 (no age)", () => {
    expect(vigilanceAxisLevel(0, null)).toBe(0)
    expect(vigilanceAxisLevel(2, null)).toBe(0)
    expect(vigilanceAxisLevel(3, null)).toBe(1)
    expect(vigilanceAxisLevel(4, null)).toBe(2)
    expect(vigilanceAxisLevel(5, null)).toBe(3)
  })

  it("Sonic-like: raw 3 on an 8+ title → léger (1)", () => {
    expect(vigilanceAxisLevel(3, 8)).toBe(1)
  })

  it("Jungle-Cruise-like: raw 4 on a 10+ title → à noter (2)", () => {
    expect(vigilanceAxisLevel(4, 10)).toBe(2)
  })

  it("age cap: a ≤8 title can't exceed léger even at raw 4/5", () => {
    expect(vigilanceAxisLevel(4, 6)).toBe(1)
    expect(vigilanceAxisLevel(5, 6)).toBe(1)
  })

  it("no cap when age is null (graphic unrated title still flags)", () => {
    expect(vigilanceAxisLevel(4, null)).toBe(2)
    expect(vigilanceAxisLevel(5, undefined)).toBe(3)
  })

  it("calm family content stays at 0", () => {
    expect(vigilanceAxisLevel(2, 6)).toBe(0)
    expect(vigilanceAxisLevel(null, 6)).toBe(0)
  })
})

describe("vigilanceMax — overall = max across axes", () => {
  it("a single high axis flips the overall level (not an average)", () => {
    expect(vigilanceMax({ violence: 4, sexNudity: 0, language: 0, substanceUse: 0 }, "MOVIE", 12)).toBe(2)
  })

  it("respects the age cap across all axes", () => {
    expect(vigilanceMax({ violence: 5, language: 4 }, "MOVIE", 6)).toBe(1)
  })

  it("games consider violence, language, consumerism, and substances", () => {
    expect(vigilanceMax({ violence: 0, language: 5, consumerism: 0, substanceUse: 0 }, "GAME", 12)).toBe(3)
    expect(vigilanceMax({ violence: 0, language: 0, consumerism: 4, substanceUse: 0 }, "GAME", 12)).toBe(2)
  })

  it("returns 0 with no metrics", () => {
    expect(vigilanceMax(null, "MOVIE", 10)).toBe(0)
  })
})

describe("vigilanceTone — coarse severity dot", () => {
  it("red when an axis is high (raw ≥4)", () => {
    expect(vigilanceTone({ violence: 4 }, "MOVIE", 12, ["Action"])).toBe("red")
    expect(vigilanceTone({ language: 5 }, "MOVIE", 14, [])).toBe("red")
  })

  it("red for a mature genre even if the metric is under-scored", () => {
    // Horror stored at only violence 3 → would be amber by metric, but the
    // genre floor makes it red.
    expect(vigilanceTone({ violence: 3 }, "MOVIE", 16, ["Horreur"])).toBe("red")
    expect(vigilanceTone(null, "MOVIE", 16, ["Thriller"])).toBe("red")
  })

  it("amber when there are points but nothing high", () => {
    expect(vigilanceTone({ violence: 3 }, "MOVIE", 10, ["Action"])).toBe("amber")
  })

  it("none when nothing to flag", () => {
    expect(vigilanceTone({ violence: 2 }, "MOVIE", 6, ["Animation"])).toBe("none")
    expect(vigilanceTone(null, "MOVIE", 6, ["Animation"])).toBe("none")
  })

  it("age cap keeps a young title from going red on metric alone", () => {
    // raw 5 on a 6+ title is clamped to level 1 → amber, not red (no mature genre).
    expect(vigilanceTone({ violence: 5 }, "MOVIE", 6, ["Animation"])).toBe("amber")
  })
})

describe("totemLevel vs vigilanceAxisLevel — two contracts, not interchangeable", () => {
  // MethodeBand renders the level as a WORD ("Aucun" / "Léger" / …), which is
  // a factual claim about the title. It must use totemLevel. vigilanceAxisLevel
  // is the coarser badge SIGNAL and understates on purpose.
  it("totemLevel never calls a scored axis 'Aucun'", () => {
    expect(TOTEM_WORDS[totemLevel(1)]).toBe("Léger")
    expect(TOTEM_WORDS[totemLevel(2)]).toBe("Léger")
    expect(TOTEM_WORDS[totemLevel(0)]).toBe("Aucun")
    expect(TOTEM_WORDS[totemLevel(null)]).toBe("Aucun")
  })

  it("the vigilance mapping WOULD have said 'Aucun' for a scored axis", () => {
    // Regression guard: this is exactly what the méthode band used to print.
    expect(TOTEM_WORDS[vigilanceAxisLevel(1, 12)]).toBe("Aucun")
    expect(TOTEM_WORDS[vigilanceAxisLevel(2, 12)]).toBe("Aucun")
  })

  it("Maléfique : Le Pouvoir du Mal (v3 s1 l1 sub0, 12+) reads faithfully", () => {
    // The real row behind the homepage card.
    expect(TOTEM_WORDS[totemLevel(3)]).toBe("Modéré") // violence — matches the fiche's amber band
    expect(TOTEM_WORDS[totemLevel(1)]).toBe("Léger") // sexe — was "Aucun"
    expect(TOTEM_WORDS[totemLevel(1)]).toBe("Léger") // langage — was "Aucun"
    expect(TOTEM_WORDS[totemLevel(0)]).toBe("Aucun") // substances
  })

  it("totemLevel applies no age cap, so a word can't be softened by the rating", () => {
    // vigilanceAxisLevel caps ≤8 titles at 1; that must not silently rewrite
    // a per-axis word into something milder than the recorded score.
    expect(totemLevel(5)).toBe(3)
    expect(vigilanceAxisLevel(5, 6)).toBe(1)
  })
})
