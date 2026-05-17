import { describe, expect, it } from "vitest"
import {
  applyFitGuardrails,
  computeAgeScore,
  computeGenreScore,
  computeMatureContentPenalty,
  computeSensitivityScore,
  computeWeightedFitScore,
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

  it("returns a non-zero floor when favorites are set but none overlap", () => {
    // Regression: Tomodachi (Simulator) on a kid whose favorites are
    // Animation/Action/Comédie used to return 0, which then collided with the
    // explicit-dislike sentinel and dropped them from avatar pills. The
    // missing positive signal must NOT trigger the hard-reject path.
    const score = computeGenreScore(["Simulator"], ["Animation", "Action", "Comédie"], ["Horreur"])
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(0.5)
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
    // Phase 0.1(a): tolerance 0 now skips the pair entirely. Only violence
    // contributes — sensitivity=3 / threshold=1 / metric=4 → 1 - 0.75 = 0.25.
    expect(score).toBeCloseTo(0.25, 2)
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

  it("returns 1 when every axis is 'don't care' (Phase 0.1a)", () => {
    // Tolerance 0 means the parent explicitly opted in. The pair is skipped;
    // when ALL pairs are skipped, the function returns 1 (no penalty).
    const score = computeSensitivityScore(
      { violence: 4, sexNudity: 4, language: 4, substanceUse: 4 },
      {
        sensitivityViolence: 0,
        sensitivitySexual: 0,
        sensitivityLanguage: 0,
        sensitivitySubstances: 0,
      },
    )
    expect(score).toBe(1)
  })

  it("Erwan-on-Avengers: tolerant teen yields a clean sensitivity score even with violence:4", () => {
    // Erwan said sensitivityViolence=0. Only the language axis contributes (sensitivity=2,
    // threshold=2, metric=2 → score 1). Others skipped (tolerance 0) or perfect.
    const score = computeSensitivityScore(
      { violence: 4, sexNudity: 1, language: 2, substanceUse: 1 },
      {
        sensitivityViolence: 0,
        sensitivitySexual: 0,
        sensitivityLanguage: 2,
        sensitivitySubstances: 2,
      },
    )
    expect(score).toBeGreaterThan(0.9)
  })
})

describe("computeMatureContentPenalty — Phase 0.1(b): respects member sensitivity", () => {
  it("skips violence:4 penalty when member said 'ok with violence'", () => {
    // Erwan (14) on Avengers (10+, violence:4) with sensitivityViolence:0
    const penalty = computeMatureContentPenalty(
      ["Action", "Aventure"],
      { violence: 4, sexNudity: 0 },
      10,
      14,
      { violence: 0, sexual: 2 },
    )
    expect(penalty.severity).toBeNull()
    expect(penalty.multiplier).toBe(1)
    expect(penalty.reason).toBeNull()
  })

  it("still penalizes violence:4 when member sensitivity is default (>0)", () => {
    // Member who hasn't opted in — penalty fires as before
    const penalty = computeMatureContentPenalty(
      ["Action"],
      { violence: 4, sexNudity: 0 },
      10,
      14,
      { violence: 2, sexual: 2 },
    )
    expect(penalty.severity).toBe("caution")
  })

  it("skips sex penalty when member said 'ok with intimate scenes'", () => {
    const penalty = computeMatureContentPenalty(
      ["Drame"],
      { violence: 1, sexNudity: 4 },
      14,
      16,
      { violence: 2, sexual: 0 },
    )
    expect(penalty.severity).toBeNull()
  })

  it("structural mature genres still fire regardless of slider state", () => {
    // Horror/Thriller genre is a structural signal — opt-in for those flows
    // through dislikedGenres removal + sensitivityScary, not through this slider.
    const penalty = computeMatureContentPenalty(
      ["Horreur"],
      { violence: 1, sexNudity: 0 },
      14,
      14,
      { violence: 0, sexual: 0 },
    )
    expect(penalty.severity).toBe("caution")
  })

  it("defaults to conservative (penalty fires) when memberSensitivity is omitted", () => {
    const penalty = computeMatureContentPenalty(
      ["Action"],
      { violence: 4, sexNudity: 0 },
      10,
      14,
    )
    expect(penalty.severity).toBe("caution")
  })

  it("matrix: tolerance 0..3 × violence 0..5 (12 cells, the ones that matter)", () => {
    const cases = [
      // tolerance 0 = ok with violence → no severity at any violence level
      { tolerance: 0, violence: 0, expectSeverity: null },
      { tolerance: 0, violence: 4, expectSeverity: null },
      { tolerance: 0, violence: 5, expectSeverity: null },
      // tolerance 1 = a little — penalty fires only on >= 4
      { tolerance: 1, violence: 3, expectSeverity: null },
      { tolerance: 1, violence: 4, expectSeverity: "caution" as const },
      // tolerance 2 = moderate, default — penalty fires only on >= 4
      { tolerance: 2, violence: 4, expectSeverity: "caution" as const },
      // tolerance 3 = strict — penalty fires on >= 4 (no extra threshold here,
      // that's what computeSensitivityScore handles)
      { tolerance: 3, violence: 4, expectSeverity: "caution" as const },
    ]
    for (const c of cases) {
      const penalty = computeMatureContentPenalty(
        ["Action"],
        { violence: c.violence, sexNudity: 0 },
        10,
        14,
        { violence: c.tolerance, sexual: 2 },
      )
      expect(penalty.severity).toBe(c.expectSeverity)
    }
  })
})

describe("computeWeightedFitScore — Phase 2.2 hard gates + personalizedScore", () => {
  const PERFECT_NON_GENRE = {
    ageScore: 1,
    sensitivityScore: 1,
    interestsScore: 1,
    affinityScore: 1,
    toneScore: 1,
    positiveScore: 1,
    avoidScore: 1,
  }

  it("hard-gates a dislikedGenre match (genreScore=0) regardless of other strengths", () => {
    const score = computeWeightedFitScore({
      ...PERFECT_NON_GENRE,
      genreScore: 0,
      personalizedScore: 1, // cosine wants to rescue — must not
    })
    expect(score).toBeLessThanOrEqual(15)
  })

  it("hard-gates an avoid-topic match (avoidScore=0) regardless of cosine", () => {
    const score = computeWeightedFitScore({
      ...PERFECT_NON_GENRE,
      genreScore: 1,
      avoidScore: 0,
      personalizedScore: 1,
    })
    expect(score).toBeLessThanOrEqual(15)
  })

  it("includes the cosine term with ~10% weight when no hard gate fires", () => {
    const high = computeWeightedFitScore({
      ageScore: 0.7,
      sensitivityScore: 0.7,
      genreScore: 0.7,
      interestsScore: 0.7,
      affinityScore: 0.7,
      toneScore: 0.7,
      positiveScore: 0.7,
      avoidScore: 0.7,
      personalizedScore: 1.0,
    })
    const low = computeWeightedFitScore({
      ageScore: 0.7,
      sensitivityScore: 0.7,
      genreScore: 0.7,
      interestsScore: 0.7,
      affinityScore: 0.7,
      toneScore: 0.7,
      positiveScore: 0.7,
      avoidScore: 0.7,
      personalizedScore: 0.0,
    })
    // The cosine term swings the score by ~10 points (10% weight × 100 scale).
    expect(high - low).toBeGreaterThan(7)
    expect(high - low).toBeLessThan(13)
  })

  it("defaults personalizedScore to neutral 0.5 when omitted (no regression vs old callers)", () => {
    const baseline = { ...PERFECT_NON_GENRE, genreScore: 1 }
    const omitted = computeWeightedFitScore(baseline)
    const explicit = computeWeightedFitScore({ ...baseline, personalizedScore: 0.5 })
    expect(omitted).toBe(explicit)
  })
})

