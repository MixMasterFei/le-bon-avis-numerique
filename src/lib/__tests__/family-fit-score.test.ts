import { describe, expect, it } from "vitest"
import {
  applyFitGuardrails,
  computeMatureContentPenalty,
  hasRichProfile,
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

  it("caps incomplete profiles below excellent", () => {
    const result = applyFitGuardrails({
      score: 100,
      memberAge: 10,
      expertAgeRec: 7,
      hasRichProfile: false,
    })

    expect(result.score).toBe(74)
    expect(result.level).toBe("good")
    expect(result.reasonOverride).toBe("Basé surtout sur l'âge")
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

  it("applies mature-content penalties for children", () => {
    const penalty = computeMatureContentPenalty(
      ["Thriller"],
      { violence: 1, sexNudity: 0 },
      13,
      12,
    )

    expect(penalty.multiplier).toBe(0.25)
    expect(penalty.reason).toBe("contenu mature inadapté aux enfants")
  })

  it("requires explicit custom preferences for a rich profile", () => {
    expect(hasRichProfile({ useCustomSettings: true, favoriteGenres: ["Animation"] })).toBe(true)
    expect(hasRichProfile({ useCustomSettings: false, favoriteGenres: ["Animation"] })).toBe(false)
  })
})

