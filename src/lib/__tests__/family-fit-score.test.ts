import { describe, expect, it } from "vitest"
import {
  applyFitGuardrails,
  computeAgeScore,
  computeGenreScore,
  computeMatureContentPenalty,
  computeSensitivityScore,
  hasRichProfile,
  hasYouthAppealSignal,
  isAdultLeaningContentForMinor,
} from "../family-fit-score"

describe("family fit guardrails", () => {
  it("caps a 12-year-old below a 13+ recommendation", () => {
    const result = applyFitGuardrails({
      score: 100,
      memberAge: 12,
      expertAgeRec: 13,
      hasRichProfile: true,
    })

    expect(result.score).toBe(65)
    expect(result.level).toBe("moderate")
    expect(result.reasonOverride).toBe("Recommandé à partir de 13 ans")
    expect(result.ageWarning).toBe(true)
  })

  it("marks media as too early when the age gap is clear", () => {
    const result = applyFitGuardrails({
      score: 100,
      memberAge: 13,
      expertAgeRec: 16,
      hasRichProfile: true,
    })

    expect(result.score).toBe(30)
    expect(result.level).toBe("poor")
    expect(result.ageWarning).toBe(true)
  })

  it("keeps incomplete profiles in the review band", () => {
    const result = applyFitGuardrails({
      score: 100,
      memberAge: 10,
      expertAgeRec: 7,
      hasRichProfile: false,
    })

    expect(result.score).toBe(65)
    expect(result.level).toBe("moderate")
    expect(result.reasonOverride).toBe("À affiner avec le quiz famille")
  })

  it("treats missing expert age as a cautious estimate for minors", () => {
    const result = applyFitGuardrails({
      score: 90,
      memberAge: 9,
      expertAgeRec: null,
      hasRichProfile: true,
    })

    expect(result.score).toBe(65)
    expect(result.level).toBe("moderate")
    expect(result.reasonOverride).toBe("Âge expert à confirmer")
  })

  it("blocks mature content for a child below the recommended age", () => {
    const penalty = computeMatureContentPenalty(
      ["Thriller"],
      { violence: 1, sexNudity: 0 },
      13,
      12,
    )

    expect(penalty.multiplier).toBe(0.25)
    expect(penalty.reason).toBe("contenu mature inadapté aux enfants")
    expect(penalty.severity).toBe("block")
  })

  it("flags caution (not block) when a child is at the recommended age", () => {
    // Eliott (10) on a 10+ movie with violence: high (e.g. Avengers). The
    // movie is at his recommended age, so the badge should say "vigilance",
    // not "inadapté".
    const penalty = computeMatureContentPenalty(
      ["Action", "Aventure"],
      { violence: 4, sexNudity: 0 },
      10,
      10,
    )

    expect(penalty.severity).toBe("caution")
    expect(penalty.reason).toContain("vigilance")
  })

  it("flags caution for a teen above the recommended age", () => {
    // Erwan (15) on a 10+ movie with violence: high. His age is fine — only
    // the mature content is the concern.
    const penalty = computeMatureContentPenalty(
      ["Action"],
      { violence: 4, sexNudity: 0 },
      10,
      15,
    )

    expect(penalty.severity).toBe("caution")
    expect(penalty.multiplier).toBeGreaterThan(0.5)
  })

  it("returns null severity for adults", () => {
    const penalty = computeMatureContentPenalty(
      ["Action"],
      { violence: 4, sexNudity: 0 },
      10,
      40,
    )

    expect(penalty.severity).toBeNull()
    expect(penalty.multiplier).toBe(1)
  })

  it("returns null severity when content is not mature", () => {
    const penalty = computeMatureContentPenalty(
      ["Animation"],
      { violence: 1, sexNudity: 0 },
      6,
      8,
    )

    expect(penalty.severity).toBeNull()
    expect(penalty.multiplier).toBe(1)
  })

  it("requires explicit custom preferences for a rich profile", () => {
    expect(hasRichProfile({ useCustomSettings: true, favoriteGenres: ["Animation"] })).toBe(true)
    expect(hasRichProfile({ useCustomSettings: false, favoriteGenres: ["Animation"] })).toBe(false)
  })

  it("keeps adult-leaning teen content in review without a youth appeal signal", () => {
    const hasYouthAppeal = hasYouthAppealSignal({
      mediaGenres: ["Romance", "Comédie", "Drame"],
      mediaTopics: [],
      memberAge: 15,
    })

    const result = applyFitGuardrails({
      score: 100,
      memberAge: 15,
      expertAgeRec: 13,
      hasRichProfile: false,
      hasYouthAppeal,
      adultLeaning: isAdultLeaningContentForMinor({
        mediaGenres: ["Romance", "Comédie", "Drame"],
        expertAgeRec: 13,
        memberAge: 15,
        hasYouthAppeal,
      }),
    })

    expect(result.score).toBe(65)
    expect(result.level).toBe("moderate")
    expect(result.reasonOverride).toBe("À affiner avec le quiz famille")
  })

  it("does not treat family animation as youth appeal when adult genres are present", () => {
    const hasYouthAppeal = hasYouthAppealSignal({
      mediaGenres: ["Animation", "Drame"],
      mediaTopics: [],
      memberAge: 12,
    })

    expect(hasYouthAppeal).toBe(false)
  })
})

describe("computeGenreScore disliked-genre handling", () => {
  it("returns 0 when any disliked genre matches", () => {
    expect(computeGenreScore(["Horreur"], ["Animation"], ["Horreur"])).toBe(0)
  })

  it("returns 0 even when a favorite also matches (disliked wins)", () => {
    expect(computeGenreScore(["Horreur", "Animation"], ["Animation"], ["Horreur"])).toBe(0)
  })

  it("scores normally when no disliked genre matches", () => {
    expect(computeGenreScore(["Animation"], ["Animation"], ["Horreur"])).toBe(1)
  })

  it("returns the neutral 0.5 when there are no preferences", () => {
    expect(computeGenreScore(["Animation"], [], [])).toBe(0.5)
  })
})

describe("computeAgeScore raw score (display caps live in applyFitGuardrails)", () => {
  it("scores 1 for a perfect age match", () => {
    expect(computeAgeScore(10, 10)).toBe(1)
  })

  it("scores 0.7 for content exactly one year above member age", () => {
    // Display layer caps to 65/moderate via applyFitGuardrails; we keep the raw
    // value here so the smart filter's strict-mode penalty can stack.
    expect(computeAgeScore(11, 10)).toBe(0.7)
  })

  it("scores 0.2 for content more than one year above member age", () => {
    expect(computeAgeScore(13, 10)).toBe(0.2)
  })

  it("falls back to 0.5 when either age is null", () => {
    expect(computeAgeScore(null, 10)).toBe(0.5)
    expect(computeAgeScore(10, null)).toBe(0.5)
  })
})

describe("applyFitGuardrails boundary cases", () => {
  it("caps any positive age gap to 65 / moderate", () => {
    const result = applyFitGuardrails({
      score: 100,
      memberAge: 10,
      expertAgeRec: 11,
      hasRichProfile: true,
    })
    expect(result.score).toBe(65)
    expect(result.level).toBe("moderate")
    expect(result.ageWarning).toBe(true)
  })

  it("caps a gap of two or more to 30 / poor", () => {
    const result = applyFitGuardrails({
      score: 100,
      memberAge: 10,
      expertAgeRec: 12,
      hasRichProfile: true,
    })
    expect(result.score).toBe(30)
    expect(result.level).toBe("poor")
  })

  it("floors a mature-content caution at 36 + moderate (no 'Trop tôt' badge)", () => {
    // The Avengers scenario: Erwan (15) on a 10+ movie, base score after the
    // mature-content multiplier (0.55) would land around 33 — which used to
    // render "Trop tôt". With matureCaution we floor at 36 → "À vérifier".
    const result = applyFitGuardrails({
      score: 33,
      memberAge: 15,
      expertAgeRec: 10,
      hasRichProfile: true,
      matureCaution: true,
    })
    expect(result.score).toBeGreaterThanOrEqual(36)
    expect(result.level).toBe("moderate")
    expect(result.ageWarning).toBe(false)
  })

  it("matureCaution does not override a real age warning", () => {
    // A 9-year-old on a 13+ movie with mature content: the age warning is the
    // stronger signal and must win, even if matureCaution is also true.
    const result = applyFitGuardrails({
      score: 100,
      memberAge: 9,
      expertAgeRec: 13,
      hasRichProfile: true,
      matureCaution: true,
    })
    expect(result.ageWarning).toBe(true)
    expect(result.score).toBeLessThanOrEqual(30)
    expect(result.level).toBe("poor")
  })

  it("matureCaution leaves a healthy score alone", () => {
    const result = applyFitGuardrails({
      score: 80,
      memberAge: 15,
      expertAgeRec: 10,
      hasRichProfile: true,
      matureCaution: true,
    })
    expect(result.score).toBe(80)
  })
})

describe("hasYouthAppealSignal OR semantics (intentional)", () => {
  it("flags youth appeal via affinity even when the genreScore is zero", () => {
    // A child with strong prior affinity to a horror-adjacent title will still
    // trip the affinity branch — that's intentional, affinity reflects real
    // observed preference, not a configuration error.
    const flag = hasYouthAppealSignal({
      mediaGenres: ["Horreur"],
      mediaTopics: [],
      memberAge: 10,
      genreScore: 0,
      affinityScore: 0.5,
    })
    expect(flag).toBe(true)
  })

  it("does not flag youth appeal when all positive signals are low", () => {
    const flag = hasYouthAppealSignal({
      mediaGenres: ["Horreur"],
      mediaTopics: [],
      memberAge: 10,
      genreScore: 0,
      affinityScore: 0,
      interestsScore: 0,
      positiveScore: 0,
    })
    expect(flag).toBe(false)
  })
})

describe("computeSensitivityScore", () => {
  it("drives the score near zero for strict tolerance + high content level", () => {
    const score = computeSensitivityScore(
      { violence: 4, sexNudity: 0, language: 0, substanceUse: 0 },
      {
        sensitivityViolence: 3,
        sensitivitySexual: 0,
        sensitivityLanguage: 0,
        sensitivitySubstances: 0,
      },
    )
    // violence=4 with tolerance=3 (threshold=1) → 4 over by 3 → 1 - 0.75 = 0.25 for that pair
    // others all contribute 1.0 → average = (0.25 + 1 + 1 + 1) / 4 = 0.8125
    expect(score).toBeLessThan(0.85)
  })

  it("returns 1 when every metric is well within tolerance", () => {
    const score = computeSensitivityScore(
      { violence: 0, sexNudity: 0, language: 0, substanceUse: 0 },
      {
        sensitivityViolence: 3,
        sensitivitySexual: 3,
        sensitivityLanguage: 3,
        sensitivitySubstances: 3,
      },
    )
    expect(score).toBe(1)
  })
})

