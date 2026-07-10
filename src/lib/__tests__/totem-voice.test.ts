import { describe, expect, it } from "vitest"
import { totemVoiceLine, type FitReason } from "../totem-voice"

describe("totemVoiceLine", () => {
  it("names the member and the matched favorite genre", () => {
    const line = totemVoiceLine({ kind: "member-genre", name: "Erwan", genre: "Aventure" })
    expect(line).toContain("Erwan")
    expect(line.toLowerCase()).toContain("aventure")
  })

  it("is deterministic for the same reason", () => {
    const reason: FitReason = { kind: "member-strong", name: "Mathis" }
    expect(totemVoiceLine(reason)).toBe(totemVoiceLine(reason))
  })

  it("names both members for a two-member fit", () => {
    const line = totemVoiceLine({ kind: "family-some", names: ["Mathis", "Eliott", "Erwan"] })
    expect(line).toContain("Mathis")
    expect(line).toContain("Eliott")
    // Only the first two are named to keep the sentence short.
    expect(line).not.toContain("Erwan")
  })

  it("produces a clean, non-empty sentence for every reason kind", () => {
    const reasons: FitReason[] = [
      { kind: "member-genre", name: "Léo", genre: "Animation" },
      { kind: "member-strong", name: "Léo" },
      { kind: "member-chosen", name: "Léo" },
      { kind: "family-all" },
      { kind: "family-one", name: "Léo" },
      { kind: "family-some", names: ["Léo", "Zoé"] },
      { kind: "family-compromise" },
    ]
    for (const reason of reasons) {
      const line = totemVoiceLine(reason)
      expect(line).not.toContain("{")
      expect(line).not.toContain("undefined")
      expect(line.length).toBeGreaterThan(15)
    }
  })
})
