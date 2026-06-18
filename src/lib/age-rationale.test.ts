import { describe, it, expect } from "vitest"
import { buildAgeRationale, type AgeRationaleInput } from "./age-rationale"

const baseMetrics = {
  violence: 0,
  sexNudity: 0,
  language: 0,
  consumerism: 0,
  substanceUse: 0,
  positiveMessages: 0,
  roleModels: 0,
}

function input(overrides: Partial<AgeRationaleInput> = {}): AgeRationaleInput {
  return {
    title: "Test",
    type: "MOVIE",
    expertAgeRec: 12,
    contentMetrics: { ...baseMetrics },
    ...overrides,
  }
}

describe("buildAgeRationale", () => {
  it("returns show:false and no FAQ when there is no age", () => {
    const r = buildAgeRationale(input({ expertAgeRec: null }))
    expect(r.show).toBe(false)
    expect(r.faqQuestion).toBeNull()
  })

  it("lists elevated vigilance axes as drivers, sorted by severity", () => {
    const r = buildAgeRationale(
      input({
        expertAgeRec: 14,
        contentMetrics: { ...baseMetrics, violence: 4, language: 3 },
      }),
    )
    expect(r.show).toBe(true)
    expect(r.drivers.map((d) => d.key)).toEqual(["violence", "language"])
    expect(r.drivers[0].level).toBe("Marqué")
    expect(r.drivers[1].level).toBe("Présent")
    expect(r.lead).toContain("dès 14 ans")
  })

  it("maps level 5 to Intense, 4 to Marqué, 3 to Présent", () => {
    expect(
      buildAgeRationale(input({ contentMetrics: { ...baseMetrics, violence: 5 } }))
        .drivers[0].level,
    ).toBe("Intense")
    expect(
      buildAgeRationale(input({ contentMetrics: { ...baseMetrics, violence: 4 } }))
        .drivers[0].level,
    ).toBe("Marqué")
    expect(
      buildAgeRationale(input({ contentMetrics: { ...baseMetrics, violence: 3 } }))
        .drivers[0].level,
    ).toBe("Présent")
  })

  it("ignores axes below the driver threshold (level < 3)", () => {
    const r = buildAgeRationale(
      input({ contentMetrics: { ...baseMetrics, violence: 2, language: 2 } }),
    )
    expect(r.drivers).toHaveLength(0)
    expect(r.noDriverNote).toBeTruthy()
  })

  it("surfaces positive dimensions at level >= 4", () => {
    const r = buildAgeRationale(
      input({ contentMetrics: { ...baseMetrics, positiveMessages: 4, roleModels: 5 } }),
    )
    expect(r.positives).toEqual(["messages positifs", "modèles positifs"])
  })

  it("adds a historical-context note for live-action war themes", () => {
    const r = buildAgeRationale(
      input({ topics: ["seconde guerre mondiale"], genres: ["Drame"] }),
    )
    expect(r.contextNotes.join(" ")).toContain("guerre")
  })

  it("does not add the war note for animation", () => {
    const r = buildAgeRationale(
      input({ topics: ["guerre"], genres: ["Animation"] }),
    )
    expect(r.contextNotes).toHaveLength(0)
  })

  it("provisional: makes no content claims and flags the age as à confirmer", () => {
    const r = buildAgeRationale(
      input({
        hideContentAnalysis: true,
        contentMetrics: { ...baseMetrics, violence: 5 },
      }),
    )
    expect(r.isProvisional).toBe(true)
    expect(r.drivers).toHaveLength(0)
    expect(r.lead).toContain("à confirmer")
    expect(r.plainText).not.toContain("violence")
  })

  it("never exposes raw 0–5 numbers in the plain text", () => {
    const r = buildAgeRationale(
      input({ contentMetrics: { ...baseMetrics, violence: 4, language: 3 } }),
    )
    // No bare metric digits leaked (the age "12" is allowed; check axis levels stay words).
    expect(r.plainText).not.toMatch(/\b[0-5]\/5\b/)
    expect(r.plainText.toLowerCase()).toContain("violence (marqué)")
  })

  it("always includes the trust line (independence + guardrails)", () => {
    const r = buildAgeRationale(input())
    expect(r.trustLine).toContain("indépendante")
    expect(r.plainText).toContain("garde-fous")
  })
})
