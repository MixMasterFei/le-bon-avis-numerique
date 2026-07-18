import { describe, expect, it } from "vitest"
import { buildQueryVariants } from "../weather-geocode"

describe("buildQueryVariants", () => {
  it("keeps space-separated names as the first attempt (New York, San Francisco)", () => {
    expect(buildQueryVariants("New York")[0]).toBe("New York")
    expect(buildQueryVariants("San Francisco")[0]).toBe("San Francisco")
  })

  it("adds a hyphenated form for spaced French communes", () => {
    const v = buildQueryVariants("Saint jacut de la mer")
    expect(v).toContain("Saint jacut de la mer")
    expect(v).toContain("Saint-jacut-de-la-mer")
  })

  it("adds a short first-two-token prefix for long names", () => {
    const v = buildQueryVariants("Saint jacut de la mer")
    // "Saint-jacut" prefix surfaces the commune (Open-Meteo prefix-matches).
    expect(v).toContain("Saint-jacut")
  })

  it("does not add a prefix for two-token names", () => {
    // Boulogne-Billancourt is one token after the split; no over-shortening.
    const v = buildQueryVariants("Boulogne-Billancourt")
    expect(v).toEqual(["Boulogne-Billancourt"])
  })

  it("dedupes case-insensitively and drops sub-2-char noise", () => {
    const v = buildQueryVariants("Paris")
    expect(v).toEqual(["Paris"])
  })
})
