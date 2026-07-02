import { describe, it, expect } from "vitest"
import { floorExpertAgeBySignals, isAnimationStyle } from "./age-floor"

describe("floorExpertAgeBySignals", () => {
  it("raises a lenient-rated live-action drama with moderate axes (Forrest Gump case)", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 10,
        metrics: { violence: 3, substanceUse: 3 },
        visualStyle: "Prise de vue réelle",
      }),
    ).toBe(12)
  })

  it("floors graphic live-action (axis 4+) to 14", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 11,
        metrics: { violence: 5 },
        visualStyle: "Prise de vue réelle",
      }),
    ).toBe(14)
  })

  it("applies the animation discount (axis 4 animation → 12, not 14)", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 8,
        metrics: { violence: 4 },
        genres: ["Animation"],
      }),
    ).toBe(12)
  })

  it("does not over-flag a family comedy (max axis 2)", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 6,
        metrics: { violence: 1, language: 2 },
        visualStyle: "Prise de vue réelle",
      }),
    ).toBe(6)
  })

  it("floors live-action war themes to 12 even with moderate metrics", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 8,
        metrics: { violence: 2 },
        topics: ["Guerre"],
        visualStyle: "Prise de vue réelle",
      }),
    ).toBe(12)
  })

  it("never lowers an already-mature age", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 16,
        metrics: { violence: 5, sexNudity: 4 },
      }),
    ).toBe(16)
  })

  it("floors a game rated below its PEGI age (the leniency case)", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 8,
        type: "GAME",
        officialRating: "PEGI_12",
      }),
    ).toBe(12)
  })

  it("keeps a game already above its PEGI age (independent guidance can be stricter)", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 14,
        type: "GAME",
        officialRating: "PEGI_12",
      }),
    ).toBe(14)
  })

  it("does not apply content-axis floors to games (PEGI only)", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 7,
        type: "GAME",
        metrics: { violence: 5 },
        officialRating: "PEGI_7",
      }),
    ).toBe(7)
  })

  it("leaves a game without a PEGI rating unchanged", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 7,
        type: "GAME",
        metrics: { violence: 5 },
        officialRating: null,
      }),
    ).toBe(7)
  })

  it("ignores CSA ratings for films (only PEGI is a floor input)", () => {
    expect(
      floorExpertAgeBySignals({
        expertAgeRec: 6,
        type: "MOVIE",
        metrics: { violence: 1 },
        officialRating: "CSA_12",
        visualStyle: "Prise de vue réelle",
      }),
    ).toBe(6)
  })

  it("handles missing metrics gracefully", () => {
    expect(floorExpertAgeBySignals({ expertAgeRec: 9, metrics: null })).toBe(9)
  })
})

describe("isAnimationStyle", () => {
  it("detects animation visual styles", () => {
    expect(isAnimationStyle("Animation 3D/CGI")).toBe(true)
    expect(isAnimationStyle("Anime japonais")).toBe(true)
  })
  it("detects animation via genre", () => {
    expect(isAnimationStyle(null, ["Animation", "Aventure"])).toBe(true)
  })
  it("returns false for live action", () => {
    expect(isAnimationStyle("Prise de vue réelle", ["Drame"])).toBe(false)
  })
})
