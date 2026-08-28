import { describe, expect, it } from "vitest"
import { ageBadgeLabel, ageMetaLabel, ageSentenceLabel } from "../age-label"

describe("age labels", () => {
  it("renders 0 as tous publics, not as nothing", () => {
    // Regression: cards tested `age > 0`, so a TP film ("La fin d'Oak Street")
    // shipped with no badge at all and read as unrated.
    expect(ageBadgeLabel(0)).toBe("TP")
    expect(ageMetaLabel(0)).toBe("Tous publics")
    expect(ageSentenceLabel(0)).toBe("Tous publics")
  })

  it("renders a positive age", () => {
    expect(ageBadgeLabel(10)).toBe("10+")
    expect(ageMetaLabel(10)).toBe("conseillé 10+")
    expect(ageSentenceLabel(10)).toBe("Dès 10 ans")
  })

  it("returns null when the age is genuinely unknown", () => {
    for (const v of [null, undefined, NaN, -1]) {
      expect(ageBadgeLabel(v as number | null)).toBeNull()
      expect(ageMetaLabel(v as number | null)).toBeNull()
      expect(ageSentenceLabel(v as number | null)).toBeNull()
    }
  })
})
