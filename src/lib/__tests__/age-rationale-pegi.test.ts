import { describe, expect, it } from "vitest"
import { buildAgeRationale, buildPegiComparison } from "@/lib/age-rationale"

const metrics = { violence: 4, sexNudity: 0, language: 3, consumerism: 1, substanceUse: 0, positiveMessages: 2, roleModels: 2 }

function drivers(expertAgeRec: number) {
  return buildAgeRationale({ title: "Jeu", type: "GAME", expertAgeRec, contentMetrics: metrics }).drivers
}

describe("buildPegiComparison", () => {
  it("explains a Totem age above PEGI with the rationale drivers", () => {
    expect(buildPegiComparison({ expertAgeRec: 10, officialRating: "PEGI_7", drivers: drivers(10) })).toBe(
      "PEGI 7 ; Totem Avisé conseille dès 10 ans en raison de : violence (marqué), langage (présent).",
    )
  })

  it("says « en accord avec PEGI » when the ages match", () => {
    expect(buildPegiComparison({ expertAgeRec: 12, officialRating: "PEGI_12", drivers: drivers(12) })).toBe(
      "PEGI 12 ; Totem Avisé conseille dès 12 ans, en accord avec PEGI.",
    )
  })

  it("adds no reason it does not have", () => {
    expect(buildPegiComparison({ expertAgeRec: 10, officialRating: "PEGI_7", drivers: [] })).toBe(
      "PEGI 7 ; Totem Avisé conseille dès 10 ans.",
    )
  })

  it("handles a lower Totem age and « tous publics » without inventing a reason", () => {
    expect(buildPegiComparison({ expertAgeRec: 0, officialRating: "PEGI_3", drivers: [] })).toBe(
      "PEGI 3 ; Totem Avisé le conseille pour tous publics. La classification PEGI reste celle qui s'applique à la vente du jeu.",
    )
  })

  it("is null with nothing to compare or when the analysis is hidden", () => {
    expect(buildPegiComparison({ expertAgeRec: 10, officialRating: null, drivers: [] })).toBeNull()
    expect(buildPegiComparison({ expertAgeRec: 10, officialRating: "CSA_12", drivers: [] })).toBeNull()
    expect(buildPegiComparison({ expertAgeRec: null, officialRating: "PEGI_7", drivers: [] })).toBeNull()
    expect(
      buildPegiComparison({ expertAgeRec: 10, officialRating: "PEGI_7", drivers: [], hideContentAnalysis: true }),
    ).toBeNull()
  })

  it("never states an age other than the stored one", () => {
    for (const age of [0, 3, 7, 10, 12, 14, 16, 18]) {
      for (const pegi of [3, 7, 12, 16, 18]) {
        const s = buildPegiComparison({ expertAgeRec: age, officialRating: `PEGI_${pegi}`, drivers: drivers(age) })!
        const totemAges = [...s.matchAll(/dès (\d+) ans/g)].map((m) => Number(m[1]))
        expect(totemAges.every((a) => a === age)).toBe(true)
        expect(s).not.toMatch(/CSA/)
      }
    }
  })
})
