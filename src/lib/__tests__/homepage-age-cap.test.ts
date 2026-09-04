import { describe, expect, it } from "vitest"
import { homepageAgeCap, fitsHomepageAge } from "../homepage-age-cap"

describe("homepage family co-viewing cap", () => {
  it("protects the youngest band when 5–7 and 13–15 are selected together", () => {
    const cap = homepageAgeCap(["5-7", "13-15"])
    expect(cap).toBe(5)
    expect(fitsHomepageAge({ expertAgeRec: 14 }, cap)).toBe(false)
    expect(fitsHomepageAge({ expertAgeRec: 7 }, cap)).toBe(false)
    expect(fitsHomepageAge({ expertAgeRec: 5 }, cap)).toBe(true)
  })

  it.each([["2-4", 2], ["5-7", 5], ["8-10", 8], ["11-12", 11], ["13-15", 13], ["16+", 16]] as const)(
    "uses the lower bound of %s so every child in the band can watch", (key, expected) => {
      expect(homepageAgeCap([key])).toBe(expected)
    },
  )

  it("uses the youngest member and combines members with selected bands", () => {
    expect(homepageAgeCap([], [15, 6, 42])).toBe(6)
    expect(homepageAgeCap(["13-15"], [6])).toBe(6)
    expect(homepageAgeCap(["5-7"], [15])).toBe(5)
    expect(homepageAgeCap([], [0, 6])).toBe(0)
  })

  it("leaves default-cap selection to the homepage when no known age is selected", () => {
    expect(homepageAgeCap([])).toBeUndefined()
    expect(homepageAgeCap(["unknown"], [null, undefined, Number.NaN, -1])).toBeUndefined()
  })

  it("excludes missing/invalid recommendations under an explicit age cap", () => {
    for (const expertAgeRec of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      expect(fitsHomepageAge({ expertAgeRec }, 5)).toBe(false)
    }
    expect(fitsHomepageAge({ expertAgeRec: 0 }, 5)).toBe(true)
    expect(fitsHomepageAge({ expertAgeRec: 18 }, undefined)).toBe(true)
  })
})
