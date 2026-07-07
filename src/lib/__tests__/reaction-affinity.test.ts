import { describe, expect, it } from "vitest"
import { computeSignedAffinity, AFFINITY_REACTIONS, DISMISSAL_REACTIONS } from "../reaction-affinity"

const sim = (entries: [string, number][]) => new Map(entries)

describe("computeSignedAffinity", () => {
  it("returns null with no reactions on similar titles (cold start)", () => {
    expect(computeSignedAffinity([], sim([["gta5", 0.8]]))).toBeNull()
    expect(
      computeSignedAffinity(
        [{ mediaId: "zelda", reaction: "LOVED" }],
        sim([["gta5", 0.8]]),
      ),
    ).toBeNull()
  })

  it("a loved similar title pulls the score up", () => {
    const a = computeSignedAffinity(
      [{ mediaId: "gta5", reaction: "LOVED", mediaTitle: "GTA V" }],
      sim([["gta5", 0.8]]),
    )
    expect(a).not.toBeNull()
    expect(a!.score).toBeGreaterThan(0.9)
    expect(a!.bestPositive?.title).toBe("GTA V")
    expect(a!.reason).toContain("GTA V")
  })

  it("a dismissed similar title pulls the score down", () => {
    const a = computeSignedAffinity(
      [{ mediaId: "gta4", reaction: "TOO_OLD", mediaTitle: "GTA IV" }],
      sim([["gta4", 0.8]]),
    )
    expect(a!.score).toBeLessThan(0.1)
    expect(a!.bestNegative?.title).toBe("GTA IV")
  })

  // The product promise: "loved GTA V, pas intéressé par GTA IV" → another
  // GTA lands in the middle, not at "Bon choix" nor hidden outright.
  it("mixed history means out to neutral (loved GTA V + dismissed GTA IV)", () => {
    const a = computeSignedAffinity(
      [
        { mediaId: "gta5", reaction: "LOVED", mediaTitle: "GTA V" },
        { mediaId: "gta4", reaction: "TOO_OLD", mediaTitle: "GTA IV" },
      ],
      sim([["gta5", 0.8], ["gta4", 0.8]]),
    )
    expect(a!.score).toBeGreaterThan(0.4)
    expect(a!.score).toBeLessThan(0.6)
    expect(a!.evidence).toBe(2)
    // The reason surfaces BOTH sides so the parent sees the mean is honest.
    expect(a!.reason).toContain("GTA V")
    expect(a!.reason).toContain("GTA IV")
  })

  it("weights by similarity — a close match counts more than a distant one", () => {
    const a = computeSignedAffinity(
      [
        { mediaId: "close", reaction: "LOVED", mediaTitle: "Close" },
        { mediaId: "far", reaction: "NOT_FOR_ME", mediaTitle: "Far" },
      ],
      sim([["close", 0.9], ["far", 0.45]]),
    )
    expect(a!.score).toBeGreaterThan(0.5) // the close positive wins the mean
  })

  it("WATCHED carries no valence and feeds nothing", () => {
    expect(
      computeSignedAffinity(
        [{ mediaId: "gta5", reaction: "WATCHED", mediaTitle: "GTA V" }],
        sim([["gta5", 0.9]]),
      ),
    ).toBeNull()
  })

  it("exports coherent reaction lists", () => {
    expect(AFFINITY_REACTIONS).not.toContain("WATCHED")
    for (const d of DISMISSAL_REACTIONS) expect(AFFINITY_REACTIONS).toContain(d)
  })
})
