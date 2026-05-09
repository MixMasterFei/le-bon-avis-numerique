import { describe, expect, it } from "vitest"
import { familyFitLabelFromScore } from "../family-fit-display"

describe("family fit display bands", () => {
  it("keeps guarded 65 scores in the review band", () => {
    expect(familyFitLabelFromScore(65)).toBe("\u00c0 v\u00e9rifier")
  })

  it("shows good choice only above the cautious guardrail cap", () => {
    expect(familyFitLabelFromScore(66)).toBe("Bon choix")
  })

  it("uses a distinct label for clearly unsuitable scores", () => {
    expect(familyFitLabelFromScore(30)).toBe("Trop t\u00f4t")
  })
})
