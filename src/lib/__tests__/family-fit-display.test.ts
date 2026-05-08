import { describe, expect, it } from "vitest"
import { familyFitLabelFromScore } from "../family-fit-display"

describe("family fit display bands", () => {
  it("keeps guarded 65 scores in the review band", () => {
    expect(familyFitLabelFromScore(65)).toBe("À vérifier")
  })

  it("shows good choice only above the cautious guardrail cap", () => {
    expect(familyFitLabelFromScore(66)).toBe("Bon choix")
  })
})
