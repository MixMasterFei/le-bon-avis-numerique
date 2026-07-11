import { describe, expect, it } from "vitest"
import { totemVoiceLine, synopsisHook, type FitReason } from "../totem-voice"

describe("synopsisHook", () => {
  it("returns null for empty or too-short text", () => {
    expect(synopsisHook(null)).toBeNull()
    expect(synopsisHook(undefined)).toBeNull()
    expect(synopsisHook("Court.")).toBeNull()
  })

  it("keeps a short synopsis whole", () => {
    const s = "Deux frères partent explorer une forêt enchantée pour sauver leur village."
    expect(synopsisHook(s)).toBe(s)
  })

  it("trims a long synopsis to ~one sentence without cutting a word", () => {
    const long =
      "Après la disparition de leur père, deux jeunes frères se lancent dans une quête pleine de dangers. " +
      "Ils traversent des royaumes oubliés, affrontent des créatures et découvrent le sens du courage au fil du voyage."
    const hook = synopsisHook(long)!
    expect(hook.length).toBeLessThanOrEqual(161)
    expect(hook).not.toContain("  ")
    // No mid-word cut: ends on punctuation or an ellipsis.
    expect(/[.!?…]$/.test(hook)).toBe(true)
  })
})

describe("totemVoiceLine", () => {
  it("links the member and weaves the synopsis", () => {
    const line = totemVoiceLine(
      { kind: "member-genre", name: "Erwan", genre: "Aventure" },
      "Deux frères explorent une forêt enchantée.",
    )
    expect(line).toContain("Erwan")
    expect(line.toLowerCase()).toContain("aventure")
    expect(line).toContain("forêt enchantée")
    expect(line).toContain(" : ")
  })

  it("falls back to a clean sentence when there is no synopsis", () => {
    const line = totemVoiceLine({ kind: "family-all" })
    expect(line).toBe("Pour toute la famille.")
    expect(line.endsWith(".")).toBe(true)
  })

  it("names both members for a two-member fit", () => {
    const line = totemVoiceLine({ kind: "family-some", names: ["Mathis", "Eliott", "Erwan"] })
    expect(line).toContain("Mathis")
    expect(line).toContain("Eliott")
    expect(line).not.toContain("Erwan")
  })

  it("produces a clean, non-empty note for every reason kind", () => {
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
      const line = totemVoiceLine(reason, "Un synopsis d'exemple suffisamment long pour être utilisé ici.")
      expect(line).not.toContain("{")
      expect(line).not.toContain("undefined")
      expect(line.length).toBeGreaterThan(15)
    }
  })
})
